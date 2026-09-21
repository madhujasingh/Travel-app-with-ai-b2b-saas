// The destinations the Holiday Packages landing offers, split by market.
//
// Lives here rather than inside LandPackageScreen because ItineraryListScreen
// needs the same split: packages carry a destination name but nothing saying
// which market it belongs to, so "show me international packages" can only be
// answered by matching the name against these lists.
export const internationalDestinations = [
  { id: 1, name: 'Paris', country: 'France', image: 'business-outline', popular: true, themes: ['city', 'honeymoon'] },
  { id: 2, name: 'Tokyo', country: 'Japan', image: 'navigate-outline', popular: true, themes: ['city', 'family'] },
  { id: 3, name: 'Dubai', country: 'UAE', image: 'business', popular: true, themes: ['city', 'family', 'adventure'] },
  { id: 4, name: 'Bali', country: 'Indonesia', image: 'sunny', popular: true, themes: ['beach', 'honeymoon'] },
  { id: 5, name: 'Maldives', country: 'Maldives', image: 'water-outline', popular: true, themes: ['beach', 'honeymoon'] },
  { id: 6, name: 'Singapore', country: 'Singapore', image: 'leaf-outline', popular: false, themes: ['city', 'family'] },
  { id: 7, name: 'Thailand', country: 'Thailand', image: 'flower-outline', popular: false, themes: ['beach', 'adventure'] },
  { id: 8, name: 'Switzerland', country: 'Switzerland', image: 'trail-sign', popular: false, themes: ['hills', 'honeymoon'] },
];

export const indianDestinations = [
  { id: 1, name: 'Jaipur', state: 'Rajasthan', image: 'business', popular: true, themes: ['city', 'family'] },
  { id: 2, name: 'Goa', state: 'Goa', image: 'sunny', popular: true, themes: ['beach', 'honeymoon'] },
  { id: 3, name: 'Kerala', state: 'Kerala', image: 'leaf', popular: true, themes: ['hills', 'honeymoon', 'family'] },
  { id: 4, name: 'Manali', state: 'Himachal Pradesh', image: 'trail-sign', popular: true, themes: ['hills', 'adventure'] },
  { id: 5, name: 'Varanasi', state: 'Uttar Pradesh', image: 'flower', popular: true, themes: ['spiritual'] },
  { id: 6, name: 'Udaipur', state: 'Rajasthan', image: 'business-outline', popular: false, themes: ['city', 'honeymoon'] },
  { id: 7, name: 'Shimla', state: 'Himachal Pradesh', image: 'trail-sign-outline', popular: false, themes: ['hills', 'family'] },
  { id: 8, name: 'Agra', state: 'Uttar Pradesh', image: 'location', popular: false, themes: ['spiritual', 'city'] },
];

// Destinations we sell packages for but don't show a card for. Classification
// shouldn't be limited to what the landing page happens to feature - without
// Ranthambore here its four packages were unclassifiable, so they appeared
// under both markets, which is the bug this list exists to prevent.
const EXTRA_INDIA = [
  'ranthambore', 'rajasthan', 'delhi', 'mumbai', 'bangalore', 'chennai', 'kolkata',
  'hyderabad', 'pune', 'amritsar', 'rishikesh', 'haridwar', 'darjeeling', 'gangtok',
  'leh', 'ladakh', 'srinagar', 'kashmir', 'ooty', 'munnar', 'coorg', 'hampi',
  'khajuraho', 'jodhpur', 'jaisalmer', 'pushkar', 'mysore', 'andaman', 'sikkim',
  'meghalaya', 'assam', 'kaziranga', 'pondicherry', 'alleppey', 'lonavala',
  'mahabaleshwar', 'nainital', 'mussoorie', 'dharamshala', 'spiti', 'kutch',
];

const EXTRA_INTERNATIONAL = [
  'london', 'new york', 'usa', 'united states', 'uk', 'united kingdom', 'europe',
  'italy', 'rome', 'venice', 'spain', 'barcelona', 'greece', 'santorini', 'turkey',
  'istanbul', 'egypt', 'vietnam', 'hanoi', 'cambodia', 'sri lanka', 'colombo',
  'nepal', 'kathmandu', 'bhutan', 'malaysia', 'kuala lumpur', 'phuket', 'krabi',
  'pattaya', 'bangkok', 'seoul', 'korea', 'china', 'hong kong', 'australia',
  'sydney', 'new zealand', 'mauritius', 'seychelles', 'abu dhabi', 'qatar', 'doha',
];

const INDIA_NAMES = new Set(indianDestinations.map((d) => d.name.toLowerCase()));
const INTERNATIONAL_NAMES = new Set(internationalDestinations.map((d) => d.name.toLowerCase()));

// Also match the state or country, so a package filed against "Rajasthan" or
// "France" is classified rather than falling through.
const INDIA_REGIONS = new Set([
  ...indianDestinations.map((d) => (d.state || '').toLowerCase()).filter(Boolean),
  ...EXTRA_INDIA,
]);
const INTERNATIONAL_REGIONS = new Set([
  ...internationalDestinations.map((d) => (d.country || '').toLowerCase()).filter(Boolean),
  ...EXTRA_INTERNATIONAL,
]);

/**
 * Which market a package's destination belongs to: 'india', 'international',
 * or null when we can't tell. Callers should treat null as "show it" rather
 * than hiding it - a destination missing from these lists is a gap in the
 * lists, not a reason to make the package unreachable.
 */
export const marketForDestination = (destination) => {
  if (!destination) return null;
  const value = String(destination).toLowerCase();

  if (INDIA_NAMES.has(value) || INDIA_REGIONS.has(value)) return 'india';
  if (INTERNATIONAL_NAMES.has(value) || INTERNATIONAL_REGIONS.has(value)) return 'international';

  // Package destinations are often "Jaipur, Rajasthan" or "Bali, Indonesia",
  // so fall back to checking whether any known name appears within the string.
  for (const name of INDIA_NAMES) {
    if (value.includes(name)) return 'india';
  }
  for (const region of INDIA_REGIONS) {
    if (value.includes(region)) return 'india';
  }
  for (const name of INTERNATIONAL_NAMES) {
    if (value.includes(name)) return 'international';
  }
  for (const region of INTERNATIONAL_REGIONS) {
    if (value.includes(region)) return 'international';
  }
  return null;
};

// Every destination the publish form offers to pick from, so a package's
// market is decided by choosing a known place rather than by typing a name
// and hoping the category chip beside it was set to match. The extras above
// are plain lowercase keys for matching, so they get title-cased for display.
const titleCase = (value) =>
  value
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export const selectableDestinations = [
  ...indianDestinations.map((item) => ({
    name: item.name,
    market: 'india',
    region: item.state,
  })),
  ...internationalDestinations.map((item) => ({
    name: item.name,
    market: 'international',
    region: item.country,
  })),
  ...EXTRA_INDIA.map((name) => ({ name: titleCase(name), market: 'india', region: 'India' })),
  ...EXTRA_INTERNATIONAL.map((name) => ({
    name: titleCase(name),
    market: 'international',
    region: 'International',
  })),
]
  // The featured lists and the extras overlap, and a picker that offers the
  // same city twice looks broken.
  .filter(
    (item, index, all) =>
      all.findIndex((other) => other.name.toLowerCase() === item.name.toLowerCase()) === index
  )
  .sort((a, b) => a.name.localeCompare(b.name));
