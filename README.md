# Itinera - Travel App

A comprehensive travel application built with React Native (Frontend) and Spring Boot (Backend) with B2B SaaS features.

## Features

### Customer Features
- **Splash Screen**: 3-second animated splash screen with app branding
- **Home Page**: Three main services - Land Packages, Hotels, Flights
- **Search & Filter**: Search itineraries by destination, budget, and number of people
- **Land Packages**: Browse International and India destinations
- **Itinerary Details**: View day-wise plans, inclusions, exclusions
- **Customization**: Customize trips by adding/removing places and activities
- **Cart & Checkout**: Add to cart and secure payment options
- **Talk to Agent**: Connect with travel agents via phone, WhatsApp, or email

### B2B SaaS Features
- **Dashboard**: Business analytics and overview
- **Client Management**: Manage customer database
- **Supplier Network**: Connect with hotels, tour operators, transport providers
- **Booking Management**: Track all bookings and payments
- **Commission Tracking**: Monitor earnings and commissions
- **Marketing Tools**: Promote business offerings

### Admin Features
- **Admin Dashboard**: Manage all operations
- **Agent Requests**: View and assign customer requests to agents
- **Supplier Management**: Verify and manage suppliers
- **Booking Oversight**: Monitor all bookings and payments

## Tech Stack

### Frontend (React Native)
- React Native with Expo
- React Navigation (Stack Navigator)
- Axios for API calls

### Backend (Spring Boot)
- Spring Boot 3.2.0
- Spring Data JPA
- Spring Security
- PostgreSQL Database
- JWT Authentication
- RESTful APIs

## Project Structure

```
travelApp2/
├── src/                          # React Native Frontend
│   ├── screens/                  # All app screens
│   │   ├── SplashScreen.js
│   │   ├── HomeScreen.js
│   │   ├── LandPackageScreen.js
│   │   ├── ItineraryListScreen.js
│   │   ├── ItineraryDetailScreen.js
│   │   ├── CustomizationScreen.js
│   │   ├── CartScreen.js
│   │   ├── CheckoutScreen.js
│   │   ├── TalkToAgentScreen.js
│   │   ├── HotelsScreen.js
│   │   ├── FlightsScreen.js
│   │   └── B2BDashboard.js
│   ├── constants/
│   │   └── Colors.js             # Theme colors
│   └── App.js                    # Main navigation setup
│
├── backend/                      # Spring Boot Backend
│   ├── src/main/java/com/itinera/
│   │   ├── controller/           # REST Controllers
│   │   ├── service/              # Business Logic
│   │   ├── model/                # Entity Classes
│   │   ├── repository/           # Data Access
│   │   └── ItineraApplication.java
│   ├── src/main/resources/
│   │   └── application.properties
│   └── pom.xml
│
├── package.json                  # React Native dependencies
└── README.md
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Java 17 or higher
- Maven
- PostgreSQL

### Frontend Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npx expo start
```

3. Run on Android/iOS:
```bash
npx expo start --android
# or
npx expo start --ios
```

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Configure database in `application.properties`:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/itinera_db
spring.datasource.username=your_username
spring.datasource.password=your_password
```

3. Build and run:
```bash
mvn clean install
mvn spring-boot:run
```

The backend will start on `http://localhost:8080/api`

## API Endpoints

### Itineraries
- `GET /api/itineraries` - Get all itineraries
- `GET /api/itineraries/{id}` - Get itinerary by ID
- `GET /api/itineraries/search?destination={destination}` - Search by destination
- `GET /api/itineraries/category/{category}` - Get by category (INTERNATIONAL/INDIA)
- `POST /api/itineraries` - Create new itinerary

### Bookings
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/user/{userId}` - Get user bookings
- `POST /api/bookings` - Create new booking
- `PUT /api/bookings/{id}/status` - Update booking status

### Cart
- `GET /api/cart/user/{userId}` - Get user cart
- `POST /api/cart` - Add to cart
- `DELETE /api/cart/{id}` - Remove from cart

### Agent Requests
- `GET /api/agent-requests` - Get all requests
- `POST /api/agent-requests` - Create new request
- `PUT /api/agent-requests/{id}/assign` - Assign agent

### Suppliers
- `GET /api/suppliers` - Get all suppliers
- `POST /api/suppliers` - Create new supplier
- `PUT /api/suppliers/{id}/verify` - Verify supplier

## Key Features Implementation

### 1. Splash Screen
- 3-second animated splash with fade-in and scale effects
- App logo and tagline display
- Automatic navigation to home screen

### 2. Service Selection
- Three main service cards (Land Package, Hotels, Flights)
- Color-coded cards with icons
- Smooth navigation to respective screens

### 3. Search Functionality
- Budget input
- Destination search
- Number of people
- Filter by type (Budget, Premium, Adventure, Family)

### 4. Itinerary Management
- Day-wise activity planning
- Inclusions/Exclusions list
- Rating and reviews
- Price per person calculation

### 5. Customization
- Add/remove places to visit
- Select preferred activities
- Additional notes
- Summary of customization

### 6. B2B SaaS Dashboard
- Business statistics
- Recent bookings
- Supplier requests
- Quick actions
- Feature modules

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


