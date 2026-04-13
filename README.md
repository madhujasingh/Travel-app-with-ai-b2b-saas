# Itinera — AI-Powered Travel Platform

A full-stack travel application with React Native (Expo) frontend, Spring Boot backend, and a Python FastAPI AI recommendation service. Supports B2C customer journeys, B2B supplier/admin workflows, group trip planning, and ML-based itinerary recommendations.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [AI Service](#ai-service)
- [User Roles](#user-roles)
- [Demo Credentials](#demo-credentials)

---

## Architecture Overview

```
┌─────────────────────────────┐
│   React Native (Expo)       │  ← Customer + B2B frontend
│   src/screens, src/utils    │
└──────────┬──────────────────┘
           │ HTTP / REST
┌──────────▼──────────────────┐
│   Spring Boot (Port 8080)   │  ← Auth, Bookings, Itineraries,
│   /api/*                    │     Messaging, Group Trips, Suppliers
└──────────┬──────────────────┘
           │ PostgreSQL (JPA)
┌──────────▼──────────────────┐
│   PostgreSQL Database       │
└─────────────────────────────┘

┌─────────────────────────────┐
│   FastAPI AI Service        │  ← ML recommendations (Port 8000)
│   ai-service/               │     Hybrid GBR + content-based
└─────────────────────────────┘
```

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React Native (Expo) | ~55.x | Cross-platform mobile app |
| React Navigation | v7 | Stack + Bottom Tab navigation |
| Expo Auth Session | ~55.x | Google OAuth |
| Axios | ^1.x | HTTP client |
| Ionicons / MaterialCommunityIcons | — | Icons |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Spring Boot | 3.2.0 | REST API framework |
| Spring Security | — | JWT auth + role-based access |
| Spring Data JPA | — | ORM / database layer |
| PostgreSQL | — | Primary database |
| JJWT | 0.11.5 | JWT token generation |
| Google API Client | 2.7.0 | Google ID token verification |
| Lombok | — | Boilerplate reduction |

### AI Service
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.104.1 | Async API framework |
| scikit-learn | 1.3.2 | ML models (GBR, Random Forest) |
| pandas / numpy | — | Data processing |
| TF-IDF + Cosine Similarity | — | Content-based filtering |

---

## Features

### Customer App
- **Multi-step trip planner** — Step-by-step budget, destination, and traveler input with animated progress
- **Land packages** — Browse India and International destinations with rich package cards
- **Itinerary detail** — Day-wise plans, inclusions/exclusions, highlights, and pricing
- **Live weather overlay** — Real-time Open-Meteo forecast per day with outdoor activity risk alerts and indoor alternatives
- **AI recommendations** — Mood, weather, budget, and market-aware package suggestions (trained GBR model + heuristic hybrid)
- **Place insights** — Per-destination deep-dive with gallery, quick facts, and travel tips
- **Customization** — Add/remove places and activities, attach notes, forward to agent
- **Cart & checkout** — Multi-item cart, tax breakdown, payment method selection
- **Talk to Agent** — Starts a real-time chat with a travel admin
- **Chat inbox** — Full conversation thread with read receipts and message history
- **Group Trip Planner** — Create group trips, share invite codes, vote on restaurants/activities/stays, lock winners, generate itinerary
- **Customer profile** — Booking history, saved trips, transaction log, AI insights, notification center

### B2B / Admin Dashboard
- **Business stats** — Revenue, bookings, active clients, pending queries
- **Admin itinerary upload** — Publish full packages with day-wise plans from within the app
- **Poster Studio** — Auto-generate marketing flyer copy from any live itinerary using saved campaign templates
- **Forward to supplier** — Admin can forward customer requests to verified supplier accounts in-chat
- **Supplier requests** — Filter and manage incoming quote requests with status tracking
- **Reports & analytics** — Period-based metrics, top destinations, export to PDF/Excel

### Supplier Features
- **Incoming requests** — View and respond to admin-forwarded customer trips
- **Itinerary proposal template** — Submit structured itinerary drafts directly inside supplier-admin chat
- **Performance metrics** — Response time, conversion rate, total/converted requests

---

## Project Structure

```
itinera/
├── App.js                          # Root navigation, AuthContext, role routing
├── index.js                        # Expo entry point
├── src/
│   ├── config/
│   │   └── api.js                  # Dynamic API URL resolution (LAN / emulator / prod)
│   ├── constants/
│   │   └── Colors.js               # Design system tokens
│   ├── context/
│   │   └── AuthContext.js          # Global auth state (token + user)
│   ├── screens/
│   │   ├── SplashScreen.js
│   │   ├── LoginScreen.js          # Email/password + Google OAuth
│   │   ├── HomeScreen.js           # Multi-step trip search
│   │   ├── LandPackageScreen.js    # Category + destination selector
│   │   ├── ItineraryListScreen.js  # Filtered itinerary list from backend
│   │   ├── ItineraryDetailScreen.js # Day plans + weather adapter + group planner CTA
│   │   ├── CustomizationScreen.js  # Place/activity toggle customization
│   │   ├── CartScreen.js
│   │   ├── CheckoutScreen.js
│   │   ├── TalkToAgentScreen.js    # Creates customer-admin conversation
│   │   ├── ChatInboxScreen.js      # Conversation list
│   │   ├── ChatScreen.js           # Live messaging + supplier template
│   │   ├── HotelsScreen.js
│   │   ├── FlightsScreen.js
│   │   ├── AIRecommendationsScreen.js  # Mood/weather/market filters + AI results
│   │   ├── AIPlaceInsightScreen.js     # Per-destination deep-dive
│   │   ├── GroupTripPlannerScreen.js   # Full group voting + itinerary generation
│   │   ├── CustomerProfileScreen.js
│   │   ├── B2BDashboard.js         # Admin + Supplier dashboard
│   │   ├── AdminItineraryUploadScreen.js
│   │   ├── AdminPosterStudioScreen.js
│   │   ├── SupplierRequestsScreen.js
│   │   ├── ReportsScreen.js
│   │   ├── RequestDetailScreen.js
│   │   └── CreatePackageScreen.js
│   └── utils/
│       ├── destinationMedia.js     # Image URLs, gallery, blurbs per destination
│       └── weatherPlanner.js       # Open-Meteo integration + outdoor risk detection
│
├── backend/
│   ├── src/main/java/com/itinera/
│   │   ├── ItineraApplication.java
│   │   ├── config/
│   │   │   ├── SecurityConfig.java         # CORS, JWT filter, role matchers
│   │   │   ├── JwtUtil.java
│   │   │   ├── JwtAuthenticationFilter.java
│   │   │   └── DataSeederConfig.java       # Seeds demo users + itineraries on startup
│   │   ├── controller/
│   │   │   ├── AuthController.java         # /auth/register, /auth/login, /auth/google
│   │   │   ├── ItineraryController.java
│   │   │   ├── BookingController.java
│   │   │   ├── CartController.java
│   │   │   ├── AgentRequestController.java
│   │   │   ├── SupplierController.java
│   │   │   ├── GroupTripController.java
│   │   │   └── MessagingController.java
│   │   ├── model/                   # JPA entities
│   │   ├── repository/              # Spring Data JPA interfaces
│   │   ├── service/                 # Business logic
│   │   └── exception/
│   └── src/main/resources/
│       └── application.properties
│
└── ai-service/
    ├── main.py                      # FastAPI app + endpoints
    ├── models/
    │   ├── recommendation_engine.py # Hybrid heuristic engine
    │   ├── collaborative_filter.py  # Cosine similarity collaborative filtering
    │   ├── content_based_filter.py  # TF-IDF content filtering
    │   ├── exported_gbr_recommender.py  # JSON-exported Gradient Boosting model
    │   └── trained_recommender.py   # sklearn Random Forest pipeline
    ├── utils/data_loader.py
    ├── generate_app_dataset.py      # Synthetic catalog + interaction generator
    ├── train_model.py               # CLI training script
    └── requirements.txt
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- Java 17
- Maven
- PostgreSQL
- Python 3.10+

---

### 1. Clone and install frontend

```bash
npm install
```

Copy environment config:

```bash
cp .env.example .env
```

Start the Expo dev server:

```bash
npx expo start
```

Run on device:

```bash
npx expo start --android
npx expo start --ios
```

---

### 2. Start the backend

```bash
cd backend
cp .env.example .env
# Fill in DATABASE_PASSWORD and JWT_SECRET at minimum
```

Run with the provided script (forces Java 17, loads `.env`):

```bash
bash run-backend.sh
```

Or manually:

```bash
mvn spring-boot:run
```

The API starts at `http://localhost:8080/api`.

**On first startup**, `DataSeederConfig` automatically seeds:
- Three demo users (customer, supplier, admin)
- 48 destination packages (16 destinations × 3 package tiers)

---

### 3. Start the AI service

```bash
cd ai-service
pip install -r requirements.txt
python main.py
```

The AI service starts at `http://localhost:8000`.

**To train a custom model** (optional):

```bash
python generate_app_dataset.py
python train_model.py \
  --catalog data/app_packages.csv \
  --interactions data/app_package_interactions.csv \
  --output artifacts/destination_recommender.joblib
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SERVER_PORT` | Backend port (default: 8080) |
| `DATABASE_URL` | PostgreSQL JDBC URL |
| `DATABASE_USERNAME` | DB username |
| `DATABASE_PASSWORD` | DB password |
| `JWT_SECRET` | Long random secret (min 256 bits) |
| `JWT_EXPIRATION` | Token TTL in ms (default: 86400000) |
| `GOOGLE_WEB_CLIENT_ID` | Google OAuth Web Client ID |
| `GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS Client ID (optional) |
| `GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android Client ID (optional) |
| `AUTH_MAX_ADMIN_COUNT` | Max admin accounts allowed (default: 2) |
| `AUTHORIZED_ADMIN_EMAILS` | Comma-separated admin email allowlist |
| `CORS_ALLOWED_ORIGINS` | Comma-separated allowed origins |

### Frontend (`.env`)

| Variable | Description |
|---|---|
| `EXPO_PUBLIC_API_URL` | Backend base URL |
| `EXPO_PUBLIC_AI_SERVICE_URL` | AI service base URL |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google OAuth Web Client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Google OAuth iOS Client ID |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Google OAuth Android Client ID |

> **Network note:** The app auto-detects the backend host. On Android emulators it falls back to `10.0.2.2`. On physical devices it reads the Metro bundler host from `NativeModules.SourceCode.scriptURL`.

---

## API Reference

All endpoints are prefixed with `/api`.

### Auth — `/auth`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | None | Register (CUSTOMER by default) |
| POST | `/auth/login` | None | Email/password login |
| POST | `/auth/google` | None | Google ID token exchange |
| GET | `/auth/me` | JWT | Get current user |

### Itineraries — `/itineraries`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/itineraries` | None | All active itineraries |
| GET | `/itineraries/{id}` | None | Single itinerary |
| GET | `/itineraries/search?destination=` | None | Search by destination |
| GET | `/itineraries/category/{INDIA\|INTERNATIONAL}` | None | Filter by category |
| GET | `/itineraries/type/{type}` | None | Filter by type |
| POST | `/itineraries` | ADMIN | Create itinerary |
| PUT | `/itineraries/{id}` | ADMIN | Update itinerary |
| DELETE | `/itineraries/{id}` | ADMIN | Delete itinerary |

### Bookings — `/bookings`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/bookings` | JWT | All bookings |
| GET | `/bookings/user/{userId}` | JWT | User's bookings |
| POST | `/bookings` | JWT | Create booking |
| PUT | `/bookings/{id}/status` | JWT | Update status |
| PUT | `/bookings/{id}/payment` | JWT | Update payment status |
| DELETE | `/bookings/{id}` | JWT | Cancel booking |

### Cart — `/cart`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/cart/user/{userId}` | JWT | Get cart |
| POST | `/cart` | JWT | Add item |
| DELETE | `/cart/{id}` | JWT | Remove item |
| DELETE | `/cart/user/{userId}` | JWT | Clear cart |

### Suppliers — `/suppliers`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/suppliers` | JWT | All suppliers |
| GET | `/suppliers/verified` | None | Verified suppliers (public) |
| POST | `/suppliers` | JWT | Create supplier |
| PUT | `/suppliers/{id}/verify` | JWT | Verify supplier |
| GET | `/suppliers/{id}/performance` | JWT | Performance metrics |
| GET | `/suppliers/performance/all` | JWT | All supplier metrics |

### Group Trips — `/group-trips`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/group-trips` | JWT | My trips |
| POST | `/group-trips` | JWT | Create trip |
| POST | `/group-trips/join` | JWT | Join by invite code |
| GET | `/group-trips/{tripId}` | JWT | Trip detail |
| POST | `/group-trips/{tripId}/options` | JWT | Add option |
| POST | `/group-trips/{tripId}/options/{optionId}/vote` | JWT | Vote on option |
| POST | `/group-trips/{tripId}/options/{optionId}/lock` | JWT (organizer) | Lock winner |
| POST | `/group-trips/{tripId}/finalize` | JWT (organizer) | Generate itinerary |

### Messaging — `/messages`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/messages/conversations/me` | JWT | My conversations |
| POST | `/messages/conversations/customer/start` | JWT (CUSTOMER) | Start customer→admin chat |
| POST | `/messages/conversations/supplier/start` | JWT (ADMIN) | Start admin→supplier chat |
| POST | `/messages/conversations/supplier-to-admin/start` | JWT (SUPPLIER) | Start supplier→admin chat |
| GET | `/messages/conversations/{id}/messages` | JWT | Get messages |
| POST | `/messages/conversations/{id}/messages` | JWT | Send message |
| POST | `/messages/conversations/{id}/supplier-itinerary` | JWT (SUPPLIER) | Submit itinerary proposal |

### Agent Requests — `/agent-requests`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/agent-requests` | JWT | All requests |
| POST | `/agent-requests` | JWT | Create request |
| PUT | `/agent-requests/{id}/assign` | JWT | Assign agent |
| PUT | `/agent-requests/{id}/status` | JWT | Update status |

---

## AI Service

Base URL: `http://localhost:8000`

### Recommend — `POST /recommend`

```json
{
  "user_preferences": {
    "budget": 25000,
    "destination": "Goa",
    "market_preference": "india",
    "num_people": 2,
    "travel_style": "balanced",
    "mood": "relaxed",
    "weather_preference": "warm",
    "interests": ["beach"]
  },
  "num_recommendations": 6,
  "recommendation_type": "hybrid"
}
```

**`recommendation_type` options:**
- `hybrid` — Blends trained GBR model (88%) with heuristic engine (12%), then re-ranks by destination preference and weather fit
- `trained` — Exported JSON GBR model scored against the full package catalog
- `collaborative` — Cosine similarity on user-item interaction matrix
- `content` — TF-IDF on package features

### Other endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/trending` | Top 5 trending destinations |
| GET | `/similar/{itinerary_id}` | Similar itineraries |
| GET | `/search/smart?query=` | Keyword search with optional budget filters |
| GET | `/insights/{user_id}` | User travel preference summary |
| POST | `/feedback` | Submit rating/feedback |

---

## User Roles

| Role | Access |
|---|---|
| `CUSTOMER` | Browse, search, book, cart, chat with agent, group trips, AI recommendations |
| `ADMIN` | All customer access + upload itineraries, poster studio, forward to supplier, view all bookings |
| `SUPPLIER` | B2B dashboard, view/respond to requests, submit itinerary proposals in chat, performance metrics |
| `AGENT` | Assigned customer requests |

**Role routing in the app:**
- `CUSTOMER` → `CustomerTabs` (Home, AI Picks, Talk, Cart, Profile)
- `ADMIN` / `SUPPLIER` → `B2BDashboard`

---

## Demo Credentials

Seeded automatically on first backend startup.

| Role | Email | Password |
|---|---|---|
| Customer | `customer@itinera.com` | `Customer@123` |
| Supplier | `supplier@itinera.com` | `Supplier@123` |
| Admin | `admin@itinera.com` | `Admin@123` |

The login screen includes one-tap role switching between these accounts for development convenience.

---

## Key Features Implementation 
---

## Weather Integration

The itinerary detail screen fetches live forecasts from the Open-Meteo API (no API key required). For each day in the plan:

- Weather codes are mapped to descriptive groups (clear, rain, storm, snow, fog, cloudy)
- Activities containing outdoor keywords (beach, trek, market, sunset, etc.) are flagged on rain/storm/snow days
- A contextual indoor alternative is suggested per flagged activity
- A day-level alert banner appears in the day plan card

This runs entirely client-side without any additional backend calls.

## Poster Studio (Admin Only)

The admin `AdminPosterStudioScreen` generates marketing content without any external API:

1. Select a live itinerary from the backend
2. Choose a campaign reason (Launch, Seasonal, Offer Push)
3. Select a saved template (Launch Drop, Premium Escape, Flash Push)
4. Edit copy fields (badge, headline, subheadline, price line, CTA, footer)
5. Preview the live poster and copy the auto-generated social media caption


## Itinerary Management
- Day-wise activity planning
- Inclusions/Exclusions list
- Rating and reviews
- Price per person calculation

## Customization
- Add/remove places to visit
- Select preferred activities
- Additional notes
- Summary of customization

## B2B SaaS Dashboard
- Business statistics
- Recent bookings
- Supplier requests
- Quick actions
- Feature modules

## Group Trip Planner
- Create group trips with invite codes
- Join trips using invite codes
- Add options for restaurants, activities, and stays
- Upvote/downvote options as a group
- View real-time voting scores
- Lock winning options for final itinerary
- Track group members and their contributions


## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


