// PAN validation, as far as it can honestly go without the tax department.
//
// A PAN is ten characters: AAAAA9999A. The fourth and fifth are not arbitrary,
// which is what makes this worth more than a shape check:
//
//   chars 1-3  alphabetic series
//   char  4    entity type - P for an individual, C company, H HUF, and so on
//   char  5    first letter of the holder's surname (for an individual)
//   chars 6-9  serial number
//   char  10   a checksum letter
//
// We can check the format, that the entity type is real, and - for an
// individual - that the surname initial matches the traveller we are booking
// for. We cannot check that the PAN exists: that needs the Income Tax
// Department's verification API, which is a registered, paid integration.
//
// Worth being strict about, because TripJack does not reject a wrong PAN. It
// moves the booking to a Pending state and returns no error, so anything not
// caught here surfaces as a traveller who has paid and holds no ticket.

const PAN_SHAPE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// The fourth character. Anything outside this set cannot be a real PAN.
const ENTITY_TYPES = {
  P: 'an individual',
  C: 'a company',
  H: 'a Hindu Undivided Family',
  F: 'a firm',
  A: 'an association of persons',
  T: 'a trust',
  B: 'a body of individuals',
  L: 'a local authority',
  J: 'an artificial juridical person',
  G: 'a government body',
};

export const normalisePan = (value) => String(value || '').trim().toUpperCase().replace(/\s/g, '');

/**
 * Returns null when the PAN is acceptable, or a human-readable reason when it
 * is not. `surname` is optional - when given, an individual's PAN is checked
 * against it, which catches both typos and one traveller's PAN entered against
 * another's name. Company and trust PANs pass: corporate travel is real, and
 * only an individual's PAN encodes a surname in the fifth position.
 */
export const validatePan = (value, surname = '') => {
  const pan = normalisePan(value);

  if (!pan) return 'PAN is required.';
  if (pan.length !== 10) return 'PAN must be exactly 10 characters, e.g. ABCDE1234F.';
  if (!PAN_SHAPE.test(pan)) return 'PAN must be five letters, four digits, then a letter, e.g. ABCDE1234F.';

  const entityType = pan[3];
  if (!ENTITY_TYPES[entityType]) {
    return `The 4th character of a PAN says whose it is, and "${entityType}" is not one of them. Check it has been typed correctly.`;
  }

  // Only individuals carry a surname initial in the fifth position, so this is
  // the only case where it can be checked.
  if (entityType === 'P' && surname) {
    const initial = String(surname).trim().toUpperCase()[0];
    if (initial && /[A-Z]/.test(initial) && pan[4] !== initial) {
      return `This PAN belongs to a surname starting with "${pan[4]}", but the traveller's is "${initial}". Check the PAN matches this traveller.`;
    }
  }

  // Deliberately not rejecting non-individual PANs. A company or trust PAN is
  // legitimate - corporate travel exists - and TripJack's own documented
  // example, XSDTW6829M, is a trust's. An earlier version of this refused it.
  return null;
};
