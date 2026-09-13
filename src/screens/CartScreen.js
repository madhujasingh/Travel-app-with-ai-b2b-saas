import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import useResponsive from '../hooks/useResponsive';
import WebHero from '../components/web/WebHero';
import useHeroHeader from '../hooks/useHeroHeader';
import WebStickyHeader from '../components/web/WebStickyHeader';
import TwoColumn from '../components/web/TwoColumn';
import { appAlert } from '../utils/appAlert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import API_CONFIG from '../config/api';

// Falls back to the platform default (see backend PlatformSettings) if the
// live value can't be fetched, rather than showing ₹0 while loading or on a
// network hiccup.
const DEFAULT_CONVENIENCE_FEE = 300;

const CartScreen = ({ route, navigation }) => {
  const { centeredContent, isDesktop } = useResponsive();
  const { scrolled, scrollProps } = useHeroHeader();
  const canGoBack = navigation.canGoBack();
  const { cartItems, addItemToCart, removeItemFromCart, getCartTotal, getCartItemCount } = useCart();
  const { token } = useAuth();
  const [convenienceFee, setConvenienceFee] = React.useState(DEFAULT_CONVENIENCE_FEE);

  // Coupon. The server decides what the code is worth - this screen only sends
  // the code and the order total, and displays whatever discount comes back.
  const [couponCode, setCouponCode] = React.useState('');
  const [appliedCoupon, setAppliedCoupon] = React.useState(null);
  const [couponChecking, setCouponChecking] = React.useState(false);
  const [couponError, setCouponError] = React.useState('');

  React.useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/platform-settings`);
        const data = await response.json();
        if (response.ok && typeof data?.flightConvenienceFee === 'number') {
          setConvenienceFee(data.flightConvenienceFee);
        }
      } catch (error) {
        // ignored - keep the default fee
      }
    })();
  }, []);

  // Add item from route params if present (either addItem or customization)
  React.useEffect(() => {
    if (route.params?.addItem) {
      const newItem = route.params.addItem;
      addItemToCart(newItem);
    } else if (route.params?.customization) {
      // Handle customization object from CustomizationScreen
      const { itinerary, destination, people, customizedDays, additionalNotes } = route.params.customization;

      // Create a cart item from the customization
      const cartItem = {
        id: itinerary.id || `customized-${Date.now()}`,
        title: `${itinerary.title} (Customized)`,
        destination: destination,
        duration: itinerary.duration,
        price: itinerary.price,
        people: people || 1,
        adults: people || 0, // Default to all adults if not specified
        children: 0,
        image: itinerary.image,
        addedAt: new Date().toISOString(),
        customization: {
          customizedDays,
          additionalNotes,
          originalItinerary: itinerary
        },
        isCustomized: true
      };

      addItemToCart(cartItem);
    }
  }, [route.params, addItemToCart]);

  const handleRemoveItem = (itemId) => {
    appAlert(
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
            removeItemFromCart(itemId);
          },
        },
      ]
    );
  };

  const handleContactAgent = () => {
    if (getCartItemCount() === 0) {
      appAlert('Error', 'Your cart is empty');
      return;
    }
    navigation.navigate('TalkToAgent', { cartItems });
  };

  const handleMakePayment = () => {
    if (getCartItemCount() === 0) {
      appAlert('Error', 'Your cart is empty');
      return;
    }
    navigation.navigate('Checkout', { cartItems, total: getCartTotal() });
  };

  const renderCartItem = (item) => (
    <View key={item.id} style={styles.cartItem}>
      <View style={styles.itemHeader}>
        {item.iconName ? (
          <Ionicons name={item.iconName} size={22} color={Colors.primary} style={styles.itemIcon} />
        ) : (
          <Text style={styles.itemImage}>{item.image}</Text>
        )}
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
            ₹{Math.round(item.lineTotal || item.price * item.people).toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );


  // Coupons and margin are per product type, so the cart has to say what it
  // holds. Items added before this tag existed are itinerary packages.
  //
  // A mixed cart has no single right answer - the discount and the available
  // margin both differ per product - so the highest-value line decides, and
  // that is the one a coupon is most likely meant for.
  const cartProductType = (() => {
    if (!cartItems.length) return 'PACKAGE';
    const byType = {};
    cartItems.forEach((item) => {
      const type = item.productType || 'PACKAGE';
      byType[type] = (byType[type] || 0) + (item.lineTotal || item.price * item.people || 0);
    });
    return Object.entries(byType).sort((a, b) => b[1] - a[1])[0][0];
  })();

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponError('Enter a coupon code.');
      return;
    }

    try {
      setCouponChecking(true);
      setCouponError('');
      const response = await fetch(`${API_CONFIG.BASE_URL}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          code,
          orderAmount: getCartTotal() + convenienceFee,
          productType: cartProductType,
        }),
      });

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!response.ok || !data) {
        setCouponError(data?.message || 'Unable to check that code right now.');
        return;
      }
      if (!data.valid) {
        setCouponError(data.message || "This coupon code isn't valid.");
        return;
      }

      setAppliedCoupon(data);
      setCouponCode('');
    } catch (error) {
      setCouponError('Unable to check that code right now.');
    } finally {
      setCouponChecking(false);
    }
  };

  // Display only - the server recomputes the discount when the booking is
  // actually made, so a tampered value here buys nothing.
  const orderTotal = getCartTotal() + convenienceFee;
  const payableTotal = Math.max(orderTotal - (appliedCoupon?.discountAmount || 0), 0);

  React.useEffect(() => {
    // The discount was priced against the previous cart, so it is no longer
    // the number the server would give.
    setAppliedCoupon(null);
  }, [cartItems.length, cartProductType]);

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
  };

  const actionButtons = (
    <>
      <TouchableOpacity style={styles.contactButton} onPress={handleContactAgent}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.secondary} style={styles.contactIcon} />
        <Text style={styles.contactButtonText}>Contact Agent</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.paymentButton} onPress={handleMakePayment}>
        <Ionicons name="card-outline" size={20} color={Colors.secondary} style={styles.paymentIcon} />
        <Text style={styles.paymentButtonText}>Make Payment</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {/* Header */}
      {isDesktop ? (
        <WebHero compact title="My Cart" subtitle="Review your trip before you book." />
      ) : (
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
          <Text style={styles.cartCountText}>{getCartItemCount()}</Text>
        </View>
      </View>
      )}

      {getCartItemCount() === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={72} color={Colors.primary} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse our amazing destinations and add itineraries to your cart!
          </Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.browseButtonText}>Browse Itineraries</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.cartList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={centeredContent}
            {...scrollProps}
          >
            <TwoColumn
            main={<>{cartItems.map(renderCartItem)}</>}
            aside={<>
            {/* Price Summary */}
            <View style={styles.summarySection}>
              <Text style={styles.summaryTitle}>Price Summary</Text>
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Subtotal</Text>
                  <Text style={styles.summaryValue}>
                    ₹{getCartTotal().toLocaleString()}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Convenience Fee</Text>
                  <Text style={styles.summaryValue}>
                    ₹{Math.round(convenienceFee).toLocaleString()}
                  </Text>
                </View>
                {appliedCoupon ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, styles.discountLabel]}>
                      Discount ({appliedCoupon.code})
                    </Text>
                    <Text style={[styles.summaryValue, styles.discountValue]}>
                      -₹{Math.round(appliedCoupon.discountAmount || 0).toLocaleString()}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.divider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.totalLabel}>Total Amount</Text>
                  <Text style={styles.totalValue}>
                    ₹{Math.round(payableTotal).toLocaleString()}
                  </Text>
                </View>
              </View>
            </View>

            {/* Promo Code */}
            <View style={styles.promoSection}>
              <Text style={styles.promoTitle}>Have a promo code?</Text>

              {appliedCoupon ? (
                <View style={styles.couponApplied}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                  <View style={styles.couponAppliedCopy}>
                    <Text style={styles.couponAppliedCode}>{appliedCoupon.code}</Text>
                    {!!appliedCoupon.description && (
                      <Text style={styles.couponAppliedText}>{appliedCoupon.description}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={removeCoupon}>
                    <Text style={styles.couponRemove}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.couponRow}>
                    <TextInput
                      style={styles.couponInput}
                      placeholder="Enter code"
                      placeholderTextColor={Colors.textMuted}
                      value={couponCode}
                      onChangeText={(value) =>
                        setCouponCode(value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
                      }
                      autoCapitalize="characters"
                      maxLength={40}
                    />
                    <TouchableOpacity
                      style={styles.promoButton}
                      onPress={applyCoupon}
                      disabled={couponChecking}
                    >
                      {couponChecking ? (
                        <ActivityIndicator color={Colors.primary} size="small" />
                      ) : (
                        <Text style={styles.promoButtonText}>Apply Code</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {!!couponError && <Text style={styles.couponError}>{couponError}</Text>}
                </>
              )}
            </View>

            {isDesktop && <View style={styles.railActions}>{actionButtons}</View>}
            </>}
            />

            {/* Clears the fixed bottom action bar on phones; the desktop rail
                carries those buttons instead, so it only needs normal spacing. */}
            <View style={{ height: isDesktop ? 40 : 200 }} />
          </ScrollView>

          {/* On desktop these sit in the sticky rail with the price summary;
              on a phone they stay pinned to the bottom of the screen. */}
          {!isDesktop && <View style={styles.bottomActions}>{actionButtons}</View>}
        </>
      )}
      {isDesktop && <WebStickyHeader visible={scrolled} />}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // Desktop only: the action buttons after they move out of the pinned bottom
  // bar and into the sticky summary rail.
  railActions: {
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 15,
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
  itemIcon: {
    marginRight: 12,
    marginTop: 2,
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
  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  couponInput: {
    flex: 1,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.text,
    outlineStyle: 'none',
  },
  couponError: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.error,
  },
  couponApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#EAF7EC',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  couponAppliedCopy: { flex: 1, gap: 2 },
  couponAppliedCode: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: 0.8,
  },
  couponAppliedText: { fontSize: 12, color: Colors.textLight },
  couponRemove: { fontSize: 12.5, fontWeight: '700', color: Colors.error },
  discountLabel: { color: Colors.success, fontWeight: '700' },
  discountValue: { color: Colors.success, fontWeight: '800' },

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
