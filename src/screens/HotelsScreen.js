import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const HotelsScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  const hotels = [
    {
      id: 1,
      name: 'Luxury Palace Resort',
      location: 'Jaipur, Rajasthan',
      rating: 4.8,
      reviews: 2456,
      price: 15000,
      image: 'business',
      amenities: ['Pool', 'Spa', 'WiFi', 'Restaurant'],
      type: 'luxury',
    },
    {
      id: 2,
      name: 'Beach Paradise Hotel',
      location: 'Goa',
      rating: 4.5,
      reviews: 1823,
      price: 8000,
      image: 'sunny',
      amenities: ['Beach Access', 'Bar', 'WiFi', 'Parking'],
      type: 'beach',
    },
    {
      id: 3,
      name: 'Mountain View Lodge',
      location: 'Manali, Himachal Pradesh',
      rating: 4.6,
      reviews: 1245,
      price: 6000,
      image: 'trail-sign',
      amenities: ['Mountain View', 'Fireplace', 'WiFi', 'Trekking'],
      type: 'mountain',
    },
    {
      id: 4,
      name: 'City Center Business Hotel',
      location: 'Mumbai, Maharashtra',
      rating: 4.3,
      reviews: 3421,
      price: 12000,
      image: 'business-outline',
      amenities: ['Business Center', 'WiFi', 'Gym', 'Restaurant'],
      type: 'business',
    },
    {
      id: 5,
      name: 'Backwater Resort',
      location: 'Kerala',
      rating: 4.7,
      reviews: 987,
      price: 10000,
      image: 'leaf-outline',
      amenities: ['Houseboat', 'Ayurveda', 'WiFi', 'Pool'],
      type: 'resort',
    },
  ];

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'luxury', label: 'Luxury' },
    { id: 'beach', label: 'Beach' },
    { id: 'mountain', label: 'Mountain' },
    { id: 'business', label: 'Business' },
  ];

  const getFilteredHotels = () => {
    let filtered = hotels;
    if (selectedFilter !== 'all') {
      filtered = hotels.filter((hotel) => hotel.type === selectedFilter);
    }
    if (searchQuery) {
      filtered = filtered.filter(
        (hotel) =>
          hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          hotel.location.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  };

  const renderHotel = ({ item }) => (
    <TouchableOpacity style={styles.hotelCard} activeOpacity={0.8}>
      <View style={styles.hotelHeader}>
        <Ionicons name={item.image} size={56} color={Colors.secondary} style={styles.hotelImage} />
        <View style={styles.hotelBadge}>
          <View style={styles.ratingBadgeRow}>
            <Ionicons name="star" size={12} color={Colors.secondary} />
            <Text style={styles.badgeText}>{item.rating}</Text>
          </View>
        </View>
      </View>

      <View style={styles.hotelContent}>
        <Text style={styles.hotelName}>{item.name}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={Colors.textLight} />
          <Text style={styles.hotelLocation}>{item.location}</Text>
        </View>
        <Text style={styles.hotelReviews}>{item.reviews} reviews</Text>

        <View style={styles.amenitiesContainer}>
          {item.amenities.slice(0, 3).map((amenity, index) => (
            <View key={index} style={styles.amenityBadge}>
              <Text style={styles.amenityText}>{amenity}</Text>
            </View>
          ))}
        </View>

        <View style={styles.hotelFooter}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Starting from</Text>
            <Text style={styles.price}>₹{item.price.toLocaleString()}</Text>
            <Text style={styles.perNight}>per night</Text>
          </View>
          <TouchableOpacity style={styles.bookButton}>
            <Text style={styles.bookButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hotels</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search hotels or locations..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FlatList
          data={filters}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          renderItem={({ item: filterItem }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedFilter === filterItem.id && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFilter(filterItem.id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFilter === filterItem.id && styles.filterChipTextActive,
                ]}
              >
                {filterItem.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Hotels List */}
      <FlatList
        data={getFilteredHotels()}
        renderItem={renderHotel}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  searchContainer: {
    padding: 15,
  },
  searchInput: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filtersContainer: {
    paddingHorizontal: 15,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.card,
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    color: Colors.text,
  },
  filterChipTextActive: {
    color: Colors.secondary,
    fontWeight: '600',
  },
  listContainer: {
    padding: 15,
  },
  hotelCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    marginBottom: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    overflow: 'hidden',
  },
  hotelHeader: {
    backgroundColor: Colors.primaryLight,
    padding: 25,
    alignItems: 'center',
    position: 'relative',
  },
  hotelImage: {
    fontSize: 60,
  },
  hotelBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    color: Colors.secondary,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  ratingBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hotelContent: {
    padding: 20,
  },
  hotelName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 5,
  },
  hotelLocation: {
    fontSize: 14,
    color: Colors.textLight,
    marginLeft: 4,
    marginBottom: 5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  hotelReviews: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 15,
  },
  amenitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  amenityBadge: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  amenityText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  hotelFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 15,
  },
  priceContainer: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  perNight: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  bookButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  bookButtonText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default HotelsScreen;
