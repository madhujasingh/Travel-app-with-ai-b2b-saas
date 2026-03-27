"""
Hybrid Recommendation Engine
Combines collaborative and content-based filtering for optimal recommendations
"""

import pandas as pd
import numpy as np
from typing import List, Dict, Optional


class RecommendationEngine:
    def __init__(self):
        pass

    def hybrid_recommend(
        self,
        user_preferences,
        itineraries_df: pd.DataFrame,
        num_recommendations: int = 5
    ) -> List[Dict]:
        """
        Hybrid recommendation combining multiple strategies
        """
        # Calculate scores using different methods
        budget_scores = self._calculate_budget_match(user_preferences, itineraries_df)
        interest_scores = self._calculate_interest_match(user_preferences, itineraries_df)
        popularity_scores = self._calculate_popularity_score(itineraries_df)
        destination_scores = self._calculate_destination_match(user_preferences, itineraries_df)
        mood_scores = self._calculate_tag_match(getattr(user_preferences, "mood", None), itineraries_df, "mood_tags")
        weather_scores = self._calculate_tag_match(
            getattr(user_preferences, "weather_preference", None),
            itineraries_df,
            "weather_tags"
        )

        # Weighted combination
        destination_pref = getattr(user_preferences, "destination", None)
        destination_given = bool(destination_pref and str(destination_pref).strip() and str(destination_pref).strip().lower() not in {"any", "unknown", "surprise"})

        if destination_given:
            weights = {
                'budget': 0.26,
                'interest': 0.28,
                'popularity': 0.12,
                'destination': 0.20,
                'mood': 0.07,
                'weather': 0.07,
            }
        else:
            # "I don't know where to go" mode emphasizes discovery + vibe fit.
            weights = {
                'budget': 0.24,
                'interest': 0.26,
                'popularity': 0.18,
                'destination': 0.06,
                'mood': 0.14,
                'weather': 0.12,
            }

        final_scores = (
            budget_scores * weights['budget'] +
            interest_scores * weights['interest'] +
            popularity_scores * weights['popularity'] +
            destination_scores * weights['destination'] +
            mood_scores * weights['mood'] +
            weather_scores * weights['weather']
        )

        # Get top recommendations
        top_indices = np.argsort(final_scores)[::-1][:num_recommendations]

        recommendations = []
        for idx in top_indices:
            itinerary = itineraries_df.iloc[idx]
            reasons = self._generate_reasons(
                user_preferences,
                itinerary,
                budget_scores[idx],
                interest_scores[idx],
                destination_scores[idx]
            )

            recommendations.append({
                "id": str(itinerary['id']),
                "title": itinerary['title'],
                "destination": itinerary['destination'],
                "price": float(itinerary['price']),
                "duration": itinerary['duration'],
                "rating": float(itinerary['rating']),
                "match_score": round(float(final_scores[idx]) * 100, 1),
                "reasons": reasons,
                "image": itinerary['image']
            })

        return recommendations

    def _calculate_budget_match(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """Calculate how well each itinerary matches the budget"""
        budget = preferences.budget
        prices = df['price'].values

        # Gaussian-like scoring: perfect match at budget, decreasing as deviation increases
        budget_scores = np.exp(-((prices - budget) ** 2) / (2 * (budget * 0.3) ** 2))

        # Apply travel style modifier
        if preferences.travel_style == "budget":
            budget_scores = np.where(prices <= budget, 1.0, budget_scores * 0.5)
        elif preferences.travel_style == "luxury":
            budget_scores = np.where(prices >= budget * 0.8, budget_scores * 1.2, budget_scores)

        return np.clip(budget_scores, 0, 1)

    def _calculate_interest_match(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """Calculate interest similarity using TF-IDF-like approach"""
        user_interests = set(preferences.interests) if preferences.interests else set()

        if not user_interests:
            return np.ones(len(df)) * 0.5

        scores = []
        for _, row in df.iterrows():
            itinerary_interests = set(row.get('interests', []))
            if not itinerary_interests:
                scores.append(0.3)
                continue

            # Jaccard similarity
            intersection = len(user_interests & itinerary_interests)
            union = len(user_interests | itinerary_interests)
            similarity = intersection / union if union > 0 else 0
            scores.append(similarity)

        return np.array(scores)

    def _calculate_popularity_score(self, df: pd.DataFrame) -> np.ndarray:
        """Calculate popularity based on ratings"""
        ratings = df['rating'].values
        # Normalize to 0-1 range
        return (ratings - ratings.min()) / (ratings.max() - ratings.min() + 1e-6)

    def _calculate_destination_match(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """Calculate destination relevance"""
        destination_value = getattr(preferences, "destination", "") or ""
        destination = str(destination_value).strip().lower()
        if not destination or destination in {"any", "unknown", "surprise"}:
            return np.ones(len(df)) * 0.5

        scores = []
        for _, row in df.iterrows():
            if destination in row['destination'].lower():
                scores.append(1.0)
            elif row['destination'].lower() in destination:
                scores.append(0.8)
            else:
                scores.append(0.2)

        return np.array(scores)

    def _calculate_tag_match(self, preference_value: Optional[str], df: pd.DataFrame, column: str) -> np.ndarray:
        """Generic tag matching for mood/weather style categorical signals."""
        if preference_value is None:
            return np.ones(len(df)) * 0.5

        pref = str(preference_value).strip().lower()
        if not pref or pref in {"any", "no preference"}:
            return np.ones(len(df)) * 0.5

        scores = []
        for _, row in df.iterrows():
            tags = [str(t).strip().lower() for t in row.get(column, [])]
            if pref in tags:
                scores.append(1.0)
            elif tags:
                scores.append(0.35)
            else:
                scores.append(0.5)
        return np.array(scores)

    def _generate_reasons(
        self,
        preferences,
        itinerary,
        budget_score,
        interest_score,
        destination_score
    ) -> List[str]:
        """Generate human-readable reasons for recommendation"""
        reasons = []

        if destination_score > 0.7:
            reasons.append(f"Matches your destination: {itinerary['destination']}")

        if budget_score > 0.8:
            reasons.append("Perfect fit for your budget")
        elif budget_score > 0.5:
            reasons.append("Good value for money")

        if interest_score > 0.5:
            reasons.append("Matches your travel interests")

        mood_pref = getattr(preferences, "mood", None)
        if mood_pref:
            tags = [str(t).strip().lower() for t in itinerary.get("mood_tags", [])]
            if str(mood_pref).strip().lower() in tags:
                reasons.append(f"Matches your mood: {mood_pref}")

        weather_pref = getattr(preferences, "weather_preference", None)
        if weather_pref:
            tags = [str(t).strip().lower() for t in itinerary.get("weather_tags", [])]
            if str(weather_pref).strip().lower() in tags:
                reasons.append(f"Fits your weather preference: {weather_pref}")

        if itinerary['rating'] >= 4.5:
            reasons.append(f"Highly rated ({itinerary['rating']}⭐)")

        if not reasons:
            reasons.append("Popular choice among travelers")

        return reasons[:3]

    def generate_insights(self, preferences, itineraries_df: pd.DataFrame, top_recommendations: List[Dict]) -> Dict:
        """Create extra recommendation insights: budget stretch + destination discovery."""
        budget = float(getattr(preferences, "budget", 0) or 0)
        stretch_limit = budget + 10000

        # Budget stretch suggestions (₹10,000 uplift band).
        stretch_df = itineraries_df[
            (itineraries_df["price"] > budget) &
            (itineraries_df["price"] <= stretch_limit)
        ].sort_values(["rating", "price"], ascending=[False, True]).head(3)

        budget_upgrade_suggestions = []
        for _, row in stretch_df.iterrows():
            delta = int(float(row["price"]) - budget)
            budget_upgrade_suggestions.append({
                "id": str(row["id"]),
                "title": row["title"],
                "destination": row["destination"],
                "price": float(row["price"]),
                "extra_budget_required": max(delta, 0),
                "reason": f"If you increase budget by about ₹{max(delta, 0):,}, this becomes available."
            })

        # Destination discovery for users unsure where to go.
        destination_value = getattr(preferences, "destination", "") or ""
        destination = str(destination_value).strip().lower()
        destination_unknown = (not destination) or destination in {"any", "unknown", "surprise"}

        destination_discovery = []
        if destination_unknown:
            discovery_df = itineraries_df.sort_values(["rating", "price"], ascending=[False, True])
            seen = set()
            for _, row in discovery_df.iterrows():
                dest = str(row["destination"])
                if dest in seen:
                    continue
                seen.add(dest)
                destination_discovery.append({
                    "destination": dest,
                    "sample_itinerary": row["title"],
                    "starting_price": float(row["price"]),
                    "rating": float(row["rating"]),
                })
                if len(destination_discovery) >= 5:
                    break

        return {
            "budget_upgrade_suggestions": budget_upgrade_suggestions,
            "destination_discovery": destination_discovery,
            "destination_mode": "discovery" if destination_unknown else "specific",
            "top_match_count": len(top_recommendations),
        }
