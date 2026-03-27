import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

const CartScreen = ({ route, navigation }) => {
  const canGoBack = navigation.canGoBack();
  const [cartItems, setCartItems] = useState([
    {
      id: 1,
      title: 'Jaipur Explorer - 3 Days',
      destination: 'Jaipur',
      duration: '3 Days / 2 Nights',
      price: 15000,
      people: 2,
      image: 'business',
    },
  ]);

  const getTotalPrice = () => {
    return cartItems.reduce((total, item) => total + item.price * item.people, 0);
  };

  const handleRemoveItem = (itemId) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item from cart?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setCartItems(cartItems.filter((item) => item.id !== itemId));
          },
        },
      ]
    );
  };

  const handleContactAgent = () => {
    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }
    navigation.navigate('TalkToAgent', { cartItems });
  };

  const handleMakePayment = () => {
    if (cartItems.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }
    navigation.navigate('Checkout', { cartItems, total: getTotalPrice() });
  };

  const renderCartItem = (item) => (
    <View key={item.id} style={styles.cartItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemImage}>{item.image}</Text>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{item.title}</Text>
          <Text style={styles.itemDestination}>{item.destination}</Text>
          <Text style={styles.itemDuration}>{item.duration}</Text>
        </View>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveItem(item.id)}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} style={styles.removeIcon} />
        </TouchableOpacity>
      </View>

      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price per person:</Text>
          <Text style={styles.detailValue}>
            ₹{item.price.toLocaleString()}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Number of people:</Text>
          <Text style={styles.detailValue}>{item.people}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Subtotal:</Text>
          <Text style={styles.detailValueTotal}>
            ₹{(item.price * item.people).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 30 }} />
        )}
        <Text style={styles.headerTitle}>My Cart</Text>
        <View style={styles.cartCount}>
          <Text style={styles.cartCountText}>{cartItems.length}</Text>
        </View>
      </View>

      {cartItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={72} color={Colors.primary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse our itineraries and add your favorites!
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.navigate('CustomerTabs', { screen: 'HomeTab' })}
          >
            <Text style={styles.browseButtonText}>Browse Itineraries</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.cartList}
            showsVerticalScrollIndicator={false}
          >
            {cartItems.map(renderCartItem)}

            {/* Price Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Price Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>
                    ₹{getTotalPrice().toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Taxes & Fees</Text>
                  <Text style={styles.summaryValue}>
                    ₹{Math.round(getTotalPrice() * 0.18).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>
                    ₹{Math.round(getTotalPrice() * 1.18).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Promo Code */}
            <View style={styles.promoSection}>
              <Text style={styles.promoTitle}>Have a promo code?</Text>
              <TouchableOpacity style={styles.promoButton}>
                <Text style={styles.promoButtonText}>Apply Code</Text>
              </TouchableOpacity>
            </View>

            {/* Bottom Spacing */}
            <View style={{ height: 200 }} />
          </ScrollView>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.contactButton}
              onPress={handleContactAgent}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.secondary} style={styles.contactIcon} />
              <Text style={styles.contactButtonText}>Contact Agent</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.paymentButton}
              onPress={handleMakePayment}
            >
              <Ionicons name="card-outline" size={20} color={Colors.secondary} style={styles.paymentIcon} />
              <Text style={styles.paymentButtonText}>Make Payment</Text>
            </TouchableOpacity>
          </View>
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
    padding: 15,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.secondary,
  },
  cartCount: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartCountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.textLight,
    textAlign: 'center',
    marginBottom: 30,
  },
  browseButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  browseButtonText: {
    color: Colors.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  cartList: {
    flex: 1,
  },
  cartItem: {
    backgroundColor: Colors.card,
    margin: 15,
    marginBottom: 0,
    borderRadius: 16,
    padding: 15,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  itemImage: {
    fontSize: 50,
    marginRight: 15,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  itemDestination: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 2,
  },
  itemDuration: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  removeButton: {
    padding: 5,
  },
  removeIcon: {
    fontSize: 24,
  },
  itemDetails: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 15,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: Colors.textLight,
  },
  detailValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  detailValueTotal: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  summarySection: {
    padding: 15,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 15,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.textLight,
  },
  summaryValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  promoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: Colors.card,
    margin: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  promoTitle: {
    fontSize: 16,
    color: Colors.text,
  },
  promoButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  promoButtonText: {
    color: Colors.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    flexDirection: 'row',
    padding: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  contactButton: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  contactIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  contactButtonText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  paymentButton: {
    flex: 1.5,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  paymentIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  paymentButtonText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: 'bold',
  },
});

export default CartScreen;
