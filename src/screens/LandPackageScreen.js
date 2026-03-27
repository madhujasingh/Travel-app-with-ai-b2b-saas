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

const LandPackageScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  const categories = [
    {
      id: 'international',
      title: 'International',
      icon: 'earth-outline',
      color: '#2196F3',
    },
    {
      id: 'india',
      title: 'India',
      icon: 'location-outline',
      color: '#FF9800',
    },
  ];

  const internationalDestinations = [
    { id: 1, name: 'Paris', country: 'France', image: 'business-outline', popular: true },
    { id: 2, name: 'Tokyo', country: 'Japan', image: 'navigate-outline', popular: true },
    { id: 3, name: 'Dubai', country: 'UAE', image: 'business', popular: true },
    { id: 4, name: 'Bali', country: 'Indonesia', image: 'sunny', popular: true },
    { id: 5, name: 'Maldives', country: 'Maldives', image: 'water-outline', popular: true },
    { id: 6, name: 'Singapore', country: 'Singapore', image: 'leaf-outline', popular: false },
    { id: 7, name: 'Thailand', country: 'Thailand', image: 'flower-outline', popular: false },
    { id: 8, name: 'Switzerland', country: 'Switzerland', image: 'trail-sign', popular: false },
  ];

  const indianDestinations = [
    { id: 1, name: 'Jaipur', state: 'Rajasthan', image: 'business', popular: true },
    { id: 2, name: 'Goa', state: 'Goa', image: 'sunny', popular: true },
    { id: 3, name: 'Kerala', state: 'Kerala', image: 'leaf', popular: true },
    { id: 4, name: 'Manali', state: 'Himachal Pradesh', image: 'trail-sign', popular: true },
    { id: 5, name: 'Varanasi', state: 'Uttar Pradesh', image: 'flower', popular: true },
    { id: 6, name: 'Udaipur', state: 'Rajasthan', image: 'business-outline', popular: false },
    { id: 7, name: 'Shimla', state: 'Himachal Pradesh', image: 'trail-sign-outline', popular: false },
    { id: 8, name: 'Agra', state: 'Uttar Pradesh', image: 'location', popular: false },
  ];

  const getDestinations = () => {
    if (!selectedCategory) return [];
    const destinations =
      selectedCategory === 'international'
        ? internationalDestinations
        : indianDestinations;

    if (!searchQuery) return destinations;

    return destinations.filter(
      (dest) =>
        dest.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dest.country &&
          dest.country.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dest.state &&
          dest.state.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const handleDestinationPress = (destination) => {
    navigation.navigate('ItineraryList', {
      destination: destination.name,
      type: selectedCategory,
      budget: '',
      people: '',
    });
  };

  const renderDestination = ({ item }) => (
    <TouchableOpacity
      style={styles.destinationCard}
      onPress={() => handleDestinationPress(item)}
      activeOpacity={0.8}
    >
      <Ionicons name={item.image} size={34} color={Colors.primary} style={styles.destinationImage} />
      <View style={styles.destinationInfo}>
        <Text style={styles.destinationName}>{item.name}</Text>
        <Text style={styles.destinationLocation}>
          {item.country || item.state}
        </Text>
        {item.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Popular</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.primary} />
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
        <Text style={styles.headerTitle}>Land Packages</Text>
        <View style={{ width: 30 }} />
      </View>

      {/* Category Selection */}
      {!selectedCategory ? (
        <View style={styles.categoryContainer}>
          <Text style={styles.categoryTitle}>Choose Your Destination Type</Text>
          <View style={styles.categoryCards}>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryCard,
                  { backgroundColor: category.color },
                ]}
                onPress={() => setSelectedCategory(category.id)}
                activeOpacity={0.8}
              >
                <Ionicons name={category.icon} size={46} color={Colors.secondary} style={styles.categoryIcon} />
                <Text style={styles.categoryName}>{category.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search cities or countries..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity
              style={styles.changeCategory}
              onPress={() => {
                setSelectedCategory(null);
                setSearchQuery('');
              }}
            >
              <Text style={styles.changeCategoryText}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Destinations List */}
          <FlatList
            data={getDestinations()}
            renderItem={renderDestination}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.destinationsList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={50} color={Colors.primary} style={styles.emptyIcon} />
                <Text style={styles.emptyText}>No destinations found</Text>
              </View>
            }
          />
        </>
      )}
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
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  categoryContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  categoryTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 30,
    textAlign: 'center',
  },
  categoryCards: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  categoryCard: {
    width: '40%',
    aspectRatio: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  categoryIcon: { marginBottom: 15 },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeCategory: {
    marginLeft: 10,
    padding: 15,
  },
  changeCategoryText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  destinationsList: {
    padding: 15,
  },
  destinationCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  destinationImage: { marginRight: 15 },
  destinationInfo: {
    flex: 1,
  },
  destinationName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  destinationLocation: {
    fontSize: 14,
    color: Colors.textLight,
    marginTop: 2,
  },
  popularBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 5,
    alignSelf: 'flex-start',
  },
  popularText: {
    fontSize: 10,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 15,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textLight,
  },
});

export default LandPackageScreen;
