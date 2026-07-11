// Friendlier text for TripJack Hotel v3's standardised error envelope
// ({ status: { success: false }, error: { code, message, requestId } }) - see
// hotel-review-api/review-api.docx "Error Codes" section.
const HOTEL_ERROR_MESSAGES = {
  INVALID_HOTEL_ID: 'This hotel is no longer available. Please search again.',
  INVALID_SEARCH_ID: 'This search session is no longer valid. Please search again.',
  SEARCH_SESSION_EXPIRED: 'Your search has expired (sessions last about 15 minutes). Please search again.',
  OPTION_SOLD_OUT: 'This option was just sold out. Please choose a different option.',
  INVALID_DATE_RANGE: 'Check-in must be a future date and check-out must be after check-in.',
  INVALID_ROOM_CONFIG: 'Check your room and guest details - something is invalid (e.g. 0 adults, too many rooms).',
  SUPPLIER_UNAVAILABLE: 'The hotel supplier is temporarily unavailable. Please try again shortly.',
  UNAUTHORIZED: 'Unable to authenticate with the hotel supplier.',
  RATE_LIMITED: 'Too many requests - please wait a moment and try again.',
};

// The v3 API returns its error envelope directly, but our backend's
// GlobalExceptionHandler wraps non-2xx TripJack responses as
// { message: "TripJack request failed with status 409: {...raw body...}" } -
// handle both shapes rather than assuming one.
export const parseHotelError = (data, fallback) => {
  let code = data?.error?.code;
  let message = data?.error?.message;

  if (!code && typeof data?.message === 'string') {
    const codeMatch = data.message.match(/"code"\s*:\s*"([A-Z_]+)"/);
    const messageMatch = data.message.match(/"message"\s*:\s*"([^"]+)"/);
    if (codeMatch) code = codeMatch[1];
    if (messageMatch) message = messageMatch[1];
  }

  return {
    code: code || null,
    message: (code && HOTEL_ERROR_MESSAGES[code]) || message || fallback,
    soldOut: code === 'OPTION_SOLD_OUT',
    expired: code === 'SEARCH_SESSION_EXPIRED' || code === 'INVALID_SEARCH_ID',
  };
};

// Doc: "The searchId is valid for approximately 15 minutes. Implement a
// session countdown on the UI and prompt users to re-search on expiry."
export const SEARCH_SESSION_MS = 15 * 60 * 1000;
