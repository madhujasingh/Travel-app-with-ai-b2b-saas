"""
Itinera AI Recommendation Service
Provides intelligent travel recommendations using ML algorithms
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np
from datetime import datetime
import json

from models.recommendation_engine import RecommendationEngine
from models.collaborative_filter import CollaborativeFilter
from models.content_based_filter import ContentBasedFilter
from utils.data_loader import DataLoader

app = FastAPI(
    title="Itinera AI Recommendation Service",
    description="AI-powered travel recommendation engine",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize recommendation engines
data_loader = DataLoader()
recommendation_engine = RecommendationEngine()
collaborative_filter = CollaborativeFilter()
content_based_filter = ContentBasedFilter()


# Request/Response Models
class UserPreferences(BaseModel):
    user_id: Optional[str] = None
    budget: float
    destination: Optional[str] = None
    num_people: int
    travel_style: Optional[str] = "balanced"  # budget, balanced, luxury
    mood: Optional[str] = None
    weather_preference: Optional[str] = None
    interests: Optional[List[str]] = []
    past_bookings: Optional[List[str]] = []


class RecommendationRequest(BaseModel):
    user_preferences: UserPreferences
    num_recommendations: int = 5
    recommendation_type: str = "hybrid"  # collaborative, content, hybrid


class ItineraryRecommendation(BaseModel):
    id: str
    title: str
    destination: str
    price: float
    duration: str
    rating: float
    match_score: float
    reasons: List[str]
    image: str


class RecommendationResponse(BaseModel):
    recommendations: List[ItineraryRecommendation]
    total_results: int
    algorithm_used: str
    processing_time_ms: float
    insights: Optional[Dict[str, Any]] = None


class FeedbackRequest(BaseModel):
    user_id: str
    itinerary_id: str
    rating: float
    feedback: Optional[str] = None


# Sample data for demonstration
SAMPLE_ITINERARIES = [
    {
        "id": "1",
        "title": "Jaipur Heritage Tour - 3 Days",
        "destination": "Jaipur",
        "price": 15000,
        "duration": "3 Days / 2 Nights",
        "rating": 4.5,
        "type": "cultural",
        "interests": ["history", "culture", "architecture"],
        "mood_tags": ["relaxed", "curious", "romantic"],
        "weather_tags": ["temperate", "cool"],
        "image": "business"
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
        "mood_tags": ["party", "relaxed", "adventurous"],
        "weather_tags": ["warm", "humid"],
        "image": "sunny"
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
        "mood_tags": ["relaxed", "healing", "romantic"],
        "weather_tags": ["warm", "rainy", "humid"],
        "image": "leaf"
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
        "mood_tags": ["adventurous", "energetic"],
        "weather_tags": ["cool", "cold"],
        "image": "trail-sign"
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
        "mood_tags": ["romantic", "luxury", "curious"],
        "weather_tags": ["temperate", "cool"],
        "image": "heart"
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
        "mood_tags": ["luxury", "party", "energetic"],
        "weather_tags": ["warm", "dry"],
        "image": "business-outline"
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
        "mood_tags": ["spiritual", "curious", "relaxed"],
        "weather_tags": ["warm", "temperate"],
        "image": "flower"
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
        "mood_tags": ["romantic", "relaxed", "adventurous"],
        "weather_tags": ["warm", "humid"],
        "image": "water-outline"
    }
]


@app.get("/")
async def root():
    return {
        "service": "Itinera AI Recommendation Engine",
        "version": "1.0.0",
        "status": "active"
    }


@app.post("/recommend", response_model=RecommendationResponse)
async def get_recommendations(request: RecommendationRequest):
    """
    Get personalized travel recommendations based on user preferences
    """
    start_time = datetime.now()

    try:
        # Load itineraries data
        itineraries_df = pd.DataFrame(SAMPLE_ITINERARIES)

        # Get recommendations based on type
        if request.recommendation_type == "collaborative":
            recommendations = collaborative_filter.recommend(
                request.user_preferences,
                itineraries_df,
                request.num_recommendations
            )
            algorithm = "Collaborative Filtering"
        elif request.recommendation_type == "content":
            recommendations = content_based_filter.recommend(
                request.user_preferences,
                itineraries_df,
                request.num_recommendations
            )
            algorithm = "Content-Based Filtering"
        else:  # hybrid
            recommendations = recommendation_engine.hybrid_recommend(
                request.user_preferences,
                itineraries_df,
                request.num_recommendations
            )
            algorithm = "Hybrid (Collaborative + Content-Based)"

        insights = recommendation_engine.generate_insights(
            request.user_preferences,
            itineraries_df,
            recommendations
        )

        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds() * 1000

        return RecommendationResponse(
            recommendations=recommendations,
            total_results=len(recommendations),
            algorithm_used=algorithm,
            processing_time_ms=round(processing_time, 2),
            insights=insights
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/trending")
async def get_trending_destinations():
    """
    Get trending destinations based on popularity
    """
    trending = [
        {"destination": "Goa", "trend_score": 95, "bookings": 1250},
        {"destination": "Jaipur", "trend_score": 88, "bookings": 980},
        {"destination": "Kerala", "trend_score": 85, "bookings": 875},
        {"destination": "Manali", "trend_score": 82, "bookings": 820},
        {"destination": "Dubai", "trend_score": 78, "bookings": 650},
    ]
    return {"trending": trending}


@app.get("/similar/{itinerary_id}")
async def get_similar_itineraries(itinerary_id: str, limit: int = 5):
    """
    Get similar itineraries to a given one
    """
    itineraries_df = pd.DataFrame(SAMPLE_ITINERARIES)
    similar = content_based_filter.find_similar(
        itinerary_id,
        itineraries_df,
        limit
    )
    return {"similar_itineraries": similar}


@app.post("/feedback")
async def submit_feedback(feedback: FeedbackRequest):
    """
    Submit user feedback for improving recommendations
    """
    # In production, this would update the ML model
    return {
        "status": "success",
        "message": "Feedback recorded successfully",
        "feedback_id": f"fb_{feedback.user_id}_{datetime.now().timestamp()}"
    }


@app.get("/insights/{user_id}")
async def get_user_insights(user_id: str):
    """
    Get AI-generated insights about user travel preferences
    """
    insights = {
        "user_id": user_id,
        "preferred_destinations": ["Beach", "Mountains"],
        "budget_range": {"min": 15000, "max": 35000},
        "travel_frequency": "2-3 times per year",
        "preferred_duration": "4-6 days",
        "top_interests": ["Adventure", "Nature", "Culture"],
        "recommendation_accuracy": 87.5
    }
    return insights


@app.get("/search/smart")
async def smart_search(
    query: str,
    budget_min: Optional[float] = None,
    budget_max: Optional[float] = None
):
    """
    AI-powered smart search with natural language understanding
    """
    # Simple NLP-based search
    query_lower = query.lower()
    results = []

    for itinerary in SAMPLE_ITINERARIES:
        score = 0
        if query_lower in itinerary["destination"].lower():
            score += 50
        if query_lower in itinerary["title"].lower():
            score += 30
        for interest in itinerary["interests"]:
            if query_lower in interest.lower():
                score += 20

        if score > 0:
            if budget_min and itinerary["price"] < budget_min:
                continue
            if budget_max and itinerary["price"] > budget_max:
                continue
            results.append({**itinerary, "relevance_score": score})

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return {"results": results[:10]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
