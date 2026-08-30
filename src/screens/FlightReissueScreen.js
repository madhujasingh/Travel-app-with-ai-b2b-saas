import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import API_CONFIG from '../config/api';
import DatePickerModal from '../components/DatePickerModal';
import { useAuth } from '../context/AuthContext';

// TripJack's Reissue Review/Book errors sometimes come back as a direct
// passthrough and sometimes wrapped by GlobalExceptionHandler - same
// dual-shape handling used in FlightBookingScreen.js.
const parseTripJackError = (data, fallback) => {
  let message = data?.errors?.[0]?.message || data?.message;
  if (!message && typeof data?.message === 'string') {
    const match = data.message.match(/"message"\s*:\s*"([^"]+)"/);
    if (match) message = match[1];
  }
  return message || fallback;
};

const post = async (path, body, token) => {
  const response = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  return { ok: response.ok, data };
};

const parseDateValue = (value) => {
  const match = (value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

// Groups the booking's trips (each may be multi-segment if connecting) into
// pickable reissue candidates - one trip is reissued at a time per TripJack's
// docs. The PNR for a trip is read off its first segment's route key, since
// pnrDetails is keyed per-segment (e.g. "DEL-BLR") not per-trip.
const parseBookingTrips = (bookingDetails) => {
  const tripInfos = bookingDetails?.itemInfos?.AIR?.tripInfos || [];
  const travellerInfos = bookingDetails?.itemInfos?.AIR?.travellerInfos || [];

  return tripInfos.map((trip, tripIndex) => {
    const segments = trip?.sI || [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    const firstSegmentKey = `${first?.da?.code}-${first?.aa?.code}`;

    let pnr = null;
    travellerInfos.forEach((t) => {
      if (pnr) return;
      const value = t?.pnrDetails?.[firstSegmentKey];
      if (value) pnr = value;
    });

    return {
      tripIndex,
      label: `${first?.da?.code || '--'} → ${last?.aa?.code || '--'}`,
      fromCode: first?.da?.code,
      toCode: last?.aa?.code,
      currentDate: first?.dt ? first.dt.split('T')[0] : null,
      pnr,
    };
  });
};

const buildPaxInfo = (travellerInfos) => {
  const counts = { ADULT: 0, CHILD: 0, INFANT: 0 };
  (travellerInfos || []).forEach((t) => {
    if (counts[t.pt] != null) counts[t.pt] += 1;
  });
  return counts;
};

// Reissue Review reuses the standard (pre-booking) Review response shape -
// ssrInfo lives at the segment level (sI[].ssrInfo), not nested per-traveller
// like the separate post-booking Ancillaries product.
const getSsrSegments = (reviewData) => {
  const trips = Array.isArray(reviewData?.tripInfos) ? reviewData.tripInfos : [];
  const segments = [];
  trips.forEach((trip) => {
    (trip?.sI || []).forEach((segment) => {
      const baggageOptions = segment?.ssrInfo?.BAGGAGE || [];
      const mealOptions = segment?.ssrInfo?.MEAL || [];
      if (baggageOptions.length || mealOptions.length) {
        segments.push({
          id: segment?.id,
          label: `${segment?.da?.code || '--'} → ${segment?.aa?.code || '--'}`,
          baggageOptions,
          mealOptions,
        });
      }
    });
  });
  return segments;
};

const FlightReissueScreen = ({ route, navigation }) => {
  const { token } = useAuth();
  const { bookingId } = route.params || {};

  const [phase, setPhase] = useState('loading');
  const [bookingDetails, setBookingDetails] = useState(null);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [newDate, setNewDate] = useState(null);
  const [flightOptions, setFlightOptions] = useState([]);
  const [reviewData, setReviewData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reissueSsrSelections, setReissueSsrSelections] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const { ok, data } = await post('/flights/booking-details', { bookingId }, token);
        if (!ok || data?.order?.status !== 'SUCCESS') {
          throw new Error('This booking must be a confirmed (SUCCESS) ticket before it can be reissued.');
        }
        setBookingDetails(data);
        setTrips(parseBookingTrips(data));
        setPhase('pickTrip');
      } catch (error) {
        Alert.alert('Reschedule Flight', error.message || 'Unable to load this booking.');
        navigation.goBack();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseTrip = (trip) => {
    setSelectedTrip(trip);
    setNewDate(null);
    setDatePickerVisible(true);
  };

  const runReissueSearch = async (trip, dateString) => {
    setBusy(true);
    setPhase('searching');
    try {
      const travellerInfos = bookingDetails?.itemInfos?.AIR?.travellerInfos || [];
      const paxInfo = buildPaxInfo(travellerInfos);
      const searchBody = {
        paxInfo,
        routeInfos: [
          {
            fromCityOrAirport: { code: trip.fromCode },
            toCityOrAirport: { code: trip.toCode },
            travelDate: dateString,
          },
        ],
        oldBookingId: bookingId,
        pnr: trip.pnr,
        paxIds: travellerInfos.map((t) => String(t.id)),
      };

      const listResult = await post('/flights/reissue/searchquery-list', searchBody, token);
      if (!listResult.ok || listResult.data?.status?.success === false) {
        throw new Error(parseTripJackError(listResult.data, 'Unable to search reschedule options for this trip.'));
      }
      const requestId = listResult.data?.searchQuery?.requestId || listResult.data?.requestIds?.[0];
      if (!requestId) {
        throw new Error('TripJack did not return a search request id.');
      }

      const pollResult = await post('/flights/reissue/search', { requestId }, token);
      if (!pollResult.ok || pollResult.data?.status?.success === false) {
        throw new Error(parseTripJackError(pollResult.data, 'Unable to fetch reschedule options for this trip.'));
      }

      const tripBuckets = pollResult.data?.searchResult?.tripInfos || {};
      const bucketKey = Object.keys(tripBuckets)[0];
      const options = (tripBuckets[bucketKey] || []).map((option, index) => {
        const priceEntry = option?.totalPriceList?.[0] || {};
        const segments = option?.sI || [];
        const first = segments[0];
        const last = segments[segments.length - 1];
        let estimate = 0;
        // fd is per-paxtype, not per-traveller - TripJack's doc: "have to
        // multiply by 2 for Adult Fare and multiply by 1 for Child Fare"
        // when e.g. 2 adults + 1 child are travelling.
        Object.entries(priceEntry?.fd || {}).forEach(([paxType, paxFare]) => {
          estimate += Number(paxFare?.fC?.TF || 0) * (paxInfo[paxType] || 0);
        });
        return {
          key: priceEntry?.id || String(index),
          priceId: priceEntry?.id,
          fareIdentifier: priceEntry?.fareIdentifier,
          carrier: first?.fD?.aI?.name || first?.fD?.aI?.code,
          departTime: first?.dt,
          arriveTime: last?.at,
          estimate,
        };
      });

      if (!options.length) {
        throw new Error('No reschedule options were found for that date.');
      }
      setFlightOptions(options);
      setPhase('pickFlight');
    } catch (error) {
      Alert.alert('Reschedule Flight', error.message);
      setPhase('pickTrip');
    } finally {
      setBusy(false);
    }
  };

  const chooseNewDate = (dateString) => {
    setDatePickerVisible(false);
    setNewDate(dateString);
    runReissueSearch(selectedTrip, dateString);
  };

  const chooseFlightOption = async (option) => {
    setBusy(true);
    try {
      const { ok, data } = await post('/flights/reissue/review', {
        priceIds: [option.priceId],
        oldBookingId: bookingId,
        priceValidation: true,
      }, token);
      if (!ok || data?.status?.success === false) {
        throw new Error(parseTripJackError(data, 'This option is no longer available - please pick another.'));
      }
      setReviewData(data);
      setReissueSsrSelections({});
      setPhase('confirm');
    } catch (error) {
      Alert.alert('Reschedule Flight', error.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleReissueSsr = (travellerId, segmentId, type, code) => {
    setReissueSsrSelections((prev) => {
      const travellerSel = { ...(prev[travellerId] || {}) };
      const segmentSel = { ...(travellerSel[segmentId] || {}) };
      segmentSel[type] = segmentSel[type] === code ? undefined : code;
      travellerSel[segmentId] = segmentSel;
      return { ...prev, [travellerId]: travellerSel };
    });
  };

  const confirmReissue = async () => {
    setBusy(true);
    try {
      const newBookingId = reviewData?.bookingId;
      const amount = Number(reviewData?.totalPriceInfo?.totalFareDetail?.fC?.TF || 0);
      const travellerInfo = (reviewData?.travellers || []).map((t) => {
        const perSegment = reissueSsrSelections[t.id] || {};
        const ssrBaggageInfos = Object.entries(perSegment)
          .filter(([, sel]) => sel?.baggage)
          .map(([segmentId, sel]) => ({ key: segmentId, code: sel.baggage }));
        const ssrMealInfos = Object.entries(perSegment)
          .filter(([, sel]) => sel?.meal)
          .map(([segmentId, sel]) => ({ key: segmentId, code: sel.meal }));
        return {
          ti: t.ti,
          fN: t.fN,
          lN: t.lN,
          pt: t.pt,
          dob: t.dob,
          ...(ssrBaggageInfos.length ? { ssrBaggageInfos } : {}),
          ...(ssrMealInfos.length ? { ssrMealInfos } : {}),
        };
      });

      const reissueBody = {
        bookingId: newBookingId,
        oldBookingId: bookingId,
        paymentInfos: [{ bookingId: newBookingId, amount }],
        travellerInfo,
        deliveryInfo: {
          emails: [bookingDetails?.order?.deliveryInfo?.emails?.[0] || 'test@itinera.com'],
          contacts: [bookingDetails?.order?.deliveryInfo?.contacts?.[0] || '+919500112233'],
        },
      };

      // GST is conditional on the reissued fare's own conditions (root doc:
      // "gstInfo - GST details (if igm=true)"), not just whether the old
      // booking happened to have one - only forward it when the new fare
      // actually calls for GST and we have real values to send.
      const oldGst = bookingDetails?.gstInfo;
      const gstNeeded = !!reviewData?.conditions?.gst?.igm || !!reviewData?.conditions?.gst?.gstappl;
      if (gstNeeded && oldGst?.gstNumber) {
        reissueBody.gstInfo = {
          gstNumber: oldGst.gstNumber,
          registeredName: oldGst.registeredName,
          mobile: oldGst.mobile,
          email: oldGst.email,
          address: oldGst.address,
        };
      }

      const { ok, data } = await post('/flights/reissue/book', reissueBody, token);
      if (!ok || data?.status?.success === false) {
        throw new Error(parseTripJackError(data, 'Unable to confirm this reschedule right now.'));
      }

      setPhase('done');
      Alert.alert('Rescheduled', 'This trip has been successfully rescheduled.', [
        { text: 'OK', onPress: () => navigation.replace('MyFlightBookings') },
      ]);
    } catch (error) {
      Alert.alert('Reschedule Flight', error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={28} color={Colors.secondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reschedule Flight</Text>
        <View style={{ width: 28 }} />
      </View>

      {phase === 'loading' || phase === 'searching' ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.hintText}>{phase === 'searching' ? 'Searching for new options…' : 'Loading booking…'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {phase === 'pickTrip' ? (
            <>
              <Text style={styles.sectionTitle}>Which trip do you want to reschedule?</Text>
              <Text style={styles.hintText}>
                Only one trip can be rescheduled at a time, and a booking can only be reissued once.
              </Text>
              {trips.map((trip) => (
                <TouchableOpacity
                  key={trip.tripIndex}
                  style={styles.tripCard}
                  activeOpacity={0.85}
                  onPress={() => chooseTrip(trip)}
                  disabled={busy}
                >
                  <View style={styles.tripCardIconWrap}>
                    <Ionicons name="airplane" size={18} color={Colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{trip.label}</Text>
                    <Text style={styles.hintText}>Currently {trip.currentDate}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          {phase === 'pickFlight' ? (
            <>
              <Text style={styles.sectionTitle}>{selectedTrip?.label}</Text>
              <Text style={styles.hintText}>New options for {newDate}</Text>
              {flightOptions.map((option) => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => chooseFlightOption(option)}
                  disabled={busy}
                >
                  <View style={styles.optionCardHeader}>
                    <Ionicons name="airplane-outline" size={16} color={Colors.primaryDark} />
                    <Text style={styles.cardTitle}>{option.carrier}</Text>
                  </View>
                  <Text style={styles.hintText}>
                    {option.departTime} → {option.arriveTime}
                  </Text>
                  <Text style={styles.priceText}>~₹{Math.round(option.estimate).toLocaleString()} <Text style={styles.priceTextMuted}>before fees</Text></Text>
                </TouchableOpacity>
              ))}
            </>
          ) : null}

          {phase === 'confirm' ? (
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="checkmark-done-circle-outline" size={16} color={Colors.primaryDark} />
                <Text style={styles.cardTitle}>Confirm Reschedule</Text>
              </View>
              <Text style={styles.hintText}>
                Total amount to pay — includes the fare difference, airline reissue fee, and taxes:
              </Text>
              <Text style={styles.priceText}>
                ₹{Math.round(Number(reviewData?.totalPriceInfo?.totalFareDetail?.fC?.TF || 0)).toLocaleString()}
              </Text>

              {getSsrSegments(reviewData).map((segment) => (
                <View key={segment.id} style={styles.ancillaryTravellerBlock}>
                  <Text style={styles.cardSubtitle}>{segment.label}</Text>
                  {(reviewData?.travellers || [])
                    .filter((t) => t.pt !== 'INFANT')
                    .map((traveller) => (
                      <View key={traveller.id} style={{ marginBottom: 8 }}>
                        <Text style={styles.hintText}>
                          {traveller.ti} {traveller.fN} {traveller.lN}
                        </Text>
                        {segment.baggageOptions.length ? (
                          <View style={styles.chipRow}>
                            {segment.baggageOptions.map((option) => {
                              const selected =
                                reissueSsrSelections[traveller.id]?.[segment.id]?.baggage === option.code;
                              return (
                                <TouchableOpacity
                                  key={option.code}
                                  style={[styles.ssrChip, selected ? styles.ssrChipSelected : null]}
                                  onPress={() => toggleReissueSsr(traveller.id, segment.id, 'baggage', option.code)}
                                >
                                  <Text style={[styles.ssrChipText, selected ? styles.ssrChipTextSelected : null]}>
                                    {option.desc} {Number(option.amount) > 0 ? `(+₹${option.amount})` : ''}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : null}
                        {segment.mealOptions.length ? (
                          <View style={styles.chipRow}>
                            {segment.mealOptions.map((option) => {
                              const selected = reissueSsrSelections[traveller.id]?.[segment.id]?.meal === option.code;
                              return (
                                <TouchableOpacity
                                  key={option.code}
                                  style={[styles.ssrChip, selected ? styles.ssrChipSelected : null]}
                                  onPress={() => toggleReissueSsr(traveller.id, segment.id, 'meal', option.code)}
                                >
                                  <Text style={[styles.ssrChipText, selected ? styles.ssrChipTextSelected : null]}>
                                    {option.desc} {Number(option.amount) > 0 ? `(+₹${option.amount})` : ''}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : null}
                      </View>
                    ))}
                </View>
              ))}

              <TouchableOpacity style={styles.primaryButton} onPress={confirmReissue} disabled={busy}>
                <Text style={styles.primaryButtonText}>{busy ? 'Confirming…' : 'Confirm & Reissue'}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {phase === 'done' ? <Text style={styles.hintText}>This trip has been rescheduled.</Text> : null}
        </ScrollView>
      )}

      <DatePickerModal
        visible={datePickerVisible}
        title="New Travel Date"
        initialDate={parseDateValue(selectedTrip?.currentDate) || new Date()}
        minDate={new Date()}
        onSelect={chooseNewDate}
        onClose={() => setDatePickerVisible(false)}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: Colors.secondary,
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
  },
  hintText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 12,
  },
  tripCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
    marginTop: 8,
    marginBottom: 2,
  },
  ancillaryTravellerBlock: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  ssrChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
  },
  ssrChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primarySoft,
  },
  ssrChipText: {
    fontSize: 12,
    color: Colors.textLight,
  },
  ssrChipTextSelected: {
    color: Colors.primaryDark,
    fontWeight: '700',
  },
  priceText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.primaryDark,
    marginTop: 6,
  },
  priceTextMuted: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonText: {
    color: Colors.secondary,
    fontWeight: '700',
  },
});

export default FlightReissueScreen;
