# Itinera AI Recommendation Service

AI-powered travel recommendation engine using Python, FastAPI, and scikit-learn.

## Features

- **Hybrid Recommendations**: Combines collaborative and content-based filtering
- **Smart Search**: Natural language understanding for travel queries
- **Trending Destinations**: Real-time popularity tracking
- **Similar Itineraries**: Find trips similar to ones you like
- **User Insights**: AI-generated travel preference analysis

## Tech Stack

- **FastAPI**: High-performance async API framework
- **scikit-learn**: Machine learning algorithms
- **pandas/numpy**: Data processing
- **TF-IDF**: Text feature extraction
- **Cosine Similarity**: Recommendation scoring

## Installation

```bash
cd ai-service
pip install -r requirements.txt
```

## Running the Service

```bash
python main.py
```

The service will start on `http://localhost:8000`

## API Endpoints

### Get Recommendations
```bash
POST /recommend
{
  "user_preferences": {
    "budget": 25000,
    "destination": "Goa",
    "num_people": 2,
    "travel_style": "balanced",
    "interests": ["beach", "adventure"]
  },
  "num_recommendations": 5,
  "recommendation_type": "hybrid"
}
```

### Get Trending Destinations
```bash
GET /trending
```

### Get Similar Itineraries
```bash
GET /similar/{itinerary_id}?limit=5
```

### Smart Search
```bash
GET /search/smart?query=beach vacation&budget_min=15000&budget_max=30000
```

### Get User Insights
```bash
GET /insights/{user_id}
```

### Submit Feedback
```bash
POST /feedback
{
  "user_id": "user123",
  "itinerary_id": "itin456",
  "rating": 4.5,
  "feedback": "Great experience!"
}
```

## Recommendation Algorithms

### 1. Hybrid Engine
Combines multiple scoring methods:
- Budget matching (30%)
- Interest matching (35%)
- Popularity score (15%)
- Destination relevance (20%)

### 2. Collaborative Filtering
Finds users with similar preferences and recommends what they enjoyed.

### 3. Content-Based Filtering
Uses TF-IDF vectorization to match user preferences with itinerary features.

## Integration with React Native

The AI service can be called from the React Native app:

```javascript
const getAIRecommendations = async (preferences) => {
  const response = await fetch('http://localhost:8000/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_preferences: preferences,
      num_recommendations: 5,
      recommendation_type: 'hybrid'
    })
  });
  return response.json();
};
```

## Integration with Spring Boot

The Spring Boot backend can proxy requests to the AI service:

```java
@Value("${ai.service.url}")
private String aiServiceUrl;

public List<Itinerary> getRecommendations(UserPreferences prefs) {
    // Call AI service and return recommendations
}
```
