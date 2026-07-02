# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Itinera is a full-stack travel platform with three independently run services:

- **Frontend** (repo root, `src/`, `App.js`) — React Native / Expo app for both B2C customers and B2B admin/supplier workflows.
- **`backend/`** — Spring Boot 3.2 (Java 17) REST API on port 8080, context path `/api`, backed by PostgreSQL via JPA.
- **`ai-service/`** — FastAPI (Python) ML recommendation service on port 8000, called by the backend's `AIController`/proxy or directly from the frontend.

These run as separate processes locally and as separate services in `render.yaml` for deployment (`itinera-backend`, `itinera-ai`, `itinera-postgres`).

## Common commands

### Frontend (root directory)
```bash
npm install
npx expo start           # dev server (also: npm start)
npx expo start --android
npx expo start --ios
npx expo start --web
```
No test suite or lint script is configured for the frontend.

### Backend (`backend/`)
```bash
cd backend
cp .env.example .env     # fill in DATABASE_PASSWORD and JWT_SECRET at minimum
bash run-backend.sh      # forces JAVA_HOME to Java 17, loads .env, then `mvn spring-boot:run`
# or manually:
mvn spring-boot:run
mvn test                 # run backend tests (none currently present in the repo)
mvn -Dtest=ClassName#methodName test   # run a single test
```
API is served at `http://localhost:8080/api`. On first startup, `DataSeederConfig` seeds 3 demo users and 48 destination packages (16 destinations x 3 tiers) — see Demo Credentials below.

### AI service (`ai-service/`)
```bash
cd ai-service
pip install -r requirements.txt
python main.py            # serves on http://localhost:8000
```
Retraining the model:
```bash
python generate_app_dataset.py
python train_model.py --catalog data/app_packages.csv --interactions data/app_package_interactions.csv --output artifacts/destination_recommender.joblib
```

## Architecture

### Frontend
- `App.js` is the single navigation root: it owns auth state (hydrated from `expo-secure-store`, key `itinera.auth`), exposes `AuthContext`, wraps everything in `CartProvider`, and switches the initial stack between `CustomerTabs` (role `CUSTOMER`) and `B2BDashboard` (roles `ADMIN`/`SUPPLIER`) based on the logged-in user's role. All other screens are pushed on top of whichever root is active.
- `src/config/api.js` resolves the backend base URL dynamically: it reads `NativeModules.SourceCode.scriptURL` to detect the Metro/dev host, remaps `localhost` to `10.0.2.2` on the Android emulator, uses the LAN host when running on a physical device via Expo, and otherwise falls back to a hardcoded production Render URL. `EXPO_PUBLIC_API_URL` overrides all of this when set.
- `src/context/AuthContext.js` and `src/context/CartContext.js` are the only global state providers; screen-local state is otherwise managed per-component.
- `src/utils/weatherPlanner.js` integrates with the Open-Meteo API client-side (no backend involvement) to flag outdoor activities at risk on a given itinerary day and suggest indoor alternatives — this feeds the weather overlay in `ItineraryDetailScreen`.
- `src/data/*.js` holds static seed content (destination places/activities, sample itineraries) used by frontend-only screens, separate from what the backend serves.

### Backend (`backend/src/main/java/com/itinera/`)
Standard layered Spring Boot structure: `controller/` -> `service/` -> `repository/` (Spring Data JPA) -> `model/` (JPA entities). Notable cross-cutting pieces:
- `config/SecurityConfig.java` — stateless JWT auth via `JwtAuthenticationFilter`; note the context path `/api` is stripped, so security matchers use app-relative paths (e.g. `/auth/**`, not `/api/auth/**`). Key rules: `/auth/**` and itinerary `GET`s are public; itinerary mutations require `ROLE_ADMIN`; almost everything else requires an authenticated JWT.
- `config/DataSeederConfig.java` — seeds demo users/itineraries on startup (dev convenience, runs against whatever DB is configured).
- `config/TripJackConfig.java` + `service/TripJackClient.java` — integration with the TripJack flight-search API (`FlightController`/`FlightService`), configured via `tripjack.base-url` / `tripjack.api-key`.
- `service/AIRecommendationService.java` — backend-side glue that talks to the Python AI service at `ai.service.url` (defaults to `http://localhost:8000`, or a private Render hostport in production).
- Messaging model (`Conversation`, `ConversationMessage`) backs three distinct chat flows: customer->admin, admin->supplier, and supplier->admin (see `MessagingController`), including a structured supplier itinerary-proposal payload.
- Group trip planning (`GroupTrip`, `GroupTripMember`, `GroupTripOption`, `GroupTripVote`) implements invite-code joining, per-option voting, organizer-only locking, and itinerary finalization — see `GroupTripController`/`GroupTripService`.
- All config is externalized through `application.properties` using `${ENV_VAR:default}` placeholders; there is no `application-{profile}.properties` split — environment behavior is driven entirely by env vars (see `.env.example`).

### AI service (`ai-service/`)
- `main.py` is the FastAPI entrypoint exposing `/recommend`, `/trending`, `/similar/{id}`, `/search/smart`, `/insights/{user_id}`, `/feedback`.
- `models/` contains multiple interchangeable recommenders selected via the `recommendation_type` request field:
  - `hybrid` (default) blends the trained GBR model (`exported_gbr_recommender.py`, 88% weight) with the heuristic `recommendation_engine.py` (12%), then re-ranks by destination/weather fit.
  - `trained` uses the JSON-exported GBR model directly against the full catalog.
  - `collaborative` (`collaborative_filter.py`) — cosine similarity over a user-item interaction matrix.
  - `content` (`content_based_filter.py`) — TF-IDF over package features.
- `generate_app_dataset.py` produces the synthetic catalog/interactions CSVs consumed by `train_model.py`, which trains and exports the sklearn model used by `trained_recommender.py`/`exported_gbr_recommender.py`.

## Auth & roles

Roles: `CUSTOMER`, `ADMIN`, `SUPPLIER`, `AGENT`. `CUSTOMER` routes to the bottom-tab `CustomerTabs`; `ADMIN`/`SUPPLIER` route to `B2BDashboard`. Admin registration is gated by `AUTH_MAX_ADMIN_COUNT` and an `AUTHORIZED_ADMIN_EMAILS` allowlist (see `AuthController`/`application.properties`). Google OAuth is supported via `expo-auth-session` on the frontend and Google API Client token verification on the backend.

Demo credentials seeded by `DataSeederConfig` (local/dev only):
- Customer: `customer@itinera.com` / `Customer@123`
- Supplier: `supplier@itinera.com` / `Supplier@123`
- Admin: `admin@itinera.com` / `Admin@123`

## Environment variables

Each service has its own env file: root `.env` (frontend, `EXPO_PUBLIC_*` vars only — Expo does not expose unprefixed vars to the app), `backend/.env`, and `ai-service` currently takes no `.env` (see `render.yaml` for its runtime env vars). Copy from the corresponding `.env.example` before running a service. See `README.md` for the full variable tables if needed — do not guess at variable names or defaults; they're centralized in `application.properties` and `.env.example`.

## Deployment

`render.yaml` defines a Render Blueprint: `itinera-backend` (Docker web service, health check `/api/health`), `itinera-ai` (private Python service), and `itinera-postgres`. The backend reaches the AI service over Render's private network via `AI_SERVICE_URL`, injected from `itinera-ai`'s `hostport`. After deploying, the frontend's `EXPO_PUBLIC_API_URL` must point at the backend's public Render URL + `/api`.
