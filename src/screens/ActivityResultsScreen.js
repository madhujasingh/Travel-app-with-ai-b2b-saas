import React, { useMemo, useState } from 'react';
import { FlatList, Image, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useResponsive from '../hooks/useResponsive';
import WebResultsLayout, { WebResultsBar, WebResultsCount } from '../components/web/WebResultsLayout';
import { Colors } from '../constants/Colors';

// Activity results on their own screen, the way hotels and cabs already work.
// They used to render under the search form on the Activities screen, so a
// search left you looking at the form you had just filled in with the results
// somewhere below it.
const getActivityImage = (activity) => {
  const images = activity?.content?.media?.images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const urls = images[0]?.urls;
  if (!Array.isArray(urls) || urls.length === 0) return null;
  const medium = urls.find((u) => u.sizeType === 'MEDIUM') || urls[0];
  return medium?.resource || null;
};

const getActivityPrice = (activity) => {
  const amounts = activity?.amountsFrom;
  if (!Array.isArray(amounts) || amounts.length === 0) return null;
  // amountsFrom includes an entry per paxType regardless of what was actually
  // searched for - an untouched paxType (e.g. CHILD, when the search only
  // sent adult paxes) can carry a placeholder amount of 0, which would look
  // like "the cheapest price" but isn't a real price. Prefer the ADULT entry
  // (every search here always includes at least one adult pax) over blindly
  // taking the numeric minimum across all paxTypes.
  const adult = amounts.find((a) => a.paxType === 'ADULT' && a.amount > 0);
  const cheapest = adult || amounts.filter((a) => a.amount > 0).reduce((min, a) => (a.amount < min.amount ? a : min), amounts[0]);
  return { amount: cheapest.amount, currency: activity?.currencyName || activity?.content?.currency };
};

const SORT_OPTIONS = [
  { key: 'RELEVANCE', label: 'Relevance' },
  { key: 'PRICE_LOW', label: 'Price: low to high' },
  { key: 'PRICE_HIGH', label: 'Price: high to low' },
];

const ActivityResultsScreen = ({ route, navigation }) => {
  const { results = [], searchContext = {}, destinationLabel = '' } = route.params || {};
  const { centeredContent, isDesktop, columns } = useResponsive();
  const [sortBy, setSortBy] = useState('RELEVANCE');

  const activityColumns = isDesktop ? Math.min(columns, 3) : 1;

  const sorted = useMemo(() => {
    const list = [...(results || [])];
    if (sortBy === 'RELEVANCE') return list;
    const amount = (a) => getActivityPrice(a)?.amount ?? Number.MAX_SAFE_INTEGER;
    return list.sort((a, b) =>
      sortBy === 'PRICE_LOW' ? amount(a) - amount(b) : amount(b) - amount(a)
    );
  }, [results, sortBy]);

  const openActivity = (item) => {
    const name = item?.content?.name || 'Activity';
    navigation.navigate('ActivityDetail', {
      activityCode: item?.content?.activityCode,
      name,
      from: searchContext.from,
      to: searchContext.to,
      adults: searchContext.adults,
      childAges: searchContext.childAges,
    });
  };

  const renderActivityCard = ({ item }) => {
    const imageUrl = getActivityImage(item);
    const price = getActivityPrice(item);
    const name = item?.content?.name || 'Activity';
    const destinationName = item?.country?.destinations?.[0]?.name || '';
    return (
      <TouchableOpacity
        style={[styles.resultCard, activityColumns > 1 && styles.resultCardGrid]}
        onPress={() => openActivity(item)}
        activeOpacity={0.88}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.resultImage} />
        ) : (
          <View style={[styles.resultImage, styles.resultImagePlaceholder]}>
            <Ionicons name="image-outline" size={24} color={Colors.textMuted} />
          </View>
        )}
        <View style={styles.resultInfo}>
          <Text style={styles.resultName} numberOfLines={2}>{name}</Text>
          {!!destinationName && <Text style={styles.resultDestination}>{destinationName}</Text>}
          {price ? (
            <Text style={styles.resultPrice}>
              From <Text style={styles.resultPriceInr}>{price.currencyId} {price.amount}</Text>
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const list = (
    <FlatList
      data={sorted}
      keyExtractor={(item, index) => item?.activityCode || item?.content?.activityCode || String(index)}
      contentContainerStyle={[styles.resultsList, isDesktop ? null : centeredContent]}
      key={activityColumns}
      numColumns={activityColumns}
      columnWrapperStyle={activityColumns > 1 ? styles.gridRow : undefined}
      renderItem={renderActivityCard}
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={
        <View style={styles.centerState}>
          <Text style={styles.emptyText}>No activities found for this search.</Text>
        </View>
      }
    />
  );

  const subtitle = [
    searchContext.from && searchContext.to ? `${searchContext.from} - ${searchContext.to}` : '',
    searchContext.adults
      ? `${searchContext.adults} adult${searchContext.adults === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean).join('  ·  ');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />

      {isDesktop ? (
        <>
          <WebResultsBar
            title={destinationLabel || 'Things To Do'}
            subtitle={subtitle}
            actionLabel="Modify search"
            onAction={() => navigation.goBack()}
            onBack={() => navigation.goBack()}
          />
          <WebResultsLayout
            sidebar={
              <>
                <WebResultsCount count={sorted.length} noun="activity" />
                <View style={styles.sortBlock}>
                  <Text style={styles.sortTitle}>Sort By</Text>
                  {SORT_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.key}
                      style={[styles.sortRow, sortBy === option.key && styles.sortRowActive]}
                      onPress={() => setSortBy(option.key)}
                    >
                      <Text style={[styles.sortLabel, sortBy === option.key && styles.sortLabelActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            }
          >
            {list}
          </WebResultsLayout>
        </>
      ) : (
        <>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={26} color={Colors.secondary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {destinationLabel || 'Things To Do'}
              </Text>
              {!!subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
            </View>
            <View style={{ width: 26 }} />
          </View>
          {list}
        </>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.secondary },
  headerSubtitle: { fontSize: 12, color: Colors.secondary, opacity: 0.9, marginTop: 2 },
  sortBlock: { marginTop: 16 },
  sortTitle: { fontSize: 13, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  sortRow: { paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8 },
  sortRowActive: { backgroundColor: Colors.primarySoft },
  sortLabel: { fontSize: 13, color: Colors.textLight },
  sortLabelActive: { color: Colors.primaryDark, fontWeight: '700' },
  resultsList: {
    padding: 16,
    gap: 12,
  },
  gridRow: {
    gap: 12,
  },
  resultCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  resultCardGrid: {
    flex: 1,
  },
  resultImage: {
    width: 96,
    height: 96,
  },
  resultImagePlaceholder: {
    backgroundColor: Colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  resultDestination: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  resultPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 6,
  },
  resultPriceInr: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  centerState: {
    marginTop: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
});

export default ActivityResultsScreen;
