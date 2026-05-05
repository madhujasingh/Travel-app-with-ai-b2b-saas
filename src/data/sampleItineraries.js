import React from 'react';

// Sample itineraries for top 5 international destinations
export const internationalItineraries = {
  Paris: [
    {
      id: 'paris-1',
      title: 'Paris Explorer - 5 Days',
      duration: '5 Days / 4 Nights',
      price: 45000,
      rating: 4.8,
      reviews: 1250,
      type: 'premium',
      image: 'briefcase-outline',
      highlights: ['Eiffel Tower', 'Louvre Museum', 'Seine River Cruise', 'Montmartre', 'Palace of Versailles'],
      inclusions: ['Hotel accommodation', 'Breakfast', 'Guided tours', 'Metro pass', 'Airport transfer'],
      exclusions: ['Flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Arrival & Iconic Landmarks',
          activities: [
            { time: 'Morning', activity: 'Arrival at Charles de Gaulle Airport', icon: 'airplane', id: 'paris-arrival', customizable: false },
            { time: 'Morning', activity: 'Private transfer to hotel in city center', icon: 'car-outline', id: 'paris-transfer', customizable: false },
            { time: 'Afternoon', activity: 'Visit Eiffel Tower with priority access', icon: 'business-outline', id: 'eiffel-tower', customizable: true },
            { time: 'Afternoon', activity: 'Stroll through Champ de Mars gardens', icon: 'leaf-outline', id: 'champ-mars', customizable: true },
            { time: 'Evening', activity: 'Seine River dinner cruise with views of illuminated monuments', icon: 'boat-outline', id: 'seine-cruise', customizable: true },
            { time: 'Evening', activity: 'Overnight at hotel', icon: 'bed-outline', id: 'paris-hotel-night1', customizable: false },
          ],
        },
        {
          dayNumber: 2,
          title: 'Art & Culture in the Heart of Paris',
          activities: [
            { time: 'Morning', activity: 'Breakfast at hotel', icon: 'restaurant-outline', id: 'paris-breakfast2', customizable: false },
            { time: 'Morning', activity: 'Guided tour of Louvre Museum (Mona Lisa, Venus de Milo)', icon: 'library-outline', id: 'louvre-museum', customizable: true },
            { time: 'Afternoon', activity: 'Explore Tuileries Garden and Place de la Concorde', icon: 'leaf-outline', id: 'tuileries-garden', customizable: true },
            { time: 'Afternoon', activity: 'Luxury shopping on Champs-Élysées', icon: 'cart-outline', id: 'champs-shopping', customizable: true },
            { time: 'Evening', activity: 'Visit Montmartre and Sacré-Cœur Basilica', icon: 'flower-outline', id: 'montmartre-sacrecouer', customizable: true },
            { time: 'Evening', activity: 'Traditional French dinner in Montmartre', icon: 'restaurant-outline', id: 'montmartre-dinner', customizable: true },
            { time: 'Evening', activity: 'Overnight at hotel', icon: 'bed-outline', id: 'paris-hotel-night2', customizable: false },
          ],
        },
        {
          dayNumber: 3,
          title: 'Royal Palaces & Gardens',
          activities: [
            { time: 'Morning', activity: 'Breakfast at hotel', icon: 'restaurant-outline', id: 'paris-breakfast3', customizable: false },
            { time: 'Morning', activity: 'Day trip to Palace of Versailles', icon: 'business', id: 'versailles-palace', customizable: true },
            { time: 'Afternoon', activity: 'Explore the magnificent gardens and fountains', icon: 'leaf-outline', id: 'versailles-gardens', customizable: true },
            { time: 'Afternoon', activity: 'Private tour of the Grand Trianon', icon: 'business-outline', id: 'versailles-trianon', customizable: true },
            { time: 'Evening', activity: 'Return to Paris', icon: 'car-outline', id: 'versailles-return', customizable: false },
            { time: 'Evening', activity: 'Free time for shopping or relaxation', icon: 'cart-outline', id: 'paris-freetime', customizable: true },
            { time: 'Evening', activity: 'Overnight at hotel', icon: 'bed-outline', id: 'paris-hotel-night3', customizable: false },
          ],
        },
        {
          dayNumber: 4,
          title: 'Historic Paris & Culinary Experience',
          activities: [
            { time: 'Morning', activity: 'Breakfast at hotel', icon: 'restaurant-outline', id: 'paris-breakfast4', customizable: false },
            { time: 'Morning', activity: 'Visit Notre-Dame Cathedral and Île de la Cité', icon: 'location', id: 'notre-dame-cite', customizable: true },
            { time: 'Afternoon', activity: 'Explore Latin Quarter and Luxembourg Gardens', icon: 'walk-outline', id: 'latin-quarter', customizable: true },
            { time: 'Afternoon', activity: 'Visit Luxembourg Palace and gardens', icon: 'business-outline', id: 'luxembourg-palace', customizable: true },
            { time: 'Evening', activity: 'French cooking class with local chef', icon: 'restaurant-outline', id: 'cooking-class', customizable: true },
            { time: 'Evening', activity: 'Wine tasting in a historic cellar', icon: 'wine-outline', id: 'wine-tasting', customizable: true },
            { time: 'Evening', activity: 'Overnight at hotel', icon: 'bed-outline', id: 'paris-hotel-night4', customizable: false },
          ],
        },
        {
          dayNumber: 5,
          title: 'Farewell to Paris',
          activities: [
            { time: 'Morning', activity: 'Breakfast at hotel', icon: 'restaurant-outline', id: 'paris-breakfast5', customizable: false },
            { time: 'Morning', activity: 'Visit Arc de Triomphe and Champs-Élysées', icon: 'flag-outline', id: 'arc-triomphe', customizable: true },
            { time: 'Afternoon', activity: 'Shopping at Galeries Lafayette', icon: 'cart-outline', id: 'lafayette-shopping', customizable: true },
            { time: 'Afternoon', activity: 'Farewell lunch at a Michelin-starred restaurant', icon: 'restaurant-outline', id: 'farewell-lunch', customizable: true },
            { time: 'Evening', activity: 'Private transfer to airport', icon: 'car-outline', id: 'paris-departure', customizable: false },
            { time: 'Evening', activity: 'Flight home', icon: 'airplane', id: 'paris-flight-home', customizable: false },
          ],
        },
      ],
    },
    {
      id: 'paris-2',
      title: 'Paris Romance - 4 Days',
      duration: '4 Days / 3 Nights',
      price: 35000,
      rating: 4.9,
      reviews: 890,
      type: 'romantic',
      image: 'heart',
      highlights: ['Romantic Seine cruise', 'Montmartre artists', 'Café culture', 'Luxury shopping', 'Fine dining'],
      inclusions: ['Boutique hotel', 'Breakfast', 'Private tours', 'Wine tasting', 'Airport transfer'],
      exclusions: ['International flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Romantic Welcome to Paris',
          activities: [
            { time: 'Morning', activity: 'Arrival at airport with private chauffeur', icon: 'airplane', id: 'paris-romance-arrival', customizable: false },
            { time: 'Morning', activity: 'Check-in at boutique hotel with rose petals', icon: 'heart-outline', id: 'paris-romance-checkin', customizable: false },
            { time: 'Afternoon', activity: 'Private Seine River cruise with champagne', icon: 'boat-outline', id: 'seine-romance-cruise', customizable: true },
            { time: 'Afternoon', activity: 'Visit Eiffel Tower with VIP access', icon: 'business-outline', id: 'eiffel-romance', customizable: true },
            { time: 'Evening', activity: 'Romantic dinner at Michelin-starred restaurant', icon: 'restaurant-outline', id: 'paris-romance-dinner', customizable: true },
            { time: 'Evening', activity: 'Overnight at boutique hotel', icon: 'bed-outline', id: 'paris-romance-night1', customizable: false },
          ],
        },
        {
          dayNumber: 2,
          title: 'Art, Culture & Romance',
          activities: [
            { time: 'Morning', activity: 'Breakfast in bed with room service', icon: 'restaurant-outline', id: 'paris-romance-breakfast2', customizable: false },
            { time: 'Morning', activity: 'Private Louvre Museum tour (just the two of you)', icon: 'library-outline', id: 'louvre-private-tour', customizable: true },
            { time: 'Afternoon', activity: 'Hand-in-hand walk through Tuileries Garden', icon: 'walk-outline', id: 'tuileries-romance-walk', customizable: true },
            { time: 'Afternoon', activity: 'Luxury shopping at Place Vendôme', icon: 'cart-outline', id: 'place-vendome-shopping', customizable: true },
            { time: 'Evening', activity: 'Stroll through Montmartre artists\' quarter', icon: 'musical-notes-outline', id: 'montmartre-artists', customizable: true },
            { time: 'Evening', activity: 'Café hopping in Latin Quarter with local wines', icon: 'wine-outline', id: 'latin-cafe-hopping', customizable: true },
            { time: 'Evening', activity: 'Overnight at boutique hotel', icon: 'bed-outline', id: 'paris-romance-night2', customizable: false },
          ],
        },
        {
          dayNumber: 3,
          title: 'Luxury & Indulgence',
          activities: [
            { time: 'Morning', activity: 'Champagne breakfast on balcony', icon: 'wine-outline', id: 'paris-romance-breakfast3', customizable: false },
            { time: 'Morning', activity: 'Luxury shopping on Champs-Élysées', icon: 'cart-outline', id: 'champs-luxury-shopping', customizable: true },
            { time: 'Afternoon', activity: 'Couples spa treatment at luxury spa', icon: 'fitness-outline', id: 'paris-couples-spa', customizable: true },
            { time: 'Afternoon', activity: 'Private shopping consultation', icon: 'cart-outline', id: 'personal-shopper', customizable: true },
            { time: 'Evening', activity: 'Opera Garnier ballet performance', icon: 'musical-notes-outline', id: 'opera-garnier-show', customizable: true },
            { time: 'Evening', activity: 'Late night Seine River cruise', icon: 'boat-outline', id: 'seine-night-cruise', customizable: true },
            { time: 'Evening', activity: 'Overnight at boutique hotel', icon: 'bed-outline', id: 'paris-romance-night3', customizable: false },
          ],
        },
        {
          dayNumber: 4,
          title: 'Sweet Farewell',
          activities: [
            { time: 'Morning', activity: 'Breakfast in bed with final moments', icon: 'restaurant-outline', id: 'paris-romance-breakfast4', customizable: false },
            { time: 'Morning', activity: 'Visit Notre-Dame Cathedral together', icon: 'location', id: 'notre-dame-romance', customizable: true },
            { time: 'Afternoon', activity: 'Last minute shopping for souvenirs', icon: 'cart-outline', id: 'romance-souvenirs', customizable: true },
            { time: 'Afternoon', activity: 'Farewell picnic in Luxembourg Gardens', icon: 'leaf-outline', id: 'luxembourg-picnic', customizable: true },
            { time: 'Evening', activity: 'Private chauffeur to airport', icon: 'car-outline', id: 'paris-romance-departure', customizable: false },
            { time: 'Evening', activity: 'Flight home with memories to cherish', icon: 'airplane', id: 'paris-romance-flight', customizable: false },
          ],
        },
      ],
    },
  ],
  Tokyo: [
    {
      id: 'tokyo-1',
      title: 'Tokyo Discovery - 6 Days',
      duration: '6 Days / 5 Nights',
      price: 55000,
      rating: 4.7,
      reviews: 1450,
      type: 'adventure',
      image: 'trail-sign',
      highlights: ['Shibuya Crossing', 'Senso-ji Temple', 'Tokyo Skytree', 'Meiji Shrine', 'Tsukiji Fish Market'],
      inclusions: ['Hotel accommodation', 'Breakfast', 'JR Pass', 'Guided tours', 'Airport transfer'],
      exclusions: ['International flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Tokyo Arrival',
          activities: [
            { time: 'Morning', activity: 'Arrival & hotel check-in', icon: 'airplane' },
            { time: 'Afternoon', activity: 'Asakusa & Senso-ji Temple', icon: 'location' },
            { time: 'Evening', activity: 'Tokyo Skytree visit', icon: 'business-outline' },
          ],
        },
        {
          dayNumber: 2,
          title: 'Modern Tokyo',
          activities: [
            { time: 'Morning', activity: 'Shibuya Crossing & Harajuku', icon: 'walk-outline' },
            { time: 'Afternoon', activity: 'Meiji Shrine & Yoyogi Park', icon: 'leaf-outline' },
            { time: 'Evening', activity: 'Shinjuku nightlife', icon: 'moon-outline' },
          ],
        },
        {
          dayNumber: 3,
          title: 'Culture Day',
          activities: [
            { time: 'Morning', activity: 'Tsukiji Outer Market', icon: 'restaurant-outline' },
            { time: 'Afternoon', activity: 'Imperial Palace gardens', icon: 'flower-outline' },
            { time: 'Evening', activity: 'Ginza shopping district', icon: 'cart-outline' },
          ],
        },
        {
          dayNumber: 4,
          title: 'Day Trip',
          activities: [
            { time: 'Morning', activity: 'Train to Nikko', icon: 'train-outline' },
            { time: 'Afternoon', activity: 'Toshogu Shrine & Lake Chuzenji', icon: 'business' },
            { time: 'Evening', activity: 'Return to Tokyo', icon: 'train-outline' },
          ],
        },
        {
          dayNumber: 5,
          title: 'Technology & Food',
          activities: [
            { time: 'Morning', activity: 'Akihabara electronics district', icon: 'hardware-chip-outline' },
            { time: 'Afternoon', activity: 'TeamLab Borderless digital art', icon: 'color-palette-outline' },
            { time: 'Evening', activity: 'Sushi making class', icon: 'restaurant-outline' },
          ],
        },
        {
          dayNumber: 6,
          title: 'Departure',
          activities: [
            { time: 'Morning', activity: 'Last minute shopping', icon: 'cart-outline' },
            { time: 'Afternoon', activity: 'Relax at hotel', icon: 'bed-outline' },
            { time: 'Evening', activity: 'Airport transfer', icon: 'airplane' },
          ],
        },
      ],
    },
  ],
  Dubai: [
    {
      id: 'dubai-1',
      title: 'Dubai Luxury - 5 Days',
      duration: '5 Days / 4 Nights',
      price: 65000,
      rating: 4.8,
      reviews: 1100,
      type: 'premium',
      image: 'sparkles',
      highlights: ['Burj Khalifa', 'Palm Jumeirah', 'Dubai Mall', 'Desert Safari', 'Dubai Fountain'],
      inclusions: ['5-star hotel', 'Breakfast', 'Airport transfer', 'Desert safari', 'Guided tours'],
      exclusions: ['International flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Luxury Arrival',
          activities: [
            { time: 'Morning', activity: 'Arrival & 5-star hotel check-in', icon: 'airplane' },
            { time: 'Afternoon', activity: 'Burj Khalifa observation deck', icon: 'business-outline' },
            { time: 'Evening', activity: 'Dubai Fountain show & dinner', icon: 'water-outline' },
          ],
        },
        {
          dayNumber: 2,
          title: 'Modern Wonders',
          activities: [
            { time: 'Morning', activity: 'Dubai Mall & aquarium', icon: 'cart-outline' },
            { time: 'Afternoon', activity: 'Palm Jumeirah monorail', icon: 'train-outline' },
            { time: 'Evening', activity: 'Dubai Marina yacht cruise', icon: 'boat-outline' },
          ],
        },
        {
          dayNumber: 3,
          title: 'Desert Adventure',
          activities: [
            { time: 'Morning', activity: 'Desert safari with quad biking', icon: 'trail-sign' },
            { time: 'Afternoon', activity: 'Bedouin camp experience', icon: 'home-outline' },
            { time: 'Evening', activity: 'Traditional dinner & belly dance', icon: 'musical-notes-outline' },
          ],
        },
        {
          dayNumber: 4,
          title: 'Culture & Shopping',
          activities: [
            { time: 'Morning', activity: 'Dubai Museum & Bastakiya', icon: 'business' },
            { time: 'Afternoon', activity: 'Gold & spice souks', icon: 'cart-outline' },
            { time: 'Evening', activity: 'Burj Al Arab visit', icon: 'star-outline' },
          ],
        },
        {
          dayNumber: 5,
          title: 'Departure',
          activities: [
            { time: 'Morning', activity: 'Relax at hotel pool', icon: 'water-outline' },
            { time: 'Afternoon', activity: 'Last shopping', icon: 'cart-outline' },
            { time: 'Evening', activity: 'Airport transfer', icon: 'airplane' },
          ],
        },
      ],
    },
  ],
  Bali: [
    {
      id: 'bali-1',
      title: 'Bali Paradise - 7 Days',
      duration: '7 Days / 6 Nights',
      price: 35000,
      rating: 4.9,
      reviews: 2100,
      type: 'family',
      image: 'sunny',
      highlights: ['Ubud rice terraces', 'Beach hopping', 'Temple tours', 'Volcano trek', 'Spa treatments'],
      inclusions: ['Beach resort', 'Breakfast', 'Airport transfer', 'Guided tours', 'Spa session'],
      exclusions: ['International flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Arrival in Paradise',
          activities: [
            { time: 'Morning', activity: 'Arrival & resort check-in', icon: 'airplane' },
            { time: 'Afternoon', activity: 'Beach relaxation', icon: 'sunny' },
            { time: 'Evening', activity: 'Welcome dinner', icon: 'restaurant-outline' },
          ],
        },
        {
          dayNumber: 2,
          title: 'Ubud Culture',
          activities: [
            { time: 'Morning', activity: 'Sacred Monkey Forest', icon: 'paw-outline' },
            { time: 'Afternoon', activity: 'Rice terrace trek', icon: 'trail-sign' },
            { time: 'Evening', activity: 'Traditional dance performance', icon: 'musical-notes-outline' },
          ],
        },
        {
          dayNumber: 3,
          title: 'Temple Day',
          activities: [
            { time: 'Morning', activity: 'Tanah Lot Temple', icon: 'business' },
            { time: 'Afternoon', activity: 'Uluwatu Temple', icon: 'location' },
            { time: 'Evening', activity: 'Kecak fire dance', icon: 'flame-outline' },
          ],
        },
        {
          dayNumber: 4,
          title: 'Adventure Day',
          activities: [
            { time: 'Morning', activity: 'Mount Batur sunrise trek', icon: 'trail-sign' },
            { time: 'Afternoon', activity: 'Hot springs relaxation', icon: 'water-outline' },
            { time: 'Evening', activity: 'Spa treatment', icon: 'fitness-outline' },
          ],
        },
        {
          dayNumber: 5,
          title: 'Beach Paradise',
          activities: [
            { time: 'Morning', activity: 'Nusa Dua beach', icon: 'sunny' },
            { time: 'Afternoon', activity: 'Snorkeling at coral reefs', icon: 'water-outline' },
            { time: 'Evening', activity: 'Beachside dinner', icon: 'restaurant-outline' },
          ],
        },
        {
          dayNumber: 6,
          title: 'Water Sports',
          activities: [
            { time: 'Morning', activity: 'Jet skiing', icon: 'bicycle-outline' },
            { time: 'Afternoon', activity: 'Island hopping boat tour', icon: 'boat-outline' },
            { time: 'Evening', activity: 'Relaxation time', icon: 'bed-outline' },
          ],
        },
        {
          dayNumber: 7,
          title: 'Departure',
          activities: [
            { time: 'Morning', activity: 'Final beach time', icon: 'sunny' },
            { time: 'Afternoon', activity: 'Shopping & farewell lunch', icon: 'cart-outline' },
            { time: 'Evening', activity: 'Airport transfer', icon: 'airplane' },
          ],
        },
      ],
    },
  ],
  Maldives: [
    {
      id: 'maldives-1',
      title: 'Maldives Romance - 5 Days',
      duration: '5 Days / 4 Nights',
      price: 85000,
      rating: 4.9,
      reviews: 980,
      type: 'romantic',
      image: 'water-outline',
      highlights: ['Overwater villa', 'Private beach', 'Snorkeling', 'Sunset cruise', 'Couples spa'],
      inclusions: ['Overwater villa', 'All meals', 'Airport transfer', 'Water sports', 'Spa treatments'],
      exclusions: ['International flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Romantic Arrival',
          activities: [
            { time: 'Morning', activity: 'Seaplane transfer to resort', icon: 'airplane' },
            { time: 'Afternoon', activity: 'Overwater villa check-in', icon: 'home-outline' },
            { time: 'Evening', activity: 'Sunset champagne dinner', icon: 'restaurant-outline' },
          ],
        },
        {
          dayNumber: 2,
          title: 'Island Exploration',
          activities: [
            { time: 'Morning', activity: 'Snorkeling at house reef', icon: 'water-outline' },
            { time: 'Afternoon', activity: 'Picnic on private beach', icon: 'sunny' },
            { time: 'Evening', activity: 'Maldivian cooking demonstration', icon: 'restaurant-outline' },
          ],
        },
        {
          dayNumber: 3,
          title: 'Adventure Day',
          activities: [
            { time: 'Morning', activity: 'Dolphin watching tour', icon: 'eye-outline' },
            { time: 'Afternoon', activity: 'Kayaking in lagoon', icon: 'boat-outline' },
            { time: 'Evening', activity: 'Couples massage', icon: 'fitness-outline' },
          ],
        },
        {
          dayNumber: 4,
          title: 'Luxury & Leisure',
          activities: [
            { time: 'Morning', activity: 'Private yoga session', icon: 'body-outline' },
            { time: 'Afternoon', activity: 'Underwater photography', icon: 'camera-outline' },
            { time: 'Evening', activity: 'Beach barbecue dinner', icon: 'flame-outline' },
          ],
        },
        {
          dayNumber: 5,
          title: 'Departure',
          activities: [
            { time: 'Morning', activity: 'Final villa breakfast', icon: 'restaurant-outline' },
            { time: 'Afternoon', activity: 'Seaplane to airport', icon: 'airplane' },
            { time: 'Evening', activity: 'Flight home', icon: 'airplane' },
          ],
        },
      ],
    },
  ],
};

// Sample itineraries for top 5 Indian destinations
export const indianItineraries = {
  Jaipur: [
    {
      id: 'jaipur-1',
      title: 'Jaipur Heritage - 3 Days',
      duration: '3 Days / 2 Nights',
      price: 12000,
      rating: 4.6,
      reviews: 850,
      type: 'budget',
      image: 'business',
      highlights: ['Amber Fort', 'City Palace', 'Hawa Mahal', 'Jantar Mantar', 'Pink City walk'],
      inclusions: ['Hotel accommodation', 'Breakfast', 'Guided tours', 'Transportation', 'Entry tickets'],
      exclusions: ['Flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Welcome to the Pink City',
          activities: [
            { time: 'Morning', activity: 'Arrival at Jaipur Airport/Railway Station', icon: 'airplane', id: 'jaipur-arrival', customizable: false },
            { time: 'Morning', activity: 'Transfer to hotel in city center', icon: 'car-outline', id: 'jaipur-hotel-transfer', customizable: false },
            { time: 'Afternoon', activity: 'Visit majestic Amber Fort with elephant ride option', icon: 'business', id: 'amber-fort', customizable: true },
            { time: 'Afternoon', activity: 'Explore Jaigarh Fort (Fort of Victory)', icon: 'business-outline', id: 'jaigarh-fort', customizable: true },
            { time: 'Evening', activity: 'Visit City Palace complex', icon: 'location', id: 'city-palace', customizable: true },
            { time: 'Evening', activity: 'Traditional Rajasthani dinner', icon: 'restaurant-outline', id: 'jaipur-dinner1', customizable: true },
            { time: 'Evening', activity: 'Overnight at hotel', icon: 'bed-outline', id: 'jaipur-night1', customizable: false },
          ],
        },
        {
          dayNumber: 2,
          title: 'Palaces, Observatories & Culture',
          activities: [
            { time: 'Morning', activity: 'Breakfast at hotel', icon: 'restaurant-outline', id: 'jaipur-breakfast2', customizable: false },
            { time: 'Morning', activity: 'Visit Hawa Mahal (Palace of Winds)', icon: 'business-outline', id: 'hawa-mahal', customizable: true },
            { time: 'Morning', activity: 'Explore Jantar Mantar astronomical observatory', icon: 'library-outline', id: 'jantar-mantar', customizable: true },
            { time: 'Afternoon', activity: 'Guided walking tour of Pink City old town', icon: 'walk-outline', id: 'pink-city-walk', customizable: true },
            { time: 'Afternoon', activity: 'Visit Johari Bazaar for jewelry shopping', icon: 'cart-outline', id: 'johari-bazaar', customizable: true },
            { time: 'Evening', activity: 'Traditional Rajasthani cultural dance show', icon: 'musical-notes-outline', id: 'cultural-dance', customizable: true },
            { time: 'Evening', activity: 'Dinner with folk music performance', icon: 'restaurant-outline', id: 'folk-dinner', customizable: true },
            { time: 'Evening', activity: 'Overnight at hotel', icon: 'bed-outline', id: 'jaipur-night2', customizable: false },
          ],
        },
        {
          dayNumber: 3,
          title: 'Museums & Farewell',
          activities: [
            { time: 'Morning', activity: 'Breakfast at hotel', icon: 'restaurant-outline', id: 'jaipur-breakfast3', customizable: false },
            { time: 'Morning', activity: 'Visit Albert Hall Museum (Victoria Memorial)', icon: 'library-outline', id: 'albert-hall', customizable: true },
            { time: 'Afternoon', activity: 'Explore Birla Temple with marble carvings', icon: 'location', id: 'birla-temple', customizable: true },
            { time: 'Afternoon', activity: 'Shopping at local handicraft markets', icon: 'cart-outline', id: 'handicraft-shopping', customizable: true },
            { time: 'Evening', activity: 'Farewell lunch with Rajasthani thali', icon: 'restaurant-outline', id: 'farewell-lunch', customizable: true },
            { time: 'Evening', activity: 'Transfer to airport/railway station', icon: 'car-outline', id: 'jaipur-departure', customizable: false },
            { time: 'Evening', activity: 'Journey home with wonderful memories', icon: 'airplane', id: 'jaipur-home', customizable: false },
          ],
        },
      ],
    },
  ],
  Goa: [
    {
      id: 'goa-1',
      title: 'Goa Beach Paradise - 4 Days',
      duration: '4 Days / 3 Nights',
      price: 15000,
      rating: 4.7,
      reviews: 1200,
      type: 'family',
      image: 'sunny',
      highlights: ['Calangute Beach', 'Anjuna Beach', 'Fort Aguada', 'Dudhsagar Falls', 'Water sports'],
      inclusions: ['Beach resort', 'Breakfast', 'Airport transfer', 'Water sports', 'Guided tours'],
      exclusions: ['Flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Beach Arrival',
          activities: [
            { time: 'Morning', activity: 'Arrival & resort check-in', icon: 'airplane' },
            { time: 'Afternoon', activity: 'Calangute Beach relaxation', icon: 'sunny' },
            { time: 'Evening', activity: 'Beachside dinner', icon: 'restaurant-outline' },
          ],
        },
        {
          dayNumber: 2,
          title: 'North Goa Exploration',
          activities: [
            { time: 'Morning', activity: 'Anjuna & Vagator beaches', icon: 'sunny' },
            { time: 'Afternoon', activity: 'Fort Aguada lighthouse', icon: 'business-outline' },
            { time: 'Evening', activity: 'Shacks hopping & nightlife', icon: 'moon-outline' },
          ],
        },
        {
          dayNumber: 3,
          title: 'Adventure Day',
          activities: [
            { time: 'Morning', activity: 'Dudhsagar Falls trek', icon: 'trail-sign' },
            { time: 'Afternoon', activity: 'Water sports at Baga', icon: 'water-outline' },
            { time: 'Evening', activity: 'Goan seafood dinner', icon: 'restaurant-outline' },
          ],
        },
        {
          dayNumber: 4,
          title: 'Departure',
          activities: [
            { time: 'Morning', activity: 'Last beach time', icon: 'sunny' },
            { time: 'Afternoon', activity: 'Shopping & farewell', icon: 'cart-outline' },
            { time: 'Evening', activity: 'Airport transfer', icon: 'airplane' },
          ],
        },
      ],
    },
  ],
  Kerala: [
    {
      id: 'kerala-1',
      title: 'Kerala Backwaters - 5 Days',
      duration: '5 Days / 4 Nights',
      price: 20000,
      rating: 4.8,
      reviews: 1600,
      type: 'premium',
      image: 'leaf',
      highlights: ['Houseboat stay', 'Munnar tea plantations', 'Periyar wildlife', 'Kathakali dance', 'Ayurvedic spa'],
      inclusions: ['Houseboat accommodation', 'All meals', 'Guided tours', 'Transfers', 'Spa session'],
      exclusions: ['Flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Arrival & Munnar',
          activities: [
            { time: 'Morning', activity: 'Arrival at Kochi airport', icon: 'airplane' },
            { time: 'Afternoon', activity: 'Drive to Munnar', icon: 'car-outline' },
            { time: 'Evening', activity: 'Tea plantation visit', icon: 'leaf-outline' },
          ],
        },
        {
          dayNumber: 2,
          title: 'Munnar Exploration',
          activities: [
            { time: 'Morning', activity: 'Eravikulam National Park', icon: 'paw-outline' },
            { time: 'Afternoon', activity: 'Mattupetty Dam & echo point', icon: 'water-outline' },
            { time: 'Evening', activity: 'Spice plantation tour', icon: 'leaf-outline' },
          ],
        },
        {
          dayNumber: 3,
          title: 'Periyar Wildlife',
          activities: [
            { time: 'Morning', activity: 'Drive to Periyar', icon: 'car-outline' },
            { time: 'Afternoon', activity: 'Wildlife sanctuary boat safari', icon: 'boat-outline' },
            { time: 'Evening', activity: 'Cultural performance', icon: 'musical-notes-outline' },
          ],
        },
        {
          dayNumber: 4,
          title: 'Backwaters',
          activities: [
            { time: 'Morning', activity: 'Drive to Alleppey', icon: 'car-outline' },
            { time: 'Afternoon', activity: 'Houseboat cruise', icon: 'boat-outline' },
            { time: 'Evening', activity: 'Traditional Kerala dinner', icon: 'restaurant-outline' },
          ],
        },
        {
          dayNumber: 5,
          title: 'Departure',
          activities: [
            { time: 'Morning', activity: 'Backwater exploration', icon: 'boat-outline' },
            { time: 'Afternoon', activity: 'Drive to airport', icon: 'car-outline' },
            { time: 'Evening', activity: 'Flight home', icon: 'airplane' },
          ],
        },
      ],
    },
  ],
  Manali: [
    {
      id: 'manali-1',
      title: 'Manali Adventure - 4 Days',
      duration: '4 Days / 3 Nights',
      price: 18000,
      rating: 4.7,
      reviews: 1100,
      type: 'adventure',
      image: 'trail-sign',
      highlights: ['Rohtang Pass', 'Solang Valley', 'Hadimba Temple', 'River rafting', 'Paragliding'],
      inclusions: ['Mountain resort', 'Breakfast', 'Transfers', 'Adventure activities', 'Guide'],
      exclusions: ['Flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Arrival in Mountains',
          activities: [
            { time: 'Morning', activity: 'Arrival & resort check-in', icon: 'airplane' },
            { time: 'Afternoon', activity: 'Mall road exploration', icon: 'walk-outline' },
            { time: 'Evening', activity: 'Hadimba Temple visit', icon: 'location' },
          ],
        },
        {
          dayNumber: 2,
          title: 'Adventure Day',
          activities: [
            { time: 'Morning', activity: 'Solang Valley skiing/snowboarding', icon: 'snow-outline' },
            { time: 'Afternoon', activity: 'Paragliding experience', icon: 'airplane-outline' },
            { time: 'Evening', activity: 'Bonfire & local cuisine', icon: 'flame-outline' },
          ],
        },
        {
          dayNumber: 3,
          title: 'Nature & Culture',
          activities: [
            { time: 'Morning', activity: 'Rohtang Pass (seasonal)', icon: 'trail-sign' },
            { time: 'Afternoon', activity: 'Hot springs & Vashisht village', icon: 'water-outline' },
            { time: 'Evening', activity: 'Cultural dance show', icon: 'musical-notes-outline' },
          ],
        },
        {
          dayNumber: 4,
          title: 'Departure',
          activities: [
            { time: 'Morning', activity: 'River rafting', icon: 'water-outline' },
            { time: 'Afternoon', activity: 'Shopping & farewell', icon: 'cart-outline' },
            { time: 'Evening', activity: 'Airport transfer', icon: 'airplane' },
          ],
        },
      ],
    },
  ],
  Varanasi: [
    {
      id: 'varanasi-1',
      title: 'Varanasi Spiritual - 3 Days',
      duration: '3 Days / 2 Nights',
      price: 10000,
      rating: 4.5,
      reviews: 750,
      type: 'budget',
      image: 'flower',
      highlights: ['Ganges Aarti', 'Ghats exploration', 'Temples tour', 'Boat ride', 'Sarnath'],
      inclusions: ['Heritage hotel', 'Breakfast', 'Boat ride', 'Guided tours', 'Aarti ceremony'],
      exclusions: ['Flights', 'Personal expenses', 'Travel insurance'],
      dayPlans: [
        {
          dayNumber: 1,
          title: 'Sacred Arrival',
          activities: [
            { time: 'Morning', activity: 'Arrival & hotel check-in', icon: 'airplane' },
            { time: 'Afternoon', activity: 'Sarnath Buddha temple', icon: 'location' },
            { time: 'Evening', activity: 'Ganges Aarti at Dashashwamedh Ghat', icon: 'flame-outline' },
          ],
        },
        {
          dayNumber: 2,
          title: 'Ghats & Temples',
          activities: [
            { time: 'Morning', activity: 'Boat ride on Ganges', icon: 'boat-outline' },
            { time: 'Afternoon', activity: 'Temples of Varanasi', icon: 'business' },
            { time: 'Evening', activity: 'Evening Aarti & meditation', icon: 'body-outline' },
          ],
        },
        {
          dayNumber: 3,
          title: 'Departure',
          activities: [
            { time: 'Morning', activity: 'Assi Ghat & silk weaving', icon: 'business-outline' },
            { time: 'Afternoon', activity: 'Shopping & farewell', icon: 'cart-outline' },
            { time: 'Evening', activity: 'Airport/railway transfer', icon: 'train-outline' },
          ],
        },
      ],
    },
  ],
};

export const getSampleItineraries = (destination) => {
  const normalizedDest = destination.toLowerCase();
  
  // Check international destinations
  if (internationalItineraries[destination]) {
    return internationalItineraries[destination];
  }
  
  // Check Indian destinations
  if (indianItineraries[destination]) {
    return indianItineraries[destination];
  }
  
  // Return empty array if no match
  return [];
};