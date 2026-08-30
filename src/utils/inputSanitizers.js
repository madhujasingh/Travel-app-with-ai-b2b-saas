// keyboardType="numeric"/"number-pad" is only a soft keyboard hint - it
// doesn't block pasted text or, on some Android keyboards, switching to
// alphabetic input. These strip disallowed characters at the point of
// input so a numeric-intended field can never actually hold letters.
export const digitsOnly = (value) => (value || '').replace(/[^0-9]/g, '');

// Allows a single decimal point (for prices/ratings) - a second "." typed
// or pasted is dropped rather than accepted.
export const decimalOnly = (value) => {
  const cleaned = (value || '').replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
};

// Phone fields allow one leading "+" (country code) plus digits.
export const phoneDigits = (value) => {
  const cleaned = (value || '').replace(/[^0-9+]/g, '');
  return cleaned.replace(/(?!^)\+/g, '');
};
