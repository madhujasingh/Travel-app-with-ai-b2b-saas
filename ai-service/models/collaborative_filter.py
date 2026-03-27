"""
Collaborative Filtering Model
Recommends based on similar users' preferences
"""

import pandas as pd
import numpy as np
from typing import List, Dict
from sklearn.metrics.pairwise import cosine_similarity


class CollaborativeFilter:
    def __init__(self):
        self.user_item_matrix = None

    def recommend(
        self,
        user_preferences,
        itineraries_df: pd.DataFrame,
        num_recommendations: int = 5
    ) -> List[Dict]:
        """
        Collaborative filtering recommendation
        Simulates user-user similarity based on preferences
        """
        # Create synthetic user-item interactions
        user_profiles = self._create_user_profiles(itineraries_df)

        # Find similar users
        user_vector = self._create_user_vector(user_preferences, itineraries_df)
        similarities = cosine_similarity([user_vector], user_profiles)[0]

        # Weight itineraries by similarity
        weighted_scores = np.zeros(len(itineraries_df))

        for i, sim in enumerate(similarities):
            if sim > 0:
                weighted_scores += user_profiles[i] * sim

        # Normalize
        if weighted_scores.max() > 0:
            weighted_scores = weighted_scores / weighted_scores.max()

        # Get top recommendations
        top_indices = np.argsort(weighted_scores)[::-1][:num_recommendations]

        recommendations = []
        for idx in top_indices:
            itinerary = itineraries_df.iloc[idx]
            recommendations.append({
                "id": str(itinerary['id']),
                "title": itinerary['title'],
                "destination": itinerary['destination'],
                "price": float(itinerary['price']),
                "duration": itinerary['duration'],
                "rating": float(itinerary['rating']),
                "match_score": round(float(weighted_scores[idx]) * 100, 1),
                "reasons": ["Users with similar preferences enjoyed this"],
                "image": itinerary['image']
            })

        return recommendations

    def _create_user_profiles(self, df: pd.DataFrame) -> np.ndarray:
        """Create synthetic user profiles based on itinerary features"""
        profiles = []

        for _, row in df.iterrows():
            profile = [
                row['price'] / 100000,  # Normalized price
                row['rating'] / 5.0,    # Normalized rating
                1.0 if row['type'] == 'beach' else 0.0,
                1.0 if row['type'] == 'adventure' else 0.0,
                1.0 if row['type'] == 'cultural' else 0.0,
                1.0 if row['type'] == 'luxury' else 0.0,
            ]
            profiles.append(profile)

        return np.array(profiles)

    def _create_user_vector(self, preferences, df: pd.DataFrame) -> np.ndarray:
        """Create user preference vector"""
        budget_norm = preferences.budget / 100000

        # Determine preferred type from interests
        interests = preferences.interests or []
        type_scores = {
            'beach': 1.0 if any(i in ['beach', 'water_sports'] for i in interests) else 0.0,
            'adventure': 1.0 if any(i in ['trekking', 'adventure'] for i in interests) else 0.0,
            'cultural': 1.0 if any(i in ['history', 'culture'] for i in interests) else 0.0,
            'luxury': 1.0 if preferences.travel_style == 'luxury' else 0.0,
        }

        return np.array([
            budget_norm,
            0.8,  # Assume high rating preference
            type_scores['beach'],
            type_scores['adventure'],
            type_scores['cultural'],
            type_scores['luxury'],
        ])
