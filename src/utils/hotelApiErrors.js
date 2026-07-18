// Friendlier text for TripJack Hotel v3 error codes. Two vocabularies are in
// play: enum-style codes (OPTION_SOLD_OUT, INVALID_DATE_RANGE, ...) from the
// docs' error tables for Search/Review, and short numeric errCode strings
// (e.g. "2520", "2502") actually observed from the Book/Cancel endpoints in
// production - see docu/ for real captured examples of both.
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
  '2520': 'This booking session has expired or was already processed. Please review the option again.',
  '2502': 'This booking has already been placed. Check your bookings before trying again.',
  '401': 'Unable to authenticate with the hotel supplier. Please try again shortly.',
};

// TripJack's own error envelope uses "errCode" (e.g. { "errors": [{ "errCode":
// "2520", "message": "..." }] }), not "code" - confirmed against real
// production responses. Our backend's GlobalExceptionHandler wraps non-2xx
// TripJack responses as { message: "TripJack request failed with status 400:
// {...raw body...}" }, so the raw envelope usually arrives embedded as text
// inside data.message rather than as a nested object - handle both shapes.
export const parseHotelError = (data, fallback) => {
  let code = data?.error?.errCode || data?.errors?.[0]?.errCode;
  let message = data?.error?.message || data?.errors?.[0]?.message;

  if (!code && typeof data?.message === 'string') {
    const codeMatch = data.message.match(/"errCode"\s*:\s*"([^"]+)"/);
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

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Doc's documented Retry Strategy table:
// SUPPLIER_UNAVAILABLE (503) -> exponential backoff 1s/2s/4s, max 3 retries.
// RATE_LIMITED (429) -> wait for the Retry-After header duration.
// Everything else (OPTION_SOLD_OUT, SEARCH_SESSION_EXPIRED, etc.) is not retryable.
const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

// fetch + parse + retry in one call. Resolves with the parsed JSON body on
// success, or throws an Error (with .code/.soldOut/.expired from
// parseHotelError) once retries are exhausted or the error isn't retryable.
export const fetchHotelJson = async (url, options, fallbackMessage) => {
  for (let attempt = 0; ; attempt += 1) {
    const response = await fetch(url, options);
    const data = await response.json();
    if (response.ok) {
      return data;
    }

    const parsed = parseHotelError(data, fallbackMessage);
    const retryable = parsed.code === 'SUPPLIER_UNAVAILABLE' || parsed.code === 'RATE_LIMITED';

    if (retryable && attempt < MAX_RETRIES) {
      const retryAfterHeader = response.headers.get('Retry-After');
      const delayMs =
        parsed.code === 'RATE_LIMITED' && retryAfterHeader
          ? Number(retryAfterHeader) * 1000
          : BACKOFF_MS[attempt];
      await wait(delayMs);
      continue;
    }

    const error = new Error(parsed.message);
    error.code = parsed.code;
    error.soldOut = parsed.soldOut;
    error.expired = parsed.expired;
    throw error;
  }
};
