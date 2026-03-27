"""
Content-Based Filtering Model
Recommends based on item features and user preferences
"""

import pandas as pd
import numpy as np
from typing import List, Dict
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class ContentBasedFilter:
    def __init__(self):
        self.tfidf = TfidfVectorizer(stop_words='english')

    def recommend(
        self,
        user_preferences,
        itineraries_df: pd.DataFrame,
        num_recommendations: int = 5
    ) -> List[Dict]:
        """
        Content-based recommendation using feature similarity
        """
        # Create feature vectors for itineraries
        feature_vectors = self._create_feature_vectors(itineraries_df)

        # Create user preference vector
        user_vector = self._create_user_preference_vector(user_preferences, itineraries_df)

        # Calculate similarity
        similarities = cosine_similarity([user_vector], feature_vectors)[0]

        # Get top recommendations
        top_indices = np.argsort(similarities)[::-1][:num_recommendations]

        recommendations = []
        for idx in top_indices:
            itinerary = itineraries_df.iloc[idx]
            reasons = self._generate_content_reasons(
                user_preferences,
                itinerary,
                similarities[idx]
            )

            recommendations.append({
                "id": str(itinerary['id']),
                "title": itinerary['title'],
                "destination": itinerary['destination'],
                "price": float(itinerary['price']),
                "duration": itinerary['duration'],
                "rating": float(itinerary['rating']),
                "match_score": round(float(similarities[idx]) * 100, 1),
                "reasons": reasons,
                "image": itinerary['image']
            })

        return recommendations

    def find_similar(
        self,
        itinerary_id: str,
        df: pd.DataFrame,
        limit: int = 5
    ) -> List[Dict]:
        """Find similar itineraries to a given one"""
        feature_vectors = self._create_feature_vectors(df)

        # Find the index of the given itinerary
        idx = df[df['id'] == itinerary_id].index
        if len(idx) == 0:
            return []

        idx = idx[0]
        target_vector = feature_vectors[idx]

        # Calculate similarity with all others
        similarities = cosine_similarity([target_vector], feature_vectors)[0]

        # Get top similar (excluding itself)
        similar_indices = np.argsort(similarities)[::-1][1:limit+1]

        results = []
        for i in similar_indices:
            itinerary = df.iloc[i]
            results.append({
                "id": str(itinerary['id']),
                "title": itinerary['title'],
                "destination": itinerary['destination'],
                "price": float(itinerary['price']),
                "similarity_score": round(float(similarities[i]) * 100, 1),
                "image": itinerary['image']
            })

        return results

    def _create_feature_vectors(self, df: pd.DataFrame) -> np.ndarray:
        """Create feature vectors from itinerary attributes"""
        features = []

        for _, row in df.iterrows():
            # Combine text features
            interests_text = ' '.join(row.get('interests', []))
            feature_text = f"{row['destination']} {row['type']} {interests_text}"
            features.append(feature_text)

        # Create TF-IDF vectors
        tfidf_matrix = self.tfidf.fit_transform(features)

        # Add numerical features
        numerical_features = []
        for _, row in df.iterrows():
            numerical_features.append([
                row['price'] / 100000,
                row['rating'] / 5.0,
            ])

        numerical_array = np.array(numerical_features)

        # Combine TF-IDF and numerical features
        combined = np.hstack([
            tfidf_matrix.toarray(),
            numerical_array
        ])

        return combined

    def _create_user_preference_vector(
        self,
        preferences,
        df: pd.DataFrame
    ) -> np.ndarray:
        """Create user preference vector matching feature space"""
        # Create text from preferences
        interests_text = ' '.join(preferences.interests) if preferences.interests else ''
        destination = preferences.destination if preferences.destination else ''

        user_text = f"{destination} {interests_text}"

        # Transform using same TF-IDF
        user_tfidf = self.tfidf.transform([user_text])

        # Add numerical preferences
        user_numerical = np.array([[
            preferences.budget / 100000,
            0.8,  # Assume high rating preference
        ]])

        # Combine
        combined = np.hstack([
            user_tfidf.toarray(),
            user_numerical
        ])

        return combined[0]

    def _generate_content_reasons(
        self,
        preferences,
        itinerary,
        similarity_score
    ) -> List[str]:
        """Generate reasons based on content similarity"""
        reasons = []

        if preferences.destination and preferences.destination.lower() in itinerary['destination'].lower():
            reasons.append(f"Located in {itinerary['destination']}")

        if preferences.interests:
            matching_interests = set(preferences.interests) & set(itinerary.get('interests', []))
            if matching_interests:
                reasons.append(f"Matches interests: {', '.join(list(matching_interests)[:2])}")

        if similarity_score > 0.7:
            reasons.append("Highly similar to your preferences")

        if itinerary['rating'] >= 4.5:
            reasons.append(f"Top rated ({itinerary['rating']}⭐)")

        if not reasons:
            reasons.append("Recommended based on your search")

        return reasons[:3]
