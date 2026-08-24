// Approximate, hardcoded EUR->INR rate for DISPLAY ONLY. HotelBeds'
// Activities API always prices in EUR (tied to our agency account's
// currency - there's no way to request a different settlement currency,
// and Content API's /currencies endpoint is just a code/name lookup table,
// not exchange rates). This exists purely to help Indian customers gauge
// the price in a currency they're used to - it is NOT used anywhere
// financial; the actual booking still settles in EUR against the agency
// account. Update this constant periodically as real rates drift - it
// isn't fetched live.
const EUR_TO_INR_RATE = 90;

const isEuro = (currency) => {
  if (!currency) return false;
  const normalized = currency.trim().toLowerCase();
  return normalized === 'eur' || normalized === 'euro';
};

// Returns a display string like "≈ ₹406" for a EUR amount, or null if the
// currency isn't EUR (nothing to safely convert) or the amount is missing.
export const formatInrEquivalent = (amount, currency) => {
  if (amount == null || Number.isNaN(Number(amount)) || !isEuro(currency)) {
    return null;
  }
  const inr = Number(amount) * EUR_TO_INR_RATE;
  return `≈ ₹${inr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};
