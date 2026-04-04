"""
Trained recommender built from destination catalog + historical interaction data.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


TRAVELER_TYPE_MAP = {
    1: "solo",
    2: "couple",
}


@dataclass
class TrainedModelBundle:
    pipeline: Any
    destinations_df: pd.DataFrame
    metadata: Dict[str, Any]


class TrainedDestinationRecommender:
    def __init__(self, artifact_path: Optional[str] = None):
        self.artifact_path = Path(artifact_path) if artifact_path else None
        self.bundle: Optional[TrainedModelBundle] = None

        if self.artifact_path and self.artifact_path.exists():
            self.load(self.artifact_path)

    @property
    def is_ready(self) -> bool:
        return self.bundle is not None

    def load(self, artifact_path: Path) -> None:
        payload = joblib.load(artifact_path)
        self.bundle = TrainedModelBundle(
            pipeline=payload["pipeline"],
            destinations_df=payload["destinations_df"],
            metadata=payload.get("metadata", {}),
        )

    def recommend(self, user_preferences, num_recommendations: int = 5) -> List[Dict[str, Any]]:
        if not self.bundle:
            raise RuntimeError("Trained model is not loaded")

        candidate_features = self._build_candidate_rows(user_preferences, self.bundle.destinations_df)
        scores = self.bundle.pipeline.predict(candidate_features)
        candidate_features["predicted_score"] = np.clip(scores, 0, 1)

        if getattr(user_preferences, "destination", None):
            destination_pref = str(user_preferences.destination).strip().lower()
            candidate_features["predicted_score"] += candidate_features["destination_name"].str.lower().eq(destination_pref) * 0.08
            candidate_features["predicted_score"] += candidate_features["destination_name"].str.lower().str.contains(destination_pref, regex=False) * 0.04

        ranked = candidate_features.sort_values("predicted_score", ascending=False).head(num_recommendations)

        recommendations = []
        for _, row in ranked.iterrows():
            recommendations.append(
                {
                    "id": str(row["destination_id"]),
                    "title": self._compose_title(row),
                    "destination": row["destination_name"],
                    "price": float(row["recommended_price_inr"]),
                    "duration": self._recommended_duration(user_preferences),
                    "rating": float(row["avg_rating"]),
                    "match_score": round(float(row["predicted_score"]) * 100, 1),
                    "reasons": self._generate_reasons(user_preferences, row),
                    "image": self._image_for_trip_type(row["trip_type_item"]),
                }
            )

        return recommendations

    def generate_insights(self, user_preferences, num_suggestions: int = 3) -> Dict[str, Any]:
        if not self.bundle:
            raise RuntimeError("Trained model is not loaded")

        recommendations = self.recommend(user_preferences, num_recommendations=max(8, num_suggestions))
        budget = float(getattr(user_preferences, "budget", 0) or 0)

        upgrade = []
        for item in recommendations:
            extra = max(0, float(item["price"]) - budget)
            if extra > 0:
                upgrade.append(
                    {
                        "id": item["id"],
                        "title": item["title"],
                        "destination": item["destination"],
                        "price": item["price"],
                        "extra_budget_required": round(extra, 0),
                    }
                )
        upgrade = sorted(upgrade, key=lambda item: item["extra_budget_required"])[:num_suggestions]

        discovery = []
        preferred_destination = str(getattr(user_preferences, "destination", "") or "").strip().lower()
        for item in recommendations:
            if preferred_destination and preferred_destination in item["destination"].lower():
                continue
            discovery.append(
                {
                    "destination": item["destination"],
                    "sample_itinerary": item["title"],
                    "starting_price": item["price"],
                    "rating": item["rating"],
                }
            )
        return {
            "budget_upgrade_suggestions": upgrade,
            "destination_discovery": discovery[:num_suggestions],
        }

    @staticmethod
    def train(
        destinations_path: str,
        interactions_path: str,
        artifact_output_path: str,
    ) -> Dict[str, Any]:
        destinations_df = pd.read_csv(destinations_path)
        interactions_df = pd.read_csv(interactions_path)

        dataset = build_training_dataset(destinations_df, interactions_df)

        feature_columns = [
            "age",
            "budget_inr",
            "duration_days",
            "num_travelers",
            "budget_min_inr",
            "budget_max_inr",
            "avg_rating",
            "family_friendly_num",
            "solo_friendly_num",
            "honeymoon_popular_num",
            "within_budget_num",
            "traveler_type",
            "trip_type",
            "weather_pref",
            "travel_month",
            "season",
            "peak_status",
            "destination_name",
            "country_item",
            "region",
            "trip_type_item",
            "weather_type",
            "budget_tier",
            "visa_required_for_indians",
            "family_friendly",
            "solo_friendly",
            "honeymoon_popular",
        ]

        X = dataset[feature_columns]
        y = dataset["affinity_score"]
        booked = dataset["booked_num"]

        X_train, X_test, y_train, y_test, booked_train, booked_test = train_test_split(
            X,
            y,
            booked,
            test_size=0.2,
            random_state=42,
            stratify=booked,
        )

        numeric_columns = [
            "age",
            "budget_inr",
            "duration_days",
            "num_travelers",
            "budget_min_inr",
            "budget_max_inr",
            "avg_rating",
            "family_friendly_num",
            "solo_friendly_num",
            "honeymoon_popular_num",
            "within_budget_num",
        ]
        categorical_columns = [column for column in feature_columns if column not in numeric_columns]

        preprocessor = ColumnTransformer(
            transformers=[
                (
                    "num",
                    Pipeline(
                        steps=[
                            ("imputer", SimpleImputer(strategy="median")),
                            ("scaler", StandardScaler()),
                        ]
                    ),
                    numeric_columns,
                ),
                (
                    "cat",
                    Pipeline(
                        steps=[
                            ("imputer", SimpleImputer(strategy="most_frequent")),
                            ("onehot", OneHotEncoder(handle_unknown="ignore")),
                        ]
                    ),
                    categorical_columns,
                ),
            ]
        )

        pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                (
                    "model",
                    RandomForestRegressor(
                        n_estimators=320,
                        max_depth=20,
                        min_samples_leaf=3,
                        random_state=42,
                        n_jobs=-1,
                    ),
                ),
            ]
        )

        pipeline.fit(X_train, y_train)
        predictions = np.clip(pipeline.predict(X_test), 0, 1)

        metadata = {
            "training_rows": int(len(dataset)),
            "destinations": int(destinations_df["destination_id"].nunique()),
            "booked_rate": round(float(dataset["booked_num"].mean()), 4),
            "mae": round(float(mean_absolute_error(y_test, predictions)), 4),
            "auc_like": round(float(roc_auc_score(booked_test, predictions)), 4),
            "feature_columns": feature_columns,
        }

        artifact_path = Path(artifact_output_path)
        artifact_path.parent.mkdir(parents=True, exist_ok=True)

        destinations_catalog = prepare_destinations_catalog(destinations_df)
        joblib.dump(
            {
                "pipeline": pipeline,
                "destinations_df": destinations_catalog,
                "metadata": metadata,
            },
            artifact_path,
        )

        return metadata

    def _build_candidate_rows(self, user_preferences, destinations_df: pd.DataFrame) -> pd.DataFrame:
        user_budget = float(getattr(user_preferences, "budget", 0) or 0)
        num_people = int(getattr(user_preferences, "num_people", 1) or 1)
        destination_pref = getattr(user_preferences, "destination", None)

        traveler_type = TRAVELER_TYPE_MAP.get(num_people, "group" if num_people >= 4 else "family")
        if getattr(user_preferences, "travel_style", "balanced") == "luxury":
            traveler_type = "couple" if num_people <= 2 else traveler_type

        preferred_trip_type = guess_trip_type(user_preferences)
        preferred_weather = normalize_weather(getattr(user_preferences, "weather_preference", None))

        rows = destinations_df.copy()
        rows["age"] = 32
        rows["budget_inr"] = user_budget
        rows["duration_days"] = self._recommended_duration_days(user_preferences)
        rows["num_travelers"] = num_people
        rows["country_item"] = rows["country"]
        rows["trip_type_item"] = rows["trip_type"]
        rows["traveler_type"] = traveler_type
        rows["trip_type"] = preferred_trip_type
        rows["weather_pref"] = preferred_weather
        rows["travel_month"] = guess_month_from_preferences(user_preferences)
        rows["season"] = guess_season(rows["travel_month"].iloc[0])
        rows["peak_status"] = rows.apply(
            lambda row: classify_peak(str(row["travel_month"]), str(row.get("best_months", ""))),
            axis=1,
        )
        rows["within_budget_num"] = (
            (rows["recommended_price_inr"] <= user_budget).astype(float)
            if user_budget > 0
            else 1.0
        )
        rows["destination_pref"] = destination_pref or ""
        return rows

    def _generate_reasons(self, user_preferences, row: pd.Series) -> List[str]:
        reasons: List[str] = []
        preferred_destination = str(getattr(user_preferences, "destination", "") or "").strip().lower()
        if preferred_destination and preferred_destination in row["destination_name"].lower():
            reasons.append(f"Matches destination: {row['destination_name']}")

        budget = float(getattr(user_preferences, "budget", 0) or 0)
        if budget and row["recommended_price_inr"] <= budget:
            reasons.append("Fits your budget range")

        mood = str(getattr(user_preferences, "mood", "") or "").lower()
        activities = str(row.get("top_activities", "") or "").lower()
        if mood and mood in activities:
            reasons.append(f"Supports your mood: {mood.title()}")

        trip_type = str(row.get("trip_type_item", "") or "")
        if trip_type:
            reasons.append(f"Great for {trip_type.lower()}")

        if float(row.get("avg_rating", 0) or 0) >= 4.5:
            reasons.append(f"Top rated ({row['avg_rating']}★)")

        return reasons[:3] or ["Strong match from learned user behavior"]

    @staticmethod
    def _compose_title(row: pd.Series) -> str:
        trip_type = str(row.get("trip_type_item", "Escape")).replace("&", "and")
        return f"{row['destination_name']} {trip_type} Escape"

    @staticmethod
    def _image_for_trip_type(trip_type: str) -> str:
        lookup = {
            "Beach & Sun": "sunny",
            "Adventure & Outdoors": "trail-sign",
            "Culture & History": "business",
            "Wellness & Spa": "leaf",
            "Luxury & Romance": "heart",
            "City Break": "business-outline",
            "Wildlife & Nature": "leaf-outline",
            "Food & Cuisine": "restaurant-outline",
            "Skiing & Snow Sports": "snow-outline",
        }
        return lookup.get(trip_type, "briefcase-outline")

    @staticmethod
    def _recommended_duration(user_preferences) -> str:
        days = TrainedDestinationRecommender._recommended_duration_days(user_preferences)
        nights = max(days - 1, 1)
        return f"{days} Days / {nights} Nights"

    @staticmethod
    def _recommended_duration_days(user_preferences) -> int:
        if getattr(user_preferences, "travel_style", "") == "luxury":
            return 5
        num_people = int(getattr(user_preferences, "num_people", 1) or 1)
        return 4 if num_people <= 2 else 5


def build_training_dataset(destinations_df: pd.DataFrame, interactions_df: pd.DataFrame) -> pd.DataFrame:
    destinations = prepare_destinations_catalog(destinations_df)
    interactions = interactions_df.copy()

    interactions["destination"] = interactions["destination"].astype(str).str.strip()
    interactions["weather_pref"] = interactions["weather_pref"].fillna("No Preference").astype(str).str.strip()
    interactions["within_budget_num"] = interactions["within_budget"].map({"Yes": 1.0, "No": 0.0}).fillna(0.0)
    interactions["booked_num"] = interactions["booked"].map({"Yes": 1.0, "No": 0.0}).fillna(0.0)
    interactions["rating_given"] = pd.to_numeric(interactions["rating_given"], errors="coerce").fillna(4.0)
    interactions["relevance_score"] = pd.to_numeric(interactions["relevance_score"], errors="coerce").fillna(50.0)

    merged = interactions.merge(
        destinations,
        left_on="destination",
        right_on="destination_name",
        how="inner",
        suffixes=("", "_item"),
    )

    merged["affinity_score"] = np.clip(
        0.55 * merged["booked_num"]
        + 0.30 * (merged["relevance_score"] / 100.0)
        + 0.15 * (merged["rating_given"] / 5.0),
        0,
        1,
    )
    return merged


def prepare_destinations_catalog(destinations_df: pd.DataFrame) -> pd.DataFrame:
    df = destinations_df.copy()
    df["destination_name"] = df["destination_name"].astype(str).str.strip()
    df["budget_min_inr"] = pd.to_numeric(df["budget_min_inr"], errors="coerce").fillna(0)
    df["budget_max_inr"] = pd.to_numeric(df["budget_max_inr"], errors="coerce").fillna(df["budget_min_inr"])
    df["avg_rating"] = pd.to_numeric(df["avg_rating"], errors="coerce").fillna(4.0)
    df["recommended_price_inr"] = ((df["budget_min_inr"] + df["budget_max_inr"]) / 2).round(0)
    df["family_friendly_num"] = map_yes_no(df["family_friendly"])
    df["solo_friendly_num"] = map_yes_no(df["solo_friendly"])
    df["honeymoon_popular_num"] = map_yes_no(df["honeymoon_popular"])
    return df


def map_yes_no(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().map({"Yes": 1.0, "No": 0.0, "Moderate": 0.6}).fillna(0.5)


def normalize_weather(value: Optional[str]) -> str:
    if not value:
        return "No Preference"
    value = str(value).strip().lower()
    mapping = {
        "warm": "Tropical",
        "cool": "Cool",
        "cold": "Cold",
        "temperate": "Mild",
        "rainy": "Tropical",
        "no preference": "No Preference",
    }
    return mapping.get(value, value.title())


def guess_trip_type(user_preferences) -> str:
    mood = str(getattr(user_preferences, "mood", "") or "").lower()
    interests = [str(item).lower() for item in (getattr(user_preferences, "interests", []) or [])]

    if "romantic" in mood:
        return "Luxury & Romance"
    if "party" in mood:
        return "Beach & Sun"
    if "spiritual" in mood:
        return "Culture & History"
    if "adventurous" in mood or "trekking" in interests:
        return "Adventure & Outdoors"
    if "relaxed" in mood:
        return "Wellness & Spa"
    return "City Break"


def guess_month_from_preferences(user_preferences) -> str:
    weather = str(getattr(user_preferences, "weather_preference", "") or "").lower()
    if weather in {"cold", "cool"}:
        return "Dec"
    if weather in {"rainy"}:
        return "Jul"
    if weather in {"warm", "temperate"}:
        return "Oct"
    return "Nov"


def guess_season(month: str) -> str:
    month = str(month).strip().lower()
    if month in {"dec", "jan", "feb"}:
        return "Winter"
    if month in {"mar", "apr", "may"}:
        return "Spring"
    if month in {"jun", "jul", "aug"}:
        return "Summer"
    return "Autumn"


def classify_peak(month: str, best_months: str) -> str:
    month = str(month).strip()
    if month and month in str(best_months):
        return "Peak"
    return "Shoulder"
