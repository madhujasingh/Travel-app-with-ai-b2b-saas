import React from 'react';

// Comprehensive activities for each destination that users can add to their day-wise itinerary
export const destinationActivities = {
  Paris: [
    // Iconic Landmarks & Museums
    { id: 'eiffel-tower-guided', name: 'Eiffel Tower with Guided Tour', time: '2-3 hours', icon: 'business-outline', category: 'Landmark', description: 'Skip-the-line access with elevator to top level and audio guide' },
    { id: 'louvre-museum-skip', name: 'Louvre Museum Skip-the-Line', time: '3-4 hours', icon: 'library-outline', category: 'Museum', description: 'Priority entry to see Mona Lisa and ancient artifacts' },
    { id: 'notre-dame-exterior', name: 'Notre-Dame Cathedral Exterior Tour', time: '1-2 hours', icon: 'location', category: 'Religious', description: 'Explore the stunning Gothic architecture and history' },
    { id: 'versailles-palace-full', name: 'Versailles Palace & Gardens Full Tour', time: '4-5 hours', icon: 'business', category: 'Palace', description: 'Complete palace tour with gardens and fountains' },
    { id: 'arc-triomphe-terrace', name: 'Arc de Triomphe Terrace Visit', time: '1-2 hours', icon: 'flag-outline', category: 'Landmark', description: 'Panoramic views and historical exhibits' },

    // Experiences & Activities
    { id: 'seine-cruise-dinner', name: 'Seine River Dinner Cruise', time: '2-3 hours', icon: 'boat-outline', category: 'Activity', description: 'Romantic cruise with French cuisine and illuminated monuments' },
    { id: 'montmartre-art-walk', name: 'Montmartre Artists\' Quarter Walking Tour', time: '2-3 hours', icon: 'walk-outline', category: 'Culture', description: 'Explore bohemian streets, Sacré-Cœur Basilica, and street artists' },
    { id: 'champs-elysees-shopping', name: 'Champs-Élysées Luxury Shopping', time: '2-3 hours', icon: 'cart-outline', category: 'Shopping', description: 'World-class shopping and people-watching' },
    { id: 'tuileries-garden-picnic', name: 'Tuileries Garden Picnic & Stroll', time: '1-2 hours', icon: 'leaf-outline', category: 'Nature', description: 'Relax in beautiful gardens with fountains and statues' },
    { id: 'palais-garnier-opera', name: 'Palais Garnier Opera House Tour', time: '1-2 hours', icon: 'musical-notes-outline', category: 'Culture', description: 'Marvel at the opulent architecture and history' },
    { id: 'latin-quarter-cafe', name: 'Latin Quarter Café Experience', time: '2-3 hours', icon: 'cafe-outline', category: 'Food', description: 'Traditional French cafés and student atmosphere' },
    { id: 'luxembourg-gardens', name: 'Luxembourg Gardens Exploration', time: '1-2 hours', icon: 'leaf-outline', category: 'Nature', description: 'Beautiful gardens with Medici Fountain and palace views' },
    { id: 'sainte-chapelle-visit', name: 'Sainte-Chapelle Stained Glass Tour', time: '1 hour', icon: 'business-outline', category: 'Religious', description: 'Breathtaking medieval stained glass windows' },

    // Food & Drink Experiences
    { id: 'french-cooking-class', name: 'French Cooking Class', time: '3-4 hours', icon: 'restaurant-outline', category: 'Food', description: 'Learn to make authentic French dishes with local chef' },
    { id: 'wine-tasting-louvre', name: 'Wine Tasting at Les Caves du Louvre', time: '1-2 hours', icon: 'wine-outline', category: 'Food', description: 'Curated French wines in historic cellar' },
    { id: 'pastry-masterclass', name: 'Paris Pastry Masterclass', time: '2-3 hours', icon: 'restaurant-outline', category: 'Food', description: 'Learn to make croissants and macarons' },
    { id: 'food-tour-marais', name: 'Le Marais Food Walking Tour', time: '3 hours', icon: 'walk-outline', category: 'Food', description: 'Sample French cheeses, wines, and street food' },

    // Unique Experiences
    { id: 'perfume-workshop', name: 'Perfume Making Workshop', time: '2 hours', icon: 'color-palette-outline', category: 'Activity', description: 'Create your own perfume at Fragonard workshop' },
    { id: 'fashion-show-backstage', name: 'Fashion Show Backstage Tour', time: '2-3 hours', icon: 'shirt-outline', category: 'Culture', description: 'Exclusive access to Paris fashion world' },
    { id: 'photography-workshop', name: 'Paris Photography Workshop', time: '3-4 hours', icon: 'camera-outline', category: 'Activity', description: 'Professional photography tour of iconic spots' },
    { id: 'hot-air-balloon', name: 'Paris Hot Air Balloon Ride', time: '1-2 hours', icon: 'airplane-outline', category: 'Adventure', description: 'Scenic views over Paris countryside' },
  ],
  Jaipur: [
    // Forts & Palaces
    { id: 'amber-fort-full', name: 'Amber Fort Complete Tour with Elephant Ride', time: '3-4 hours', icon: 'business', category: 'Fort', description: 'UNESCO site with palaces, courtyards, and optional elephant ride' },
    { id: 'city-palace-museum', name: 'City Palace Museum & Complex', time: '2-3 hours', icon: 'location', category: 'Palace', description: 'Royal residence with artifacts, courtyards, and history' },
    { id: 'hawa-mahal-full', name: 'Hawa Mahal (Palace of Winds) Complete Tour', time: '1-2 hours', icon: 'business-outline', category: 'Palace', description: 'Lattice-work palace with museum and city views' },
    { id: 'jaigarh-fort', name: 'Jaigarh Fort (Fort of Victory)', time: '2-3 hours', icon: 'business', category: 'Fort', description: 'Massive fort with world\'s largest cannon and panoramic views' },
    { id: 'nahargarh-fort', name: 'Nahargarh Fort Tiger Fort Visit', time: '2 hours', icon: 'business-outline', category: 'Fort', description: 'Hilltop fort with wax museum and sunset views' },

    // Observatories & Museums
    { id: 'jantar-mantar-observatory', name: 'Jantar Mantar Astronomical Observatory', time: '1-2 hours', icon: 'library-outline', category: 'Observatory', description: 'UNESCO site with massive astronomical instruments' },
    { id: 'albert-hall-museum', name: 'Albert Hall Museum Tour', time: '2 hours', icon: 'library-outline', category: 'Museum', description: 'Indo-Saracenic architecture with artifacts and Egyptian mummy' },
    { id: 'birla-temple-jaipur', name: 'Birla Lakshmi Narayan Temple', time: '1 hour', icon: 'location', category: 'Religious', description: 'White marble temple with intricate carvings' },

    // Cultural Experiences
    { id: 'block-printing-workshop', name: 'Traditional Block Printing Workshop', time: '2-3 hours', icon: 'business-outline', category: 'Craft', description: 'Learn Rajasthani textile printing techniques' },
    { id: 'cultural-dance-show', name: 'Rajasthani Folk Dance & Music Show', time: '1-2 hours', icon: 'musical-notes-outline', category: 'Culture', description: 'Traditional dances, music, and puppet shows' },
    { id: 'kite-festival-experience', name: 'Kite Flying Experience (Seasonal)', time: '2-3 hours', icon: 'airplane-outline', category: 'Culture', description: 'Traditional kite festival with local artisans' },
    { id: 'blue-pottery-workshop', name: 'Blue Pottery Making Workshop', time: '2 hours', icon: 'color-palette-outline', category: 'Craft', description: 'Create traditional blue glazed pottery' },

    // Nature & Wildlife
    { id: 'jhalana-leopard-safari', name: 'Jhalana Leopard Safari', time: '3-4 hours', icon: 'paw-outline', category: 'Wildlife', description: 'India\'s first leopard reserve with guided jeep safari' },
    { id: 'jawahar-circle-gardens', name: 'Jawahar Circle Musical Fountain Show', time: '2 hours', icon: 'water-outline', category: 'Nature', description: 'Asia\'s largest circular park with evening light show' },

    // Food Experiences
    { id: 'rajasthani-thali-dinner', name: 'Authentic Rajasthani Thali Dinner', time: '1-2 hours', icon: 'restaurant-outline', category: 'Food', description: 'Traditional vegetarian thali with folk music' },
    { id: 'spice-market-tour', name: 'Johari Bazaar Spice Market Tour', time: '1-2 hours', icon: 'cart-outline', category: 'Food', description: 'Explore spice markets and sample local flavors' },
    { id: 'cooking-class-rajasthani', name: 'Rajasthani Cooking Class', time: '3 hours', icon: 'restaurant-outline', category: 'Food', description: 'Learn to cook traditional Rajasthani dishes' },

    // Adventure Activities
    { id: 'hot-air-balloon-jaipur', name: 'Jaipur Hot Air Balloon Safari', time: '2-3 hours', icon: 'airplane-outline', category: 'Adventure', description: 'Sunrise balloon ride over forts and palaces' },
    { id: 'elephant-sanctuary', name: 'Elephant Sanctuary Visit', time: '2 hours', icon: 'paw-outline', category: 'Wildlife', description: 'Ethical elephant interaction and care facility' },
    { id: 'camel-safari-village', name: 'Camel Safari in Rural Village', time: '3-4 hours', icon: 'paw-outline', category: 'Adventure', description: 'Traditional desert safari experience' },
  ],
  Goa: [
    // Beaches & Water Activities
    { id: 'palolem-beach-relax', name: 'Palolem Beach Relaxation & Activities', time: '3-4 hours', icon: 'sunny', category: 'Beach', description: 'Kayaking, dolphin watching, and beachside dining' },
    { id: 'calangute-beach-water-sports', name: 'Calangute Beach Water Sports', time: '2-3 hours', icon: 'water-outline', category: 'Beach', description: 'Jet skiing, parasailing, and banana boat rides' },
    { id: 'baga-beach-nightlife', name: 'Baga Beach Nightlife Experience', time: '3-4 hours', icon: 'moon-outline', category: 'Beach', description: 'Beach parties, live music, and seafood shacks' },
    { id: 'anjuna-beach-flea-market', name: 'Anjuna Beach Flea Market', time: '2-3 hours', icon: 'cart-outline', category: 'Beach', description: 'Hippie market with handicrafts and street food' },
    { id: 'arambol-beach-yoga', name: 'Arambol Beach Yoga & Bohemian Scene', time: '2 hours', icon: 'body-outline', category: 'Beach', description: 'Morning yoga sessions and beachside cafes' },

    // Waterfalls & Nature
    { id: 'dudhsagar-falls-trek', name: 'Dudhsagar Waterfalls Trek & Visit', time: '4-5 hours', icon: 'water-outline', category: 'Nature', description: 'Second highest waterfall with jeep safari option' },
    { id: 'arvalem-caves-trek', name: 'Arvalem Caves (Pandava Caves) Trek', time: '3 hours', icon: 'trail-sign', category: 'Adventure', description: 'Ancient caves from Mahabharata era with mythology tour' },
    { id: 'spice-plantation-tour', name: 'Spice Plantation & Organic Farm Tour', time: '2-3 hours', icon: 'leaf-outline', category: 'Nature', description: 'Tropical spice gardens with traditional lunch' },
    { id: 'bird-sanctuary-visit', name: 'Dr. Salim Ali Bird Sanctuary', time: '2 hours', icon: 'paw-outline', category: 'Nature', description: 'Mangrove sanctuary with migratory birds' },

    // Historical Sites
    { id: 'fort-aguada-light-show', name: 'Fort Aguada Light & Sound Show', time: '2 hours', icon: 'business-outline', category: 'Historical', description: 'Portuguese fort with evening light show and views' },
    { id: 'basilica-bom-jesus', name: 'Basilica of Bom Jesus & Old Goa', time: '2-3 hours', icon: 'location', category: 'Religious', description: 'UNESCO site with St. Francis Xavier\'s tomb' },
    { id: 'se-cathedral-tour', name: 'Sé Cathedral & Church Complex', time: '1-2 hours', icon: 'location', category: 'Religious', description: 'Largest church in Asia with colonial architecture' },
    { id: 'cabo-rama-fort-hike', name: 'Cabo de Rama Fort Hiking Trail', time: '2-3 hours', icon: 'trail-sign', category: 'Historical', description: 'Ancient fort with coastal views and history' },

    // Wildlife & Adventure
    { id: 'bondla-wildlife-safari', name: 'Bondla Wildlife Sanctuary Safari', time: '3 hours', icon: 'paw-outline', category: 'Wildlife', description: 'Forest safaris and spice plantation visits' },
    { id: 'cotigao-wildlife-sanctuary', name: 'Cotigao Wildlife Sanctuary Trek', time: '4 hours', icon: 'trail-sign', category: 'Wildlife', description: 'Dense forest with wildlife and bird watching' },
    { id: 'kayaking-mangroves', name: 'Mandovi River Kayaking & Mangroves', time: '2-3 hours', icon: 'boat-outline', category: 'Adventure', description: 'Eco-friendly kayaking through backwaters' },
    { id: 'scuba-diving-grand-island', name: 'Grand Island Scuba Diving', time: '4-5 hours', icon: 'water-outline', category: 'Adventure', description: 'Coral reefs and underwater exploration' },

    // Cultural Experiences
    { id: 'tiatr-traditional-theater', name: 'Tiatr Traditional Konkani Theater', time: '2 hours', icon: 'musical-notes-outline', category: 'Culture', description: 'Goan musical theater performance' },
    { id: 'latin-quarter-fontainhas', name: 'Fontainhas Latin Quarter Walking Tour', time: '2 hours', icon: 'walk-outline', category: 'Culture', description: 'Colorful Portuguese-style neighborhood' },
    { id: 'feni-distillery-tour', name: 'Feni Distillery & Cashew Tour', time: '2-3 hours', icon: 'wine-outline', category: 'Culture', description: 'Traditional Goan spirit production' },
    { id: 'hippie-market-ingu', name: 'Ingo Hippie Market Shopping', time: '2 hours', icon: 'cart-outline', category: 'Culture', description: 'International market with unique souvenirs' },

    // Food & Drink
    { id: 'seafood-thali-dinner', name: 'Authentic Goan Seafood Thali', time: '1-2 hours', icon: 'restaurant-outline', category: 'Food', description: 'Traditional coastal cuisine at beach shack' },
    { id: 'feni-tasting-workshop', name: 'Feni Tasting & Cocktail Workshop', time: '2 hours', icon: 'wine-outline', category: 'Food', description: 'Learn about Goan spirits and mixology' },
    { id: 'cooking-class-goan', name: 'Goan Catholic Cooking Class', time: '3 hours', icon: 'restaurant-outline', category: 'Food', description: 'Learn vindaloo, xacuti, and other specialties' },
    { id: 'mandovi-river-cruise', name: 'Mandovi River Sunset Cruise', time: '2 hours', icon: 'boat-outline', category: 'Food', description: 'River cruise with Goan dinner and music' },
  ],
  Dubai: [
    // Iconic Landmarks
    { id: 'burj-khalifa-atmosphere', name: 'Burj Khalifa At The Top Experience', time: '2-3 hours', icon: 'business-outline', category: 'Landmark', description: 'World\'s tallest building with observation decks and champagne' },
    { id: 'palm-jumeirah-monorail', name: 'Palm Jumeirah Monorail & Beach', time: '2 hours', icon: 'train-outline', category: 'Landmark', description: 'Artificial island with luxury resorts and beaches' },
    { id: 'dubai-mall-shopping', name: 'Dubai Mall & Aquarium Visit', time: '3-4 hours', icon: 'cart-outline', category: 'Shopping', description: 'World\'s largest mall with aquarium and ice rink' },
    { id: 'burj-al-arab-visit', name: 'Burj Al Arab Hotel Tour', time: '1-2 hours', icon: 'star-outline', category: 'Luxury', description: '7-star hotel exterior visit and afternoon tea' },

    // Desert Experiences
    { id: 'desert-safari-dune-bashing', name: 'Desert Safari with Dune Bashing', time: '4-5 hours', icon: 'trail-sign', category: 'Adventure', description: '4x4 desert drive, sandboarding, and Bedouin camp dinner' },
    { id: 'hot-air-balloon-dubai', name: 'Dubai Desert Hot Air Balloon', time: '2-3 hours', icon: 'airplane-outline', category: 'Adventure', description: 'Sunrise balloon ride over Arabian desert' },
    { id: 'falcon-hospital-tour', name: 'Dubai Falcon Hospital Tour', time: '1-2 hours', icon: 'paw-outline', category: 'Culture', description: 'Learn about falconry and traditional Arab hunting' },

    // Cultural Experiences
    { id: 'gold-souk-exploration', name: 'Gold Souk & Spice Market Tour', time: '2 hours', icon: 'cart-outline', category: 'Culture', description: 'Traditional markets with gold, spices, and bargaining' },
    { id: 'bastakiya-heritage-walk', name: 'Bastakiya Heritage Walk', time: '1-2 hours', icon: 'walk-outline', category: 'Culture', description: 'Historic district with wind towers and architecture' },
    { id: 'dhow-cruise-dinner', name: 'Traditional Dhow Cruise Dinner', time: '2-3 hours', icon: 'boat-outline', category: 'Culture', description: 'Arabian Gulf cruise with seafood and entertainment' },

    // Modern Dubai
    { id: 'dubai-fountain-show', name: 'Dubai Fountain Evening Show', time: '1 hour', icon: 'water-outline', category: 'Entertainment', description: 'World\'s largest choreographed fountain show' },
    { id: 'dubai-opera-visit', name: 'Dubai Opera House Tour', time: '1-2 hours', icon: 'musical-notes-outline', category: 'Culture', description: 'Cultural performances and architecture tour' },
    { id: 'dubai-frame-visit', name: 'Dubai Frame Monument', time: '1-2 hours', icon: 'business-outline', category: 'Landmark', description: 'Largest picture frame in the world with city views' },

    // Adventure & Sports
    { id: 'sky-dive-dubai', name: 'Dubai Skydive Experience', time: '2-3 hours', icon: 'airplane-outline', category: 'Adventure', description: 'Tandem skydive over Palm Jumeirah' },
    { id: 'zipline-dubai', name: 'Dubai Zipline Adventure', time: '1-2 hours', icon: 'bicycle-outline', category: 'Adventure', description: 'High-speed zipline with city views' },
    { id: 'wakeboarding-marina', name: 'Dubai Marina Wakeboarding', time: '2 hours', icon: 'water-outline', category: 'Sports', description: 'Water sports in the marina district' },
  ],
  Bali: [
    // Temples & Culture
    { id: 'tanah-lot-temple', name: 'Tanah Lot Temple Sunset Visit', time: '2 hours', icon: 'location', category: 'Religious', description: 'Iconic sea temple with traditional dance performance' },
    { id: 'uluwatu-temple-kecak', name: 'Uluwatu Temple & Kecak Dance', time: '2-3 hours', icon: 'business', category: 'Religious', description: 'Cliffside temple with fire dance and ocean views' },
    { id: 'besakih-mother-temple', name: 'Besakih Mother Temple Tour', time: '3 hours', icon: 'location', category: 'Religious', description: 'Largest Hindu temple complex in Bali' },
    { id: 'monkey-forest-ubud', name: 'Sacred Monkey Forest Ubud', time: '2 hours', icon: 'paw-outline', category: 'Nature', description: 'Ancient temple complex with hundreds of monkeys' },

    // Nature & Rice Terraces
    { id: 'ubud-rice-terrace-trek', name: 'Ubud Rice Terrace Trekking', time: '3-4 hours', icon: 'leaf-outline', category: 'Nature', description: 'Scenic trails through UNESCO-listed rice terraces' },
    { id: 'mount-batur-sunrise-trek', name: 'Mount Batur Sunrise Trek', time: '5-6 hours', icon: 'trail-sign', category: 'Adventure', description: 'Volcano climb with crater lake and breakfast views' },
    { id: 'tegalalang-rice-terraces', name: 'Tegalalang Rice Terrace Visit', time: '2 hours', icon: 'leaf-outline', category: 'Nature', description: 'Famous terraced rice fields with swing photos' },

    // Beaches & Water Activities
    { id: 'nusa-dua-beach', name: 'Nusa Dua Beach Relaxation', time: '3-4 hours', icon: 'sunny', category: 'Beach', description: 'Luxury beach with water sports and spa access' },
    { id: 'seminyak-beach-sunset', name: 'Seminyak Beach Sunset Walk', time: '2 hours', icon: 'sunny', category: 'Beach', description: 'Popular beach with beach clubs and shopping' },
    { id: 'jimbaran-beach-seafood', name: 'Jimbaran Beach Seafood Dinner', time: '2-3 hours', icon: 'restaurant-outline', category: 'Beach', description: 'Fresh seafood grills on the beach at sunset' },

    // Cultural Experiences
    { id: 'traditional-massage-spa', name: 'Traditional Balinese Massage', time: '1-2 hours', icon: 'fitness-outline', category: 'Wellness', description: 'Ayurvedic massage with essential oils and techniques' },
    { id: 'cooking-class-bali', name: 'Traditional Balinese Cooking Class', time: '3-4 hours', icon: 'restaurant-outline', category: 'Food', description: 'Learn to cook nasi goreng, satay, and babi guling' },
    { id: 'silver-jewelry-workshop', name: 'Traditional Silver Jewelry Workshop', time: '2 hours', icon: 'color-palette-outline', category: 'Craft', description: 'Learn Balinese silver smithing techniques' },
    { id: 'batik-painting-class', name: 'Batik Painting & Fabric Art', time: '2-3 hours', icon: 'brush-outline', category: 'Craft', description: 'Traditional Indonesian fabric painting' },

    // Adventure Activities
    { id: 'white-water-rafting', name: 'Ayung River White Water Rafting', time: '3-4 hours', icon: 'water-outline', category: 'Adventure', description: 'Class II-III rapids with jungle scenery' },
    { id: 'scuba-diving-nusa-penida', name: 'Nusa Penida Scuba Diving', time: '4-5 hours', icon: 'water-outline', category: 'Adventure', description: 'Crystal clear waters with manta rays and coral gardens' },
    { id: 'atv-quad-bike', name: 'ATV Quad Bike Adventure', time: '2-3 hours', icon: 'bicycle-outline', category: 'Adventure', description: 'Off-road adventure through rice fields and villages' },
  ],
  Maldives: [
    // Water Activities
    { id: 'scuba-diving-maldives', name: 'Scuba Diving at House Reef', time: '3-4 hours', icon: 'water-outline', category: 'Adventure', description: 'Professional dive with coral gardens and marine life' },
    { id: 'snorkeling-picnic', name: 'Private Snorkeling with Picnic', time: '3 hours', icon: 'water-outline', category: 'Adventure', description: 'Guided snorkeling with underwater photography' },
    { id: 'dolphin-watching-tour', name: 'Dolphin Watching Boat Tour', time: '2-3 hours', icon: 'eye-outline', category: 'Nature', description: 'Eco-friendly tour with resident dolphins' },
    { id: 'fishing-trip-traditional', name: 'Traditional Maldivian Fishing Trip', time: '4 hours', icon: 'boat-outline', category: 'Culture', description: 'Learn traditional fishing methods and cook fresh catch' },

    // Island Activities
    { id: 'island-hopping-speedboat', name: 'Island Hopping Speedboat Tour', time: '4-5 hours', icon: 'boat-outline', category: 'Adventure', description: 'Visit multiple islands with snorkeling stops' },
    { id: 'sandbank-picnic', name: 'Sandbank Picnic Experience', time: '3 hours', icon: 'sunny', category: 'Nature', description: 'Private picnic on submerged sandbank with champagne' },
    { id: 'submarine-dinner', name: 'Underwater Restaurant Experience', time: '2 hours', icon: 'restaurant-outline', category: 'Luxury', description: '5-course dinner 5m underwater with ocean views' },

    // Wellness & Relaxation
    { id: 'couples-spa-treatment', name: 'Couples Spa Treatment', time: '2 hours', icon: 'fitness-outline', category: 'Wellness', description: 'Romantic spa with traditional Maldivian therapies' },
    { id: 'yoga-on-beach', name: 'Sunrise Yoga on Private Beach', time: '1-2 hours', icon: 'body-outline', category: 'Wellness', description: 'Morning yoga session with meditation and breakfast' },
    { id: 'meditation-retreat', name: 'Meditation & Mindfulness Retreat', time: '2-3 hours', icon: 'body-outline', category: 'Wellness', description: 'Guided meditation with ocean sound therapy' },

    // Cultural Experiences
    { id: 'local-village-visit', name: 'Local Island Village Visit', time: '2 hours', icon: 'home-outline', category: 'Culture', description: 'Cultural exchange with local families and traditions' },
    { id: 'traditional-bodu-beru', name: 'Traditional Bodu Beru Performance', time: '1-2 hours', icon: 'musical-notes-outline', category: 'Culture', description: 'Drum and dance performance with Maldivian music' },
    { id: 'cooking-class-maldivian', name: 'Maldivian Cooking Class', time: '2-3 hours', icon: 'restaurant-outline', category: 'Food', description: 'Learn to cook traditional dishes like mas huni and garudhiya' },
  ],
  Manali: [
    // Adventure Activities
    { id: 'rohtang-pass-day-trip', name: 'Rohtang Pass Day Trip', time: '8-10 hours', icon: 'trail-sign', category: 'Adventure', description: 'Snow point with skiing, snowboarding, and scenic views' },
    { id: 'solang-valley-activities', name: 'Solang Valley Adventure Sports', time: '4-5 hours', icon: 'snow-outline', category: 'Adventure', description: 'Paragliding, zorbing, horse riding, and cable car' },
    { id: 'river-rafting-manali', name: 'Beas River White Water Rafting', time: '3-4 hours', icon: 'water-outline', category: 'Adventure', description: 'Class III-IV rapids with professional guides' },
    { id: 'paragliding-manali', name: 'Paragliding from Solang Valley', time: '1-2 hours', icon: 'airplane-outline', category: 'Adventure', description: 'Tandem flight with Himalayan views and photos' },

    // Trekking & Nature
    { id: 'hampta-pass-trek', name: 'Hampta Pass Trek (3-4 days)', time: '3-4 days', icon: 'trail-sign', category: 'Adventure', description: 'High-altitude trek through meadows and glaciers' },
    { id: 'beas-kund-trek', name: 'Beas Kund Trek', time: '5-6 hours', icon: 'trail-sign', category: 'Adventure', description: 'Sacred lake trek with hot springs and camping' },
    { id: 'great-himalayan-national-park', name: 'Great Himalayan National Park Trek', time: '2-3 days', icon: 'leaf-outline', category: 'Nature', description: 'UNESCO site with wildlife and alpine meadows' },

    // Cultural & Religious
    { id: 'hadimba-temple-visit', name: 'Hadimba Temple & Vashisht Village', time: '2 hours', icon: 'location', category: 'Religious', description: 'Ancient wooden temple with natural hot springs' },
    { id: 'manali-gompa-visit', name: 'Tibetan Monasteries Tour', time: '2-3 hours', icon: 'location', category: 'Religious', description: 'Buddhist monasteries with prayer wheels and thangkas' },

    // Village & Rural Experiences
    { id: 'village-safari-manali', name: 'Manali Village Cultural Safari', time: '3-4 hours', icon: 'home-outline', category: 'Culture', description: 'Traditional Himachali village life and handicrafts' },
    { id: 'apple-orchard-visit', name: 'Apple Orchard Experience', time: '2 hours', icon: 'leaf-outline', category: 'Nature', description: 'Organic farm tour with apple picking and local food' },

    // Wellness & Relaxation
    { id: 'hot-springs-vashisht', name: 'Vashisht Hot Springs & Temple', time: '2 hours', icon: 'water-outline', category: 'Wellness', description: 'Natural sulfur springs with therapeutic properties' },
    { id: 'ayurvedic-massage', name: 'Traditional Ayurvedic Massage', time: '1-2 hours', icon: 'fitness-outline', category: 'Wellness', description: 'Himachali herbal treatments and therapies' },

    // Food & Shopping
    { id: 'himachali-cooking-class', name: 'Himachali Traditional Cooking', time: '3 hours', icon: 'restaurant-outline', category: 'Food', description: 'Learn to cook siddu, patande, and local delicacies' },
    { id: 'local-markets-shopping', name: 'Mall Road & Local Markets', time: '2-3 hours', icon: 'cart-outline', category: 'Shopping', description: 'Handicrafts, woolens, and Tibetan souvenirs' },
  ],
  Kerala: [
    // Backwater Experiences
    { id: 'houseboat-alleppey', name: 'Alleppey Houseboat Cruise', time: 'Full day', icon: 'boat-outline', category: 'Culture', description: 'Traditional kettuvallam with meals and village visits' },
    { id: 'backwater-kayaking', name: 'Backwater Kayaking Adventure', time: '3-4 hours', icon: 'boat-outline', category: 'Adventure', description: 'Eco-friendly kayaking through narrow canals' },
    { id: 'village-walk-alleppey', name: 'Alleppey Village Walking Tour', time: '2-3 hours', icon: 'walk-outline', category: 'Culture', description: 'Rice fields, coir villages, and local interactions' },

    // Wildlife & Nature
    { id: 'periyar-wildlife-sanctuary', name: 'Periyar Tiger Reserve Safari', time: '3-4 hours', icon: 'paw-outline', category: 'Wildlife', description: 'Boat safari in national park with spice plantations' },
    { id: 'munnar-tea-plantations', name: 'Munnar Tea Plantation Tour', time: '3 hours', icon: 'leaf-outline', category: 'Nature', description: 'Organic tea estates, factory visit, and trekking' },
    { id: 'silent-valley-national-park', name: 'Silent Valley Rainforest Trek', time: 'Full day', icon: 'trail-sign', category: 'Nature', description: 'UNESCO biosphere reserve with biodiversity' },

    // Cultural Experiences
    { id: 'kathakali-dance-performance', name: 'Kathakali Dance Performance', time: '2 hours', icon: 'musical-notes-outline', category: 'Culture', description: 'Traditional Kerala dance-drama with storytelling' },
    { id: 'kalaripayattu-martial-arts', name: 'Kalaripayattu Martial Arts Demo', time: '1-2 hours', icon: 'fitness-outline', category: 'Culture', description: 'Ancient Kerala martial arts training session' },
    { id: 'ayurvedic-massage-treatment', name: 'Traditional Ayurvedic Treatment', time: '1-2 hours', icon: 'fitness-outline', category: 'Wellness', description: 'Panchakarma therapy with Kerala oils' },

    // Temples & Religious Sites
    { id: 'sabarimala-pilgrimage', name: 'Sabarimala Temple Pilgrimage', time: 'Full day', icon: 'location', category: 'Religious', description: 'Sacred temple with traditional rituals (seasonal)' },
    { id: 'guruvayur-temple-visit', name: 'Guruvayur Temple & Elephant Camp', time: '3 hours', icon: 'location', category: 'Religious', description: 'Famous Krishna temple with elephant sanctuary' },

    // Food & Spice Experiences
    { id: 'spice-plantation-tour', name: 'Kerala Spice Plantation Visit', time: '2-3 hours', icon: 'leaf-outline', category: 'Nature', description: 'Cardamom, pepper, and vanilla farms with lunch' },
    { id: 'kerala-cooking-class', name: 'Traditional Kerala Cooking Class', time: '3-4 hours', icon: 'restaurant-outline', category: 'Food', description: 'Learn appam, aviyal, and seafood curries' },
    { id: 'toddy-tapping-experience', name: 'Toddy Tapping & Tasting', time: '2 hours', icon: 'wine-outline', category: 'Culture', description: 'Coconut palm wine production and tasting' },

    // Beach & Coastal Activities
    { id: 'marari-beach-relaxation', name: 'Marari Beach Ayurveda Resort', time: 'Full day', icon: 'sunny', category: 'Wellness', description: 'Beachfront resort with traditional treatments' },
    { id: 'vypeen-chinese-nets', name: 'Chinese Fishing Nets Experience', time: '2 hours', icon: 'boat-outline', category: 'Culture', description: 'Traditional fishing method demonstration' },
  ],
  Varanasi: [
    // Spiritual & Religious
    { id: 'ganges-aarti-dashashwamedh', name: 'Ganges Aarti at Dashashwamedh Ghat', time: '1-2 hours', icon: 'flame-outline', category: 'Religious', description: 'Evening prayer ceremony with bells and lamps' },
    { id: 'boat-ride-ganges-sunrise', name: 'Sunrise Boat Ride on Ganges', time: '1-2 hours', icon: 'boat-outline', category: 'Spiritual', description: 'Sacred river cruise watching morning rituals' },
    { id: 'sarnath-buddhist-circuit', name: 'Sarnath Buddhist Circuit Tour', time: '3-4 hours', icon: 'location', category: 'Religious', description: 'Buddhist pilgrimage sites with ancient stupas' },

    // Cultural Experiences
    { id: 'ghats-walking-tour', name: 'Ghats Walking Tour', time: '2-3 hours', icon: 'walk-outline', category: 'Culture', description: 'Explore 88 ghats with cremation and bathing rituals' },
    { id: 'sitar-sitar-playing-lesson', name: 'Sitar Playing Lesson', time: '1-2 hours', icon: 'musical-notes-outline', category: 'Culture', description: 'Learn classical Indian music with master musician' },
    { id: 'yoga-meditation-ghat', name: 'Yoga & Meditation by Ganges', time: '1-2 hours', icon: 'body-outline', category: 'Wellness', description: 'Morning session with spiritual guidance' },

    // Historical & Architectural
    { id: 'banaras-hindu-university', name: 'BHU Campus & Temples Tour', time: '2 hours', icon: 'business-outline', category: 'Education', description: 'Asia\'s largest residential university' },
    { id: 'ramnagar-fort-palace', name: 'Ramnagar Fort & Durbar Hall', time: '2-3 hours', icon: 'business', category: 'Historical', description: 'Maharaja\'s palace with museum and artifacts' },

    // Handicraft & Shopping
    { id: 'silk-weaving-workshop', name: 'Banarasi Silk Weaving Workshop', time: '2-3 hours', icon: 'business-outline', category: 'Craft', description: 'Learn traditional brocade weaving techniques' },
    { id: 'copper-engraving-demonstration', name: 'Copper Engraving & Metal Work', time: '2 hours', icon: 'color-palette-outline', category: 'Craft', description: 'Traditional utensil making and decoration' },

    // Food & Local Experiences
    { id: 'banarasi-paan-making', name: 'Banarasi Paan Making Workshop', time: '1 hour', icon: 'restaurant-outline', category: 'Food', description: 'Learn to make traditional betel leaf preparations' },
    { id: 'local-market-exploration', name: 'Old City Market Exploration', time: '2-3 hours', icon: 'cart-outline', category: 'Culture', description: 'Narrow lanes with spices, sweets, and handicrafts' },
    { id: 'home-cooking-experience', name: 'Traditional Home Cooking Experience', time: '3 hours', icon: 'restaurant-outline', category: 'Food', description: 'Cook and eat traditional Banarasi meals' },
  ],
  Tokyo: [
    // Iconic Districts & Landmarks
    { id: 'shibuya-crossing-tour', name: 'Shibuya Crossing & Scramble Experience', time: '2 hours', icon: 'walk-outline', category: 'Culture', description: 'World\'s busiest pedestrian crossing with shopping' },
    { id: 'tokyo-skytree-visit', name: 'Tokyo Skytree Observation Deck', time: '1-2 hours', icon: 'business-outline', category: 'Landmark', description: 'Panoramic views from world\'s tallest structure' },
    { id: 'sensoji-temple-asakusa', name: 'Senso-ji Temple & Nakamise Shopping', time: '2-3 hours', icon: 'location', category: 'Religious', description: 'Tokyo\'s oldest temple with traditional shopping street' },
    { id: 'meiji-shrine-visit', name: 'Meiji Shrine & Yoyogi Park', time: '2 hours', icon: 'location', category: 'Religious', description: 'Peaceful shrine in lush forest setting' },

    // Modern Tokyo
    { id: 'ginza-shopping-district', name: 'Ginza Luxury Shopping District', time: '3-4 hours', icon: 'cart-outline', category: 'Shopping', description: 'High-end brands and flagship stores' },
    { id: 'odaiba-bay-area', name: 'Odaiba Bay Area Exploration', time: '3 hours', icon: 'business-outline', category: 'Modern', description: 'Futuristic district with teamLab exhibits and shopping' },
    { id: 'akihabara-electronics', name: 'Akihabara Electronics & Anime District', time: '2-3 hours', icon: 'hardware-chip-outline', category: 'Culture', description: 'Tech gadgets, anime shops, and maid cafes' },

    // Cultural Experiences
    { id: 'traditional-tea-ceremony', name: 'Traditional Japanese Tea Ceremony', time: '1-2 hours', icon: 'restaurant-outline', category: 'Culture', description: 'Chanoyu with matcha and seasonal sweets' },
    { id: 'sumo-wrestling-match', name: 'Sumo Wrestling Match Viewing', time: '2-3 hours', icon: 'fitness-outline', category: 'Sports', description: 'Professional tournament at Ryogoku Kokugikan' },
    { id: 'kabuki-theater-performance', name: 'Kabuki Theater Performance', time: '2 hours', icon: 'musical-notes-outline', category: 'Culture', description: 'Traditional Japanese drama with elaborate costumes' },

    // Food & Markets
    { id: 'tsukiji-outer-market', name: 'Tsukiji Outer Market Food Tour', time: '2-3 hours', icon: 'restaurant-outline', category: 'Food', description: 'Fresh seafood, sushi, and street food stalls' },
    { id: 'depachika-food-hall', name: 'Depachika Department Store Food Hall', time: '1-2 hours', icon: 'restaurant-outline', category: 'Food', description: 'Luxury bento boxes and gourmet takeout' },
    { id: 'izakaya-pub-hopping', name: 'Izakaya Pub Hopping Experience', time: '3-4 hours', icon: 'wine-outline', category: 'Food', description: 'Traditional Japanese pubs with small plates' },

    // Nature & Relaxation
    { id: 'shinjuku-gyoen-garden', name: 'Shinjuku Gyoen National Garden', time: '2 hours', icon: 'leaf-outline', category: 'Nature', description: 'Traditional and western-style gardens in city center' },
    { id: 'onsen-hot-spring-experience', name: 'Traditional Onsen Hot Spring', time: '2 hours', icon: 'water-outline', category: 'Wellness', description: 'Public bathhouse with mineral hot springs' },
    { id: 'meditation-temple-session', name: 'Temple Meditation Session', time: '1 hour', icon: 'body-outline', category: 'Wellness', description: 'Zen meditation in peaceful temple setting' },
  ],
};

export const getDestinationActivities = (destination) => {
  const normalizedDest = destination || '';
  
  // Find matching destination
  const matchingKey = Object.keys(destinationActivities).find(key => 
    key.toLowerCase() === normalizedDest.toLowerCase()
  );
  
  return matchingKey ? destinationActivities[matchingKey] : [];
};