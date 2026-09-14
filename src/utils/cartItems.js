// Builders for cart lines, so every product produces the same shape and the
// cart doesn't have to special-case what it is holding.
//
// Two fields matter beyond display:
//
//   productType - which markup and coupon rules apply. The cart sends this when
//                 validating a coupon; without it a FLIGHT-only code was being
//                 rejected on a flight.
//
//   expiresAt   - supplier quotes are time-limited (a hotel search session is
//                 about 15 minutes, a HotelBeds rateKey 30), so a saved line
//                 goes stale. The cart marks those expired rather than quoting
//                 a price that can no longer be booked.

// Conservative windows, based on the supplier docs.
const SESSION_MINUTES = {
  HOTEL: 15,
  ACTIVITY: 30,
  CAB: 20,
  INSURANCE: 15,
  FLIGHT: 15,
};

export const expiryFor = (productType) => {
  const minutes = SESSION_MINUTES[productType] || 15;
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
};

export const isExpired = (item) =>
  !!item?.expiresAt && new Date(item.expiresAt).getTime() < Date.now();

const base = ({ id, productType, title, destination, duration, total, people, iconName, extra }) => ({
  id,
  productType,
  title,
  destination,
  duration,
  people: people || 1,
  price: (Number(total) || 0) / (people || 1),
  lineTotal: Number(total) || 0,
  iconName,
  addedAt: new Date().toISOString(),
  expiresAt: expiryFor(productType),
  ...extra,
});

export const buildHotelCartItem = ({ hotelName, cityName, checkIn, checkOut, nights, total, rooms, tjHotelId, reviewResult, searchContext }) =>
  base({
    id: `hotel-${reviewResult?.bookingId || tjHotelId}`,
    productType: 'HOTEL',
    title: hotelName || 'Hotel stay',
    destination: cityName || '',
    duration: nights ? `${nights} night${nights === 1 ? '' : 's'}` : [checkIn, checkOut].filter(Boolean).join(' → '),
    total,
    people: rooms || 1,
    iconName: 'business-outline',
    extra: { tjHotelId, reviewResult, searchContext, entityKey: tjHotelId },
  });

export const buildCabCartItem = ({ routeSummary, vehicleLabel, distance, total, passengers, quote, routeDetails, journeyInfo, journeyType, group }) =>
  base({
    id: `cab-${quote?.quotationId || quote?.id || Date.now()}`,
    productType: 'CAB',
    title: vehicleLabel || 'Cab booking',
    destination: routeSummary || '',
    duration: distance || '',
    total,
    people: passengers || 1,
    iconName: 'car-outline',
    extra: { quote, routeDetails, journeyInfo, journeyType, group },
  });

export const buildActivityCartItem = ({ name, destinationLabel, from, to, total, adults, activityCode, rateKey, currency, questions, paxAmounts, sessionName, childAges }) =>
  base({
    id: `activity-${activityCode || rateKey || Date.now()}`,
    productType: 'ACTIVITY',
    title: name || 'Activity',
    destination: destinationLabel || '',
    duration: [from, to].filter(Boolean).join(' → '),
    total,
    people: adults || 1,
    iconName: 'umbrella-outline',
    extra: { activityCode, rateKey, currency, questions, paxAmounts, sessionName, childAges, from, to, adults },
  });
