// HotelBeds' APITUDE error codes (see "API Errors.txt") -> friendly
// customer-facing text, same pattern as tripjackErrors.js's
// TRIPJACK_ERROR_MESSAGES. Only covers codes reachable through this app's
// actual booking flow (search/detail/confirm/booking-detail/cancel); the
// rest fall back to HotelBeds' own `text`, which is already fairly readable.
export const ACTIVITIES_ERROR_MESSAGES = {
  E_REQUEST_ATLEASTONEADULT: 'At least one adult (18+) traveler is required for this booking.',
  E_REQUEST_PASTDATE: 'The selected date has already passed - please choose a different date.',
  E_REQUEST_DATERANGE: 'The selected dates aren\'t valid for this search - please choose a different date range.',
  E_ACTIVITYDETAIL_NOTFOUND: 'This activity is no longer available for the selected dates and travelers - please search again.',
  E_CONFIRMATION_MISSINGQUESTION: 'Please answer all required questions before confirming this booking.',
  E_CONFIRMATION_MISSINGPAXINFORMATION: 'Please complete all required traveler details before confirming this booking.',
  E_CONFIRMATION_PAXESDONOTMATCH: 'Traveler ages don\'t match what was selected earlier - please go back and select this option again.',
  E_CONFIRMATION_SERVICENOLONGERAVAILABLE: 'This option is no longer available - it may have expired. Please go back and select it again.',
  E_CONFIRMATION_NOTRESPONDING: 'The booking system isn\'t responding right now - please try again in a moment.',
  E_CONFIRMATION_PAYMENTERROR: 'There was a problem processing payment - this booking was not confirmed.',
  E_CONFIRMATION_GATEWAYNOTRESPONDING: 'The payment system isn\'t responding right now - please try again.',
  E_CONFIRMATION_LIMITEXCEEDED: 'The card does not have enough funds to complete this booking.',
  E_CONFIRMATION_INVALIDCARD: 'The card information provided isn\'t valid - please check and try again.',
  E_CONFIRMATION_PASTEXPIRATIONDATE: 'The card\'s expiration date has already passed.',
  E_CONFIRMATION_PURCHASEABLESERVICEALREADYCONFIRMED: 'This booking has already been confirmed.',
  E_BOOKING_NOTFOUND: 'This booking could not be found - it may have been cancelled, or the reference is incorrect.',
  E_BOOKING_NOTCANCELLABLE: 'This booking can no longer be cancelled.',
  E_BOOKING_CANCELLATIONERROR: 'There was a problem cancelling this booking - please try again or contact support.',
  E_AVAILABILITY: 'Something went wrong while searching - please try again.',
  E_UNKNOWN: 'Something went wrong - please try again.',
};

// HotelBeds' own error envelope ({"errors":[{"code","text"}], ...}) almost
// always arrives wrapped inside our backend's generic error message string
// (e.g. "Activities API request failed with status 400: {...raw json...}")
// rather than as a clean nested object - our backend's ActivitiesClient
// always rethrows upstream failures as a single concatenated string, same
// situation TripJack's errors are in (see hotelApiErrors.js). Without this,
// callers fall back to showing that whole raw string, including the "{"
// json braces, to the user.
export const parseActivitiesError = (data, fallback) => {
  let errors = [];
  if (Array.isArray(data?.errors)) {
    errors = data.errors;
  } else if (typeof data?.message === 'string') {
    const codes = [...data.message.matchAll(/"code"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    const texts = [...data.message.matchAll(/"text"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    errors = texts.map((text, i) => ({ code: codes[i], text }));
  }

  if (errors.length === 0) {
    return fallback;
  }

  // Stale/expired rateKeys (valid ~30 minutes) are the single most common
  // real-world failure here - give a clear, actionable message instead of
  // HotelBeds' technical "rateKey [...] is incorrect or does not exist" text,
  // regardless of which error code it happens to arrive under.
  if (errors.some((e) => (e.text || '').toLowerCase().includes('ratekey'))) {
    return "This option is no longer available - it may have expired. Please go back and select it again.";
  }

  const messages = errors
    .map((e) => ACTIVITIES_ERROR_MESSAGES[e.code] || e.text)
    .filter(Boolean);

  return messages.length > 0 ? messages.join('\n') : fallback;
};
