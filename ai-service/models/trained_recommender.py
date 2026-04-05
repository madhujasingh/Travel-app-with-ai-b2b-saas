"""
Trained recommender built from package catalog + historical interaction data.
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

        weather_preference = str(getattr(user_preferences, "weather_preference", "") or "").strip().lower()
        mood_preference = str(getattr(user_preferences, "mood", "") or "").strip().lower()
        market_preference = str(getattr(user_preferences, "market_preference", "") or "").strip().lower()

        if weather_preference:
            candidate_features["weather_bonus"] = candidate_features.apply(
                lambda row: weather_bonus_score(weather_preference, str(row.get("weather_profile", ""))),
                axis=1,
            )
            candidate_features["predicted_score"] += candidate_features["weather_bonus"]

        if mood_preference:
            candidate_features["mood_bonus"] = candidate_features["mood_profile"].astype(str).str.lower().str.contains(mood_preference, regex=False).map({True: 0.08, False: -0.03})
            candidate_features["predicted_score"] += candidate_features["mood_bonus"]

        if market_preference:
            candidate_features["market_bonus"] = candidate_features["market"].astype(str).str.lower().eq(market_preference).map({True: 0.16, False: -0.18})
            candidate_features["predicted_score"] += candidate_features["market_bonus"]

        if getattr(user_preferences, "destination", None):
            destination_pref = str(user_preferences.destination).strip().lower()
            candidate_features["predicted_score"] += candidate_features["destination"].str.lower().eq(destination_pref) * 0.26
            candidate_features["predicted_score"] += candidate_features["destination"].str.lower().str.contains(destination_pref, regex=False) * 0.12

        candidate_features["predicted_score"] = np.clip(candidate_features["predicted_score"], 0, 1)

        ranked = candidate_features.sort_values("predicted_score", ascending=False)
        ranked = prioritize_destination_matches(
            ranked,
            getattr(user_preferences, "destination", None),
            limit=num_recommendations,
        )

        recommendations = []
        for _, row in ranked.iterrows():
            recommendations.append(
                {
                    "id": str(row["package_id"]),
                    "title": str(row["title"]),
                    "destination": row["destination"],
                    "price": float(row["price_inr"]),
                    "duration": f"{int(row['duration_days'])} Days / {max(int(row['duration_days']) - 1, 1)} Nights",
                    "rating": float(row["rating"]),
                    "match_score": round(float(row["predicted_score"]) * 100, 1),
                    "reasons": self._generate_reasons(user_preferences, row),
                    "image": self._image_for_trip_type(row["trip_type"]),
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
        seen_destinations = set()
        preferred_destination = str(getattr(user_preferences, "destination", "") or "").strip().lower()
        for item in recommendations:
            if preferred_destination and preferred_destination in item["destination"].lower():
                continue
            destination_key = str(item["destination"]).strip().lower()
            if destination_key in seen_destinations:
                continue
            seen_destinations.add(destination_key)
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
            "budget_inr",
            "num_travelers",
            "days_preferred",
            "price_inr",
            "duration_days",
            "rating",
            "review_count",
            "family_friendly_num",
            "solo_friendly_num",
            "honeymoon_popular_num",
            "group_friendly_num",
            "within_budget_num",
            "mood_alignment_num",
            "weather_alignment_num",
            "market_alignment_num",
            "traveler_type",
            "travel_style",
            "mood",
            "weather_preference",
            "trip_lane",
            "trip_month",
            "season",
            "peak_status",
            "destination_query",
            "title",
            "destination",
            "country",
            "market",
            "region",
            "trip_type",
            "package_tier",
            "weather_profile",
            "travel_style_bias",
            "family_friendly",
            "solo_friendly",
            "honeymoon_popular",
            "group_friendly",
            "admin_id",
            "interaction_type",
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
            "budget_inr",
            "num_travelers",
            "days_preferred",
            "price_inr",
            "duration_days",
            "rating",
            "review_count",
            "family_friendly_num",
            "solo_friendly_num",
            "honeymoon_popular_num",
            "group_friendly_num",
            "within_budget_num",
            "mood_alignment_num",
            "weather_alignment_num",
            "market_alignment_num",
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
            "packages": int(destinations_df["package_id"].nunique()) if "package_id" in destinations_df.columns else int(destinations_df.shape[0]),
            "destinations": int(destinations_df["destination"].nunique()) if "destination" in destinations_df.columns else int(destinations_df["destination_id"].nunique()),
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
        market_pref = str(getattr(user_preferences, "market_preference", "") or "").strip().lower()

        traveler_type = TRAVELER_TYPE_MAP.get(num_people, "group" if num_people >= 4 else "family")
        if getattr(user_preferences, "travel_style", "balanced") == "luxury":
            traveler_type = "couple" if num_people <= 2 else traveler_type

        preferred_weather = normalize_weather(getattr(user_preferences, "weather_preference", None))

        rows = destinations_df.copy()
        rows["budget_inr"] = user_budget
        rows["num_travelers"] = num_people
        rows["traveler_type"] = traveler_type
        rows["travel_style"] = str(getattr(user_preferences, "travel_style", "balanced") or "balanced")
        rows["mood"] = str(getattr(user_preferences, "mood", "") or "").lower()
        rows["weather_preference"] = preferred_weather
        rows["trip_lane"] = market_pref or rows["market"].str.lower()
        rows["trip_month"] = guess_month_from_preferences(user_preferences)
        rows["season"] = guess_season(rows["trip_month"].iloc[0])
        rows["peak_status"] = rows.apply(
            lambda row: classify_peak(str(row["trip_month"]), str(row.get("best_months", ""))),
            axis=1,
        )
        rows["within_budget_num"] = (
            (rows["price_inr"] <= user_budget).astype(float)
            if user_budget > 0
            else 1.0
        )
        rows["days_preferred"] = self._recommended_duration_days(user_preferences)
        rows["destination_query"] = destination_pref or ""
        rows["mood_alignment_num"] = rows["mood_profile"].astype(str).str.lower().str.contains(rows["mood"].iloc[0], regex=False).astype(float)
        rows["weather_alignment_num"] = rows.apply(
            lambda row: weather_alignment_score(str(row.get("weather_preference", "")), str(row.get("weather_profile", ""))),
            axis=1,
        )
        rows["market_alignment_num"] = rows.apply(
            lambda row: market_alignment_score(str(market_pref), str(row.get("market", ""))),
            axis=1,
        )
        rows["interaction_type"] = "predict"
        return rows

    def _generate_reasons(self, user_preferences, row: pd.Series) -> List[str]:
        reasons: List[str] = []
        preferred_destination = str(getattr(user_preferences, "destination", "") or "").strip().lower()
        if preferred_destination and preferred_destination in row["destination"].lower():
            reasons.append(f"Matches destination: {row['destination']}")

        budget = float(getattr(user_preferences, "budget", 0) or 0)
        if budget and row["price_inr"] <= budget:
            reasons.append("Fits your budget range")

        mood = str(getattr(user_preferences, "mood", "") or "").lower()
        package_moods = str(row.get("mood_profile", "") or "").lower()
        if mood and mood in package_moods:
            reasons.append(f"Supports your mood: {mood.title()}")

        trip_type = str(row.get("trip_type", "") or "")
        if trip_type:
            reasons.append(f"Great for {trip_type.lower()}")

        if float(row.get("rating", 0) or 0) >= 4.5:
            reasons.append(f"Top rated ({row['rating']}★)")

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

    interactions["travel_style"] = interactions["travel_style"].fillna("balanced").astype(str).str.strip().str.lower()
    interactions["mood"] = interactions["mood"].fillna("relaxed").astype(str).str.strip().str.lower()
    interactions["weather_preference"] = interactions["weather_preference"].fillna("temperate").astype(str).str.strip().str.lower()
    interactions["trip_lane"] = interactions["trip_lane"].fillna("").astype(str).str.strip().str.lower()
    interactions["destination_query"] = interactions["destination_query"].fillna("").astype(str).str.strip()
    interactions["interaction_type"] = interactions["interaction_type"].fillna("view").astype(str).str.strip().str.lower()
    interactions["interaction_strength"] = pd.to_numeric(interactions["interaction_strength"], errors="coerce").fillna(0.22)
    interactions["booked_num"] = interactions["booked"].map({"Yes": 1.0, "No": 0.0}).fillna(0.0)
    interactions["rating_given"] = pd.to_numeric(interactions["rating_given"], errors="coerce").fillna(4.0)
    interactions["budget_inr"] = pd.to_numeric(interactions["budget_inr"], errors="coerce").fillna(30000)
    interactions["num_people"] = pd.to_numeric(interactions["num_people"], errors="coerce").fillna(2).astype(int)
    interactions["num_travelers"] = interactions["num_people"]
    interactions["days_preferred"] = pd.to_numeric(interactions["days_preferred"], errors="coerce").fillna(5)
    interactions["season"] = interactions["trip_month"].apply(guess_season)
    interactions["traveler_type"] = interactions["num_people"].apply(map_traveler_type)

    merged = interactions.merge(destinations, on="package_id", how="inner")
    merged["peak_status"] = merged.apply(
        lambda row: classify_peak(str(row["trip_month"]), str(row.get("best_months", ""))),
        axis=1,
    )
    merged["within_budget_num"] = (merged["price_inr"] <= merged["budget_inr"]).astype(float)
    merged["mood_alignment_num"] = merged.apply(
        lambda row: contains_token(row["mood_profile"], row["mood"]),
        axis=1,
    )
    merged["weather_alignment_num"] = merged.apply(
        lambda row: weather_alignment_score(str(row["weather_preference"]), str(row["weather_profile"])),
        axis=1,
    )
    merged["market_alignment_num"] = merged.apply(
        lambda row: market_alignment_score(str(row["trip_lane"]), str(row["market"])),
        axis=1,
    )

    merged["affinity_score"] = np.clip(
        0.32 * merged["interaction_strength"]
        + 0.34 * merged["booked_num"]
        + 0.14 * (merged["rating_given"] / 5.0)
        + 0.08 * merged["within_budget_num"]
        + 0.08 * merged["mood_alignment_num"]
        + 0.14 * merged["weather_alignment_num"]
        + 0.06 * merged["market_alignment_num"],
        0,
        1,
    )
    return merged


def prepare_destinations_catalog(destinations_df: pd.DataFrame) -> pd.DataFrame:
    df = destinations_df.copy()
    if "package_id" not in df.columns:
        df["package_id"] = pd.to_numeric(df.get("destination_id"), errors="coerce").fillna(0).astype(int)
    df["title"] = df["title"].astype(str).str.strip()
    df["destination"] = df["destination"].astype(str).str.strip()
    df["price_inr"] = pd.to_numeric(df["price_inr"], errors="coerce").fillna(0)
    df["duration_days"] = pd.to_numeric(df["duration_days"], errors="coerce").fillna(4)
    df["rating"] = pd.to_numeric(df["rating"], errors="coerce").fillna(4.0)
    df["review_count"] = pd.to_numeric(df["review_count"], errors="coerce").fillna(0)
    df["family_friendly_num"] = map_yes_no(df["family_friendly"])
    df["solo_friendly_num"] = map_yes_no(df["solo_friendly"])
    df["honeymoon_popular_num"] = map_yes_no(df["honeymoon_popular"])
    df["group_friendly_num"] = map_yes_no(df["group_friendly"])
    return df


def map_yes_no(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip().map({"Yes": 1.0, "No": 0.0, "Moderate": 0.6}).fillna(0.5)


def normalize_weather(value: Optional[str]) -> str:
    if not value:
        return "temperate"
    value = str(value).strip().lower()
    mapping = {
        "warm": "warm",
        "cool": "cool",
        "cold": "cold",
        "temperate": "mild",
        "rainy": "rainy",
        "no preference": "temperate",
    }
    return mapping.get(value, value)


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


def prioritize_destination_matches(
    ranked_df: pd.DataFrame,
    destination_preference: Optional[str],
    limit: int,
) -> pd.DataFrame:
    destination = str(destination_preference or "").strip().lower()
    if not destination or ranked_df.empty:
        return ranked_df.head(limit)

    exact = ranked_df[ranked_df["destination"].str.lower() == destination]
    partial = ranked_df[
        ranked_df["destination"].str.lower().str.contains(destination, regex=False)
        & (ranked_df["destination"].str.lower() != destination)
    ]
    remainder = ranked_df[
        ~ranked_df.index.isin(exact.index)
        & ~ranked_df.index.isin(partial.index)
    ]

    prioritized = pd.concat([exact, partial, remainder], axis=0)
    return prioritized.head(limit)


def contains_token(haystack: Any, needle: Any) -> float:
    haystack_value = str(haystack or "").lower()
    needle_value = str(needle or "").lower().strip()
    if not needle_value:
        return 0.0
    return float(needle_value in haystack_value)


def weather_alignment_score(preferred: str, profile: str) -> float:
    preferred_value = str(preferred or "").lower().strip()
    profile_value = str(profile or "").lower().strip()
    if not preferred_value or preferred_value == "temperate":
        return 0.85 if profile_value in {"mild", "warm", "cool"} else 0.6
    if preferred_value == "warm":
        if profile_value == "warm":
            return 1.0
        if profile_value in {"mild", "rainy"}:
            return 0.45
        return 0.15
    if preferred_value == "cool":
        if profile_value == "cool":
            return 1.0
        if profile_value == "cold":
            return 0.92
        if profile_value == "mild":
            return 0.45
        return 0.15
    if preferred_value == "cold":
        if profile_value == "cold":
            return 1.0
        if profile_value == "cool":
            return 0.94
        return 0.08
    if preferred_value == "rainy":
        return 1.0 if profile_value == "rainy" else 0.2
    return 0.4


def weather_bonus_score(preferred: str, profile: str) -> float:
    alignment = weather_alignment_score(preferred, profile)
    if alignment >= 0.95:
        return 0.18
    if alignment >= 0.8:
        return 0.12
    if alignment >= 0.6:
        return 0.02
    if alignment >= 0.35:
        return -0.08
    return -0.18


def market_alignment_score(preferred_market: str, actual_market: str) -> float:
    preferred_value = str(preferred_market or "").lower().strip()
    actual_value = str(actual_market or "").lower().strip()
    if not preferred_value:
        return 1.0
    return float(preferred_value == actual_value)


def map_traveler_type(num_people: int) -> str:
    if num_people <= 1:
        return "solo"
    if num_people == 2:
        return "couple"
    if num_people >= 4:
        return "group"
    return "family"
