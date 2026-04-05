"""
Generate an app-shaped synthetic package catalog and interaction dataset.

Usage:
python generate_app_dataset.py \
  --catalog data/app_packages.csv \
  --interactions data/app_package_interactions.csv
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import List

import numpy as np
import pandas as pd


SEED = 42


@dataclass(frozen=True)
class DestinationProfile:
    destination: str
    country: str
    market: str
    region: str
    weather_profile: str
    primary_trip_type: str
    mood_profile: str
    ideal_for: str
    tags: str
    best_months: str
    base_price_inr: int
    family_friendly: str
    solo_friendly: str
    honeymoon_popular: str
    group_friendly: str


DESTINATIONS: List[DestinationProfile] = [
    DestinationProfile("Paris", "France", "INTERNATIONAL", "Europe", "mild", "Culture & History", "romantic,curious,polished", "couples,culture lovers", "eiffel,museums,cafes,luxury", "Apr,May,Jun,Sep,Oct", 89000, "Yes", "Yes", "Yes", "Moderate"),
    DestinationProfile("Tokyo", "Japan", "INTERNATIONAL", "East Asia", "mild", "City Break", "curious,energetic,immersive", "foodies,city explorers", "food,shopping,city,technology", "Mar,Apr,May,Oct,Nov", 96000, "Yes", "Yes", "Moderate", "Yes"),
    DestinationProfile("Dubai", "UAE", "INTERNATIONAL", "Middle East", "warm", "Luxury & Romance", "luxury,party,glossy", "families,luxury travelers", "shopping,desert,skyline,luxury", "Nov,Dec,Jan,Feb,Mar", 76000, "Yes", "Moderate", "Yes", "Yes"),
    DestinationProfile("Bali", "Indonesia", "INTERNATIONAL", "Southeast Asia", "warm", "Beach & Sun", "romantic,relaxed,soulful", "honeymooners,wellness travelers", "beach,temples,wellness,nature", "Apr,May,Jun,Jul,Aug,Sep,Oct", 64000, "Yes", "Yes", "Yes", "Yes"),
    DestinationProfile("Maldives", "Maldives", "INTERNATIONAL", "Indian Ocean", "warm", "Luxury & Romance", "romantic,luxury,calm", "honeymooners,luxury travelers", "island,lagoon,private,overwater", "Nov,Dec,Jan,Feb,Mar,Apr", 118000, "Moderate", "Moderate", "Yes", "Moderate"),
    DestinationProfile("Singapore", "Singapore", "INTERNATIONAL", "Southeast Asia", "warm", "City Break", "efficient,curious,modern", "families,urban travelers", "city,food,theme parks,shopping", "Feb,Mar,Apr", 72000, "Yes", "Yes", "Moderate", "Yes"),
    DestinationProfile("Thailand", "Thailand", "INTERNATIONAL", "Southeast Asia", "warm", "Beach & Sun", "party,relaxed,lively", "friend groups,couples", "islands,nightlife,street food,beaches", "Nov,Dec,Jan,Feb,Mar", 59000, "Yes", "Yes", "Moderate", "Yes"),
    DestinationProfile("Switzerland", "Switzerland", "INTERNATIONAL", "Europe", "cold", "Adventure & Outdoors", "scenic,refined,calm,relaxed", "couples,nature lovers", "alps,trains,snow,lakes", "Jun,Jul,Aug,Dec,Jan,Feb", 125000, "Yes", "Moderate", "Yes", "Moderate"),
    DestinationProfile("Jaipur", "India", "INDIA", "Rajasthan", "warm", "Culture & History", "curious,royal,colorful", "families,culture lovers", "forts,palaces,markets,heritage", "Oct,Nov,Dec,Jan,Feb,Mar", 24000, "Yes", "Yes", "Moderate", "Yes"),
    DestinationProfile("Goa", "India", "INDIA", "Goa", "warm", "Beach & Sun", "relaxed,party,beachy", "friends,couples", "beaches,cafes,nightlife,water sports", "Nov,Dec,Jan,Feb", 27000, "Yes", "Yes", "Moderate", "Yes"),
    DestinationProfile("Kerala", "India", "INDIA", "Kerala", "rainy", "Wellness & Spa", "relaxed,healing,lush", "couples,wellness travelers", "backwaters,wellness,houseboats,nature", "Sep,Oct,Nov,Dec,Jan,Feb,Mar", 32000, "Yes", "Yes", "Yes", "Yes"),
    DestinationProfile("Manali", "India", "INDIA", "Himachal Pradesh", "cool", "Adventure & Outdoors", "adventurous,scenic,cool,relaxed", "couples,adventure travelers", "mountains,snow,road trips,trekking", "Oct,Nov,Dec,Jan,Feb,Mar,Apr,May,Jun", 28000, "Moderate", "Yes", "Yes", "Yes"),
    DestinationProfile("Varanasi", "India", "INDIA", "Uttar Pradesh", "warm", "Culture & History", "spiritual,curious,reflective", "solo travelers,culture lovers", "ghats,rituals,history,temples", "Oct,Nov,Dec,Jan,Feb,Mar", 21000, "Moderate", "Yes", "Moderate", "Moderate"),
    DestinationProfile("Udaipur", "India", "INDIA", "Rajasthan", "warm", "Luxury & Romance", "romantic,polished,calm", "couples,culture lovers", "lakes,palaces,heritage,romance", "Oct,Nov,Dec,Jan,Feb,Mar", 26000, "Yes", "Moderate", "Yes", "Moderate"),
    DestinationProfile("Shimla", "India", "INDIA", "Himachal Pradesh", "cool", "Adventure & Outdoors", "scenic,calm,nostalgic,relaxed", "families,couples", "hills,walks,pines,views", "Oct,Nov,Dec,Jan,Feb,Mar,Apr,May,Jun", 23000, "Yes", "Moderate", "Moderate", "Yes"),
    DestinationProfile("Agra", "India", "INDIA", "Uttar Pradesh", "warm", "Culture & History", "curious,classic,heritage", "families,short-break travelers", "taj mahal,monuments,heritage,history", "Oct,Nov,Dec,Jan,Feb,Mar", 22000, "Yes", "Yes", "Moderate", "Moderate"),
]


PACKAGE_VARIANTS = [
    {
        "name": "Essentials Escape",
        "tier": "BUDGET",
        "price_bump": 0,
        "duration_days": 4,
        "rating_bump": 0.0,
        "travel_style_bias": "budget",
    },
    {
        "name": "Signature Journey",
        "tier": "PREMIUM",
        "price_bump": 9000,
        "duration_days": 5,
        "rating_bump": 0.15,
        "travel_style_bias": "balanced",
    },
    {
        "name": "Premium Discovery",
        "tier": "PREMIUM_PLUS",
        "price_bump": 18000,
        "duration_days": 6,
        "rating_bump": 0.25,
        "travel_style_bias": "luxury",
    },
]


TRAVEL_STYLES = ["budget", "balanced", "luxury"]
MOODS = ["relaxed", "adventurous", "romantic", "party", "spiritual", "curious"]
WEATHER_PREFS = ["warm", "cool", "cold", "temperate", "rainy"]
INTERACTION_TYPES = {
    "view": 0.22,
    "save": 0.48,
    "agent_chat": 0.62,
    "group_vote": 0.56,
    "book": 0.94,
}
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
ADMIN_IDS = ["admin_west", "admin_curated", "admin_premium", "admin_b2b"]


def build_package_catalog() -> pd.DataFrame:
    rows = []
    package_id = 1001
    for destination_index, destination in enumerate(DESTINATIONS):
        for variant_index, variant in enumerate(PACKAGE_VARIANTS):
            rows.append(
                {
                    "package_id": package_id,
                    "title": f"{destination.destination} {variant['name']}",
                    "destination": destination.destination,
                    "country": destination.country,
                    "market": destination.market,
                    "region": destination.region,
                    "trip_type": destination.primary_trip_type,
                    "package_tier": variant["tier"],
                    "price_inr": destination.base_price_inr + variant["price_bump"],
                    "duration_days": variant["duration_days"],
                    "rating": round(4.25 + variant["rating_bump"] + ((destination_index + variant_index) % 3) * 0.08, 2),
                    "review_count": 12 + destination_index * 4 + variant_index * 7,
                    "best_months": destination.best_months,
                    "weather_profile": destination.weather_profile,
                    "mood_profile": destination.mood_profile,
                    "ideal_for": destination.ideal_for,
                    "tags": destination.tags,
                    "family_friendly": destination.family_friendly,
                    "solo_friendly": destination.solo_friendly,
                    "honeymoon_popular": destination.honeymoon_popular,
                    "group_friendly": destination.group_friendly,
                    "admin_id": ADMIN_IDS[(destination_index + variant_index) % len(ADMIN_IDS)],
                    "travel_style_bias": variant["travel_style_bias"],
                }
            )
            package_id += 1
    return pd.DataFrame(rows)


def _alignment_score(package: pd.Series, mood: str, weather_pref: str, travel_style: str, trip_lane: str, budget: int, num_people: int, trip_month: str, destination_query: str) -> float:
    score = 0.12

    if mood and mood in str(package["mood_profile"]).lower():
        score += 0.26
    if weather_pref and (weather_pref == str(package["weather_profile"]).lower() or (weather_pref == "temperate" and package["weather_profile"] == "mild")):
        score += 0.18
    if travel_style == package["travel_style_bias"]:
        score += 0.12
    if trip_lane and trip_lane == str(package["market"]).lower():
        score += 0.17
    if budget >= int(package["price_inr"]):
        score += 0.16
    elif budget >= int(package["price_inr"]) * 0.85:
        score += 0.07
    if num_people >= 4 and str(package["group_friendly"]).lower() == "yes":
        score += 0.08
    if num_people == 1 and str(package["solo_friendly"]).lower() == "yes":
        score += 0.07
    if num_people == 2 and mood == "romantic" and str(package["honeymoon_popular"]).lower() == "yes":
        score += 0.08
    if destination_query and destination_query.lower() == str(package["destination"]).lower():
        score += 0.28
    if trip_month in str(package["best_months"]):
        score += 0.06

    return float(np.clip(score, 0.0, 1.0))


def build_interactions(packages_df: pd.DataFrame, interaction_count: int) -> pd.DataFrame:
    rng = np.random.default_rng(SEED)
    destination_names = packages_df["destination"].unique().tolist()
    rows = []

    for interaction_id in range(1, interaction_count + 1):
        user_id = f"user_{rng.integers(1000, 9999)}"
        num_people = int(rng.choice([1, 2, 3, 4, 5, 6], p=[0.12, 0.34, 0.14, 0.18, 0.12, 0.10]))
        travel_style = str(rng.choice(TRAVEL_STYLES, p=[0.32, 0.48, 0.20]))
        mood = str(rng.choice(MOODS, p=[0.22, 0.18, 0.16, 0.14, 0.12, 0.18]))
        weather_pref = str(rng.choice(WEATHER_PREFS, p=[0.30, 0.18, 0.08, 0.26, 0.18]))
        trip_lane = str(rng.choice(["india", "international"], p=[0.58, 0.42]))
        trip_month = str(rng.choice(MONTHS))
        days_preferred = int(rng.choice([3, 4, 5, 6, 7], p=[0.10, 0.28, 0.34, 0.18, 0.10]))

        base_budget = int(rng.normal(32000, 9000)) if trip_lane == "india" else int(rng.normal(85000, 22000))
        budget_inr = max(15000, base_budget)

        eligible_market_packages = packages_df[packages_df["market"].str.lower() == trip_lane]
        if rng.random() < 0.66:
            package = eligible_market_packages.sample(1, random_state=int(rng.integers(0, 1_000_000))).iloc[0]
            destination_query = package["destination"] if rng.random() < 0.72 else str(rng.choice(destination_names))
        else:
            package = packages_df.sample(1, random_state=int(rng.integers(0, 1_000_000))).iloc[0]
            destination_query = str(rng.choice(destination_names)) if rng.random() < 0.45 else ""

        affinity = _alignment_score(
            package=package,
            mood=mood,
            weather_pref=weather_pref,
            travel_style=travel_style,
            trip_lane=trip_lane,
            budget=budget_inr,
            num_people=num_people,
            trip_month=trip_month,
            destination_query=destination_query,
        )

        interaction_type = str(rng.choice(list(INTERACTION_TYPES.keys()), p=[0.42, 0.18, 0.16, 0.12, 0.12]))
        interaction_strength = INTERACTION_TYPES[interaction_type]
        booked_probability = affinity * 0.62 + interaction_strength * 0.28
        booked = "Yes" if rng.random() < booked_probability else "No"

        rating_given = np.clip(2.8 + affinity * 2.1 + rng.normal(0, 0.28), 1.0, 5.0)
        if booked == "Yes":
            rating_given = np.clip(rating_given + 0.3, 1.0, 5.0)

        rows.append(
            {
                "interaction_id": interaction_id,
                "user_id": user_id,
                "package_id": int(package["package_id"]),
                "budget_inr": budget_inr,
                "num_people": num_people,
                "travel_style": travel_style,
                "mood": mood,
                "weather_preference": weather_pref,
                "trip_lane": trip_lane,
                "destination_query": destination_query,
                "interaction_type": interaction_type,
                "interaction_strength": round(float(interaction_strength), 2),
                "booked": booked,
                "rating_given": round(float(rating_given), 2),
                "trip_month": trip_month,
                "days_preferred": days_preferred,
            }
        )

    return pd.DataFrame(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", default="data/app_packages.csv")
    parser.add_argument("--interactions", default="data/app_package_interactions.csv")
    parser.add_argument("--interaction-count", type=int, default=14000)
    args = parser.parse_args()

    catalog_path = Path(args.catalog)
    interactions_path = Path(args.interactions)
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    interactions_path.parent.mkdir(parents=True, exist_ok=True)

    catalog_df = build_package_catalog()
    interactions_df = build_interactions(catalog_df, args.interaction_count)

    catalog_df.to_csv(catalog_path, index=False)
    interactions_df.to_csv(interactions_path, index=False)

    print(
        {
            "status": "ok",
            "catalog_rows": int(len(catalog_df)),
            "interaction_rows": int(len(interactions_df)),
            "catalog_path": str(catalog_path),
            "interactions_path": str(interactions_path),
        }
    )


if __name__ == "__main__":
    main()
