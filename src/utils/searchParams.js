// Encoding for search criteria that travel in the URL.
//
// Results screens used to be handed their data by the search form, which meant
// the URL identified the page but not the search: /hotels/search carried no
// city and no dates, so a refresh or a shared link produced an empty screen.
// Criteria now go in the URL and the results screen fetches from them, so a
// refresh reproduces the search rather than losing it.
//
// Everything here has to survive a round trip through a query string, so the
// shapes are deliberately flat and short - a URL someone might paste to a
// friend should not be a page long.

// Rooms are the awkward one: an array of { adults, children, childAge[] }.
// Encoded as adults-children-age.age, rooms separated by "~":
//   2 adults                      -> "2"
//   2 adults, 1 child aged 5      -> "2-1-5"
//   two rooms                     -> "2~2-1-5"
export const encodeRooms = (rooms = []) =>
  rooms
    .map((room) => {
      const adults = Number(room.adults) || 1;
      const ages = (room.childAge || []).map((age) => Number(age) || 0);
      if (ages.length === 0) return String(adults);
      return `${adults}-${ages.length}-${ages.join('.')}`;
    })
    .join('~');

export const decodeRooms = (encoded) => {
  if (!encoded) return [{ adults: 2 }];
  const rooms = String(encoded)
    .split('~')
    .map((part) => {
      const [adultsRaw, countRaw, agesRaw] = part.split('-');
      const adults = Number(adultsRaw) || 1;
      const count = Number(countRaw) || 0;
      if (count === 0) return { adults };
      const childAge = (agesRaw || '')
        .split('.')
        .map((age) => Number(age) || 0)
        .slice(0, count);
      return { adults, children: childAge.length, childAge };
    })
    .filter(Boolean);
  return rooms.length > 0 ? rooms : [{ adults: 2 }];
};

// Child ages for products that take a flat list rather than per-room rooms.
export const encodeAges = (ages = []) => ages.map((a) => Number(a) || 0).join('.');
export const decodeAges = (encoded) =>
  !encoded ? [] : String(encoded).split('.').map((a) => Number(a) || 0).filter((a) => !Number.isNaN(a));

// route.params arrive as strings when they come from a URL and as real values
// when they come from a navigate() call. These normalise both.
export const asNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

export const asString = (value, fallback = '') =>
  value === undefined || value === null ? fallback : String(value);
