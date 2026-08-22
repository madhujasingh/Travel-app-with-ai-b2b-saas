// HotelBeds' own error envelope ({"errors":[{"code","text"}], ...}) almost
// always arrives wrapped inside our backend's generic error message string
// (e.g. "Activities API request failed with status 400: {...raw json...}")
// rather than as a clean nested object - our backend's ActivitiesClient
// always rethrows upstream failures as a single concatenated string, same
// situation TripJack's errors are in (see hotelApiErrors.js). Without this,
// callers fall back to showing that whole raw string, including the "{"
// json braces, to the user.
export const parseActivitiesError = (data, fallback) => {
  let texts = [];
  if (Array.isArray(data?.errors)) {
    texts = data.errors.map((e) => e?.text).filter(Boolean);
  } else if (typeof data?.message === 'string') {
    texts = [...data.message.matchAll(/"text"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
  }

  if (texts.length === 0) {
    return fallback;
  }

  // Stale/expired rateKeys (valid ~30 minutes) are the single most common
  // real-world failure here - give a clear, actionable message instead of
  // HotelBeds' technical "rateKey [...] is incorrect or does not exist" text.
  if (texts.some((t) => t.toLowerCase().includes('ratekey'))) {
    return "This option is no longer available - it may have expired. Please go back and select it again.";
  }

  return texts.join('\n');
};
