import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useMarkup } from '../context/MarkupContext';
import { useAuth } from '../context/AuthContext';

// Shows the selling price (supplier fare + our markup) wherever a search result
// quotes a price, and - for staff only - the base/markup split underneath.
//
// Customers see one number, the one they'll be charged. Staff browsing the
// storefront see what the supplier gets and what we keep, which is the whole
// point of letting admins into the customer screens.
const MarkupPrice = ({
  service,
  category = 'DEFAULT',
  baseAmount,
  paxCount = 1,
  // Airline code, hotel id or destination - picks up a specific override.
  entityKey = '',
  style,
  priceStyle,
  prefix = '₹',
  suffix,
}) => {
  const { markupFor } = useMarkup();
  const { user } = useAuth();

  const base = Number(baseAmount) || 0;
  const markup = markupFor(service, category, base, paxCount, entityKey);
  const selling = base + markup;
  const isStaff = !!user?.role && user.role !== 'CUSTOMER';

  return (
    <View style={style}>
      <Text style={[styles.price, priceStyle]}>
        {prefix}
        {Math.round(selling).toLocaleString('en-IN')}
        {suffix ? <Text style={styles.suffix}> {suffix}</Text> : null}
      </Text>

      {isStaff && markup > 0 ? (
        <Text style={styles.breakdown}>
          base {prefix}
          {Math.round(base).toLocaleString('en-IN')} + markup {prefix}
          {Math.round(markup).toLocaleString('en-IN')}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primary,
  },
  suffix: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  breakdown: {
    fontSize: 10.5,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 2,
  },
});

export default MarkupPrice;
