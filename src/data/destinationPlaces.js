import React from 'react';

// Destination-specific places for customization
export const destinationPlaces = {
  Paris: [
    { id: 1, name: 'Eiffel Tower', icon: 'business-outline', category: 'Landmark' },
    { id: 2, name: 'Louvre Museum', icon: 'library-outline', category: 'Museum' },
    { id: 3, name: 'Seine River Cruise', icon: 'boat-outline', category: 'Activity' },
    { id: 4, name: 'Montmartre', icon: 'trail-sign-outline', category: 'Neighborhood' },
    { id: 5, name: 'Palace of Versailles', icon: 'business', category: 'Palace' },
    { id: 6, name: 'Champs-Élysées', icon: 'walk-outline', category: 'Street' },
    { id: 7, name: 'Notre-Dame Cathedral', icon: 'location', category: 'Religious' },
    { id: 8, name: 'Arc de Triomphe', icon: 'flag-outline', category: 'Landmark' },
  ],
  Tokyo: [
    { id: 1, name: 'Shibuya Crossing', icon: 'walk-outline', category: 'Landmark' },
    { id: 2, name: 'Senso-ji Temple', icon: 'location', category: 'Religious' },
    { id: 3, name: 'Tokyo Skytree', icon: 'business-outline', category: 'Landmark' },
    { id: 4, name: 'Meiji Shrine', icon: 'flower-outline', category: 'Religious' },
    { id: 5, name: 'Tsukiji Fish Market', icon: 'restaurant-outline', category: 'Market' },
    { id: 6, name: 'Akihabara', icon: 'hardware-chip-outline', category: 'District' },
    { id: 7, name: 'Imperial Palace', icon: 'business', category: 'Palace' },
    { id: 8, name: 'Mount Fuji Day Trip', icon: 'trail-sign', category: 'Nature' },
  ],
  Dubai: [
    { id: 1, name: 'Burj Khalifa', icon: 'business-outline', category: 'Landmark' },
    { id: 2, name: 'Palm Jumeirah', icon: 'sunny', category: 'Island' },
    { id: 3, name: 'Dubai Mall', icon: 'cart-outline', category: 'Shopping' },
    { id: 4, name: 'Desert Safari', icon: 'trail-sign', category: 'Adventure' },
    { id: 5, name: 'Dubai Fountain', icon: 'water-outline', category: 'Entertainment' },
    { id: 6, name: 'Burj Al Arab', icon: 'star-outline', category: 'Hotel' },
    { id: 7, name: 'Gold Souk', icon: 'cart-outline', category: 'Market' },
    { id: 8, name: 'Dubai Marina', icon: 'boat-outline', category: 'District' },
  ],
  Bali: [
    { id: 1, name: 'Ubud Rice Terraces', icon: 'leaf-outline', category: 'Nature' },
    { id: 2, name: 'Tanah Lot Temple', icon: 'location', category: 'Religious' },
    { id: 3, name: 'Uluwatu Temple', icon: 'business', category: 'Religious' },
    { id: 4, name: 'Mount Batur Trek', icon: 'trail-sign', category: 'Adventure' },
    { id: 5, name: 'Nusa Dua Beach', icon: 'sunny', category: 'Beach' },
    { id: 6, name: 'Sacred Monkey Forest', icon: 'paw-outline', category: 'Nature' },
    { id: 7, name: 'Water Sports', icon: 'water-outline', category: 'Activity' },
    { id: 8, name: 'Traditional Dance Show', icon: 'musical-notes-outline', category: 'Culture' },
  ],
  Maldives: [
    { id: 1, name: 'Overwater Villa Stay', icon: 'home-outline', category: 'Accommodation' },
    { id: 2, name: 'Snorkeling', icon: 'water-outline', category: 'Activity' },
    { id: 3, name: 'Sunset Cruise', icon: 'boat-outline', category: 'Activity' },
    { id: 4, name: 'Island Hopping', icon: 'boat-outline', category: 'Activity' },
    { id: 5, name: 'Dolphin Watching', icon: 'eye-outline', category: 'Activity' },
    { id: 6, name: 'Underwater Photography', icon: 'camera-outline', category: 'Activity' },
    { id: 7, name: 'Couples Spa', icon: 'fitness-outline', category: 'Wellness' },
    { id: 8, name: 'Private Beach Dinner', icon: 'restaurant-outline', category: 'Dining' },
  ],
  Jaipur: [
    { id: 1, name: 'Amber Fort', icon: 'business', category: 'Fort' },
    { id: 2, name: 'City Palace', icon: 'location', category: 'Palace' },
    { id: 3, name: 'Hawa Mahal', icon: 'business-outline', category: 'Palace' },
    { id: 4, name: 'Jantar Mantar', icon: 'library-outline', category: 'Observatory' },
    { id: 5, name: 'Pink City Markets', icon: 'cart-outline', category: 'Market' },
    { id: 6, name: 'Jaigarh Fort', icon: 'business', category: 'Fort' },
    { id: 7, name: 'Albert Hall Museum', icon: 'library-outline', category: 'Museum' },
    { id: 8, name: 'Elephant Ride', icon: 'paw-outline', category: 'Activity' },
  ],
  Goa: [
    { id: 1, name: 'Calangute Beach', icon: 'sunny', category: 'Beach' },
    { id: 2, name: 'Anjuna Beach', icon: 'sunny', category: 'Beach' },
    { id: 3, name: 'Fort Aguada', icon: 'business-outline', category: 'Fort' },
    { id: 4, name: 'Dudhsagar Falls', icon: 'water-outline', category: 'Waterfall' },
    { id: 5, name: 'Water Sports', icon: 'bicycle-outline', category: 'Activity' },
    { id: 6, name: 'Goan Village Tour', icon: 'home-outline', category: 'Culture' },
    { id: 7, name: 'Seafood Feast', icon: 'restaurant-outline', category: 'Dining' },
    { id: 8, name: 'Nightlife', icon: 'moon-outline', category: 'Entertainment' },
  ],
  Kerala: [
    { id: 1, name: 'Munnar Tea Plantations', icon: 'leaf-outline', category: 'Nature' },
    { id: 2, name: 'Periyar Wildlife Sanctuary', icon: 'paw-outline', category: 'Wildlife' },
    { id: 3, name: 'Houseboat Cruise', icon: 'boat-outline', category: 'Activity' },
    { id: 4, name: 'Kathakali Dance', icon: 'musical-notes-outline', category: 'Culture' },
    { id: 5, name: 'Ayurvedic Spa', icon: 'fitness-outline', category: 'Wellness' },
    { id: 6, name: 'Spice Plantations', icon: 'leaf-outline', category: 'Nature' },
    { id: 7, name: 'Backwater Villages', icon: 'home-outline', category: 'Culture' },
    { id: 8, name: 'Coconut Lagoon', icon: 'sunny', category: 'Beach' },
  ],
  Manali: [
    { id: 1, name: 'Rohtang Pass', icon: 'trail-sign', category: 'Mountain' },
    { id: 2, name: 'Solang Valley', icon: 'snow-outline', category: 'Valley' },
    { id: 3, name: 'Hadimba Temple', icon: 'location', category: 'Religious' },
    { id: 4, name: 'River Rafting', icon: 'water-outline', category: 'Activity' },
    { id: 5, name: 'Paragliding', icon: 'airplane-outline', category: 'Activity' },
    { id: 6, name: 'Hot Springs', icon: 'water-outline', category: 'Wellness' },
    { id: 7, name: 'Vashisht Village', icon: 'home-outline', category: 'Culture' },
    { id: 8, name: 'Trekking', icon: 'trail-sign', category: 'Adventure' },
  ],
  Varanasi: [
    { id: 1, name: 'Ganges Aarti', icon: 'flame-outline', category: 'Religious' },
    { id: 2, name: 'Boat Ride on Ganges', icon: 'boat-outline', category: 'Activity' },
    { id: 3, name: 'Sarnath', icon: 'location', category: 'Religious' },
    { id: 4, name: 'Ghats Exploration', icon: 'walk-outline', category: 'Culture' },
    { id: 5, name: 'Temples Tour', icon: 'business', category: 'Religious' },
    { id: 6, name: 'Silk Weaving', icon: 'business-outline', category: 'Craft' },
    { id: 7, name: 'Meditation Session', icon: 'body-outline', category: 'Wellness' },
    { id: 8, name: 'Local Markets', icon: 'cart-outline', category: 'Market' },
  ],
};

export const getDestinationPlaces = (destination) => {
  const normalizedDest = destination || '';
  
  // Find matching destination
  const matchingKey = Object.keys(destinationPlaces).find(key => 
    key.toLowerCase() === normalizedDest.toLowerCase()
  );
  
  return matchingKey ? destinationPlaces[matchingKey] : [];
};