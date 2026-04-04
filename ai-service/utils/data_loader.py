"""
Data Loader Utility
Handles data loading and preprocessing for the AI service.
"""

import json
from pathlib import Path

import pandas as pd


class DataLoader:
    def __init__(self):
        self.itineraries_cache = None

    def load_itineraries(self, source: str = "sample") -> pd.DataFrame:
        """Load itineraries from various sources"""
        if source == "sample":
            return self._load_sample_data()
        elif source == "api":
            return self._load_from_api()
        else:
            return self._load_from_file(source)

    def _load_sample_data(self) -> pd.DataFrame:
        """Load sample itinerary data"""
        sample_data = [
            {
                "id": "1",
                "title": "Jaipur Heritage Tour - 3 Days",
                "destination": "Jaipur",
                "price": 15000,
                "duration": "3 Days / 2 Nights",
                "rating": 4.5,
                "type": "cultural",
                "interests": ["history", "culture", "architecture"],
                "image": "🏰"
            },
            {
                "id": "2",
                "title": "Goa Beach Paradise - 5 Days",
                "destination": "Goa",
                "price": 25000,
                "duration": "5 Days / 4 Nights",
                "rating": 4.7,
                "type": "beach",
                "interests": ["beach", "nightlife", "water_sports"],
                "image": "🏖️"
            },
            {
                "id": "3",
                "title": "Kerala Backwaters - 4 Days",
                "destination": "Kerala",
                "price": 20000,
                "duration": "4 Days / 3 Nights",
                "rating": 4.6,
                "type": "nature",
                "interests": ["nature", "ayurveda", "houseboat"],
                "image": "🌴"
            },
            {
                "id": "4",
                "title": "Manali Adventure - 6 Days",
                "destination": "Manali",
                "price": 18000,
                "duration": "6 Days / 5 Nights",
                "rating": 4.4,
                "type": "adventure",
                "interests": ["trekking", "adventure", "mountains"],
                "image": "🏔️"
            },
            {
                "id": "5",
                "title": "Paris Romance - 7 Days",
                "destination": "Paris",
                "price": 85000,
                "duration": "7 Days / 6 Nights",
                "rating": 4.9,
                "type": "romantic",
                "interests": ["romance", "culture", "food"],
                "image": "🗼"
            },
            {
                "id": "6",
                "title": "Dubai Luxury - 5 Days",
                "destination": "Dubai",
                "price": 65000,
                "duration": "5 Days / 4 Nights",
                "rating": 4.8,
                "type": "luxury",
                "interests": ["shopping", "luxury", "modern"],
                "image": "🏙️"
            },
            {
                "id": "7",
                "title": "Varanasi Spiritual - 3 Days",
                "destination": "Varanasi",
                "price": 12000,
                "duration": "3 Days / 2 Nights",
                "rating": 4.3,
                "type": "spiritual",
                "interests": ["spirituality", "culture", "history"],
                "image": "🛕"
            },
            {
                "id": "8",
                "title": "Bali Island Hopping - 6 Days",
                "destination": "Bali",
                "price": 45000,
                "duration": "6 Days / 5 Nights",
                "rating": 4.7,
                "type": "beach",
                "interests": ["beach", "culture", "nature"],
                "image": "🏝️"
            }
        ]

        return pd.DataFrame(sample_data)

    def _load_from_api(self) -> pd.DataFrame:
        """Load data from Spring Boot backend API"""
        # In production, this would call the backend API
        # For now, return sample data
        return self._load_sample_data()

    def _load_from_file(self, filepath: str) -> pd.DataFrame:
        """Load data from JSON/CSV file"""
        if filepath.endswith('.json'):
            with open(filepath, 'r') as f:
                data = json.load(f)
            return pd.DataFrame(data)
        elif filepath.endswith('.csv'):
            return pd.read_csv(filepath)
        else:
            raise ValueError(f"Unsupported file format: {filepath}")

    def preprocess_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Preprocess data for ML models"""
        # Handle missing values
        df = df.fillna({
            'rating': 4.0,
            'price': df['price'].median(),
            'interests': []
        })

        # Normalize numerical features
        df['price_normalized'] = df['price'] / df['price'].max()
        df['rating_normalized'] = df['rating'] / 5.0

        return df

    def artifact_exists(self, artifact_path: str) -> bool:
        return Path(artifact_path).exists()
