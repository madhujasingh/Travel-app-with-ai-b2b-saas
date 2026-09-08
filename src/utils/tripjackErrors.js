// Shared across every screen that talks to TripJack's flight APIs
// (FlightsScreen's Review, FlightBookingScreen's Hold/Book/Confirm/Cancel) -
// keeps one growing map of TripJack error codes -> friendly customer-facing
// text instead of duplicating/drifting copies per screen.
export const TRIPJACK_ERROR_MESSAGES = {
  1000: 'This flight is no longer available. Please search again for a fresh fare.',
  1001: 'The number of infants can\'t be greater than the number of adults.',
  1002: 'The number of children can\'t be greater than the number of adults.',
  1006: 'A booking can have at most 9 passengers.',
  1007: 'Each traveller\'s first name is required and can\'t contain spaces.',
  1008: 'Each traveller\'s last name is required and must contain only letters and spaces.',
  1009: 'No fare was selected - please go back and review a fare first.',
  1010: 'Two travellers can\'t have the exact same name.',
  1012: 'Each adult traveller must be 12-100 years old as of the travel date.',
  1013: 'Each child traveller must be 2-12 years old as of the travel date.',
  1014: 'Each infant traveller must be 0-2 years old as of the travel date.',
  1015: 'The payment amount doesn\'t match this booking\'s total - please refresh and try again.',
  1051: 'Date of birth is required for the adult traveller(s).',
  1052: 'Date of birth is required for the child traveller(s).',
  1053: 'Date of birth is required for the infant traveller(s).',
  1057: 'This booking couldn\'t be found - it may have expired or the ID is incorrect.',
  1059: 'Your hold has expired. Please search again to get a fresh fare and start a new hold.',
  1064: 'A passport number is required for this fare.',
  1065: 'A valid passport issue date is required for this fare.',
  1066: 'A valid passport expiry date is required for this fare.',
  1067: 'The passport must not expire within 6 months of the travel date.',
  1068: 'The travel date can\'t be before the passport issue date.',
  1071: 'This fare is no longer available. Please search again for a fresh fare.',
  805: 'The GST number must be exactly 15 characters and a valid format.',
  806: 'The email or mobile number provided is invalid.',
  2560: 'Emergency contact email, phone, and name are all required for this fare.',
  2561: 'Emergency contact name can\'t be blank for this fare.',
  1119: 'Child or infant travellers can\'t be included in a student fare booking.',
  1120: 'Child or infant travellers can\'t be included in a senior citizen fare booking.',
  2567: 'A document ID is required in the passenger details for this fare.',
  2568: 'The document ID can\'t contain special characters.',
  2569: 'For a senior citizen fare, the traveller must be over 60 on the date of departure.',
  // "Special Return" (and similarly fare-family-linked) fares are priced as
  // a matched onward+return pair - picking that fare for one leg while the
  // other leg uses an unrelated fare (e.g. Corporate) is rejected outright.
  1080: 'This fare needs to be booked as a matching pair - a "Special Return" fare on one leg requires the same fare family on the other leg. Try picking a different fare for one of your legs so both match.',
  // TripSafe Embedded (flight-linked travel insurance) references this
  // flight's own bookingId from a separate TripJack account/key context
  // (Flights runs on the production key, TripSafe on a test/UAT-only key -
  // see tripsafe-api docs) - confirmed live that TripJack's test-key system
  // never recognizes a production-key flight's bookingId at all, regardless
  // of how fresh it is, so this isn't something retrying fixes.
  2503: 'Travel insurance isn\'t available for this flight yet - you can still book your flight without it.',
  // Agency-side TripJack wallet is out of funds - NOT the customer's own
  // payment failing. Worded so a customer isn't told their card/payment was
  // declined when the real fix is topping up our TripJack account.
  2001: 'We couldn\'t complete this booking right now due to a temporary issue on our side. Nothing has been charged - please try again shortly or contact support.',
};

// Codes where the underlying fare/hold/booking is dead - there's nothing to
// retry on this screen, the user needs to go back and search again.
export const SESSION_DEAD_ERROR_CODES = new Set([1000, 1057, 1059, 1071]);

// A handful of TripJack errors (e.g. expired priceId/bookingId "keys" on a
// stale search result - see fare-rule-api.txt's documented Case 1) come
// back with no errCode at all, just raw text - matched by content instead
// of by code. Each entry's `test` runs against the extracted raw message.
const TEXT_MATCHED_ERRORS = [
  {
    test: (msg) => /already expired.*valid keys|keys.*already expired/i.test(msg),
    message: 'This fare has expired. Please search again to get the latest price.',
    sessionDead: true,
  },
];

// TripJack errors sometimes come back as a direct passthrough
// ({status, errors:[{errCode, message}]}) and sometimes wrapped by our own
// GlobalExceptionHandler ({message: "TripJack request failed with status
// 400: {...raw body...}"}) - handle both shapes rather than assuming one.
export const parseTripJackError = (data, fallback) => {
  let errCode = data?.errors?.[0]?.errCode;
  let message = data?.errors?.[0]?.message || data?.message;

  if (!errCode && typeof data?.message === 'string') {
    const codeMatch = data.message.match(/"errCode"\s*:\s*"?(\d+)"?/);
    const messageMatch = data.message.match(/"message"\s*:\s*"([^"]+)"/);
    if (codeMatch) errCode = codeMatch[1];
    if (messageMatch) message = messageMatch[1];
  }

  const code = errCode ? Number(errCode) : null;
  const friendly = code && TRIPJACK_ERROR_MESSAGES[code];
  const textMatch = !friendly && typeof message === 'string' ? TEXT_MATCHED_ERRORS.find((entry) => entry.test(message)) : null;

  return {
    code,
    message: friendly || textMatch?.message || message || fallback,
    sessionDead: (code ? SESSION_DEAD_ERROR_CODES.has(code) : false) || Boolean(textMatch?.sessionDead),
  };
};
