// Deterministic parser for package/flyer text pasted by an admin - no AI involved.
// Suppliers usually send the same package details as plain text (WhatsApp/email)
// alongside a flyer image, so this lets the admin paste that text and have it
// split into fields instead of retyping everything by hand. Anything it can't
// confidently recognize is left out of the returned object so the caller can
// skip merging that field rather than overwriting good data with a bad guess.

const DAY_RE = /^day\s*(\d+)\s*[:.\-–—]?\s*(.*)$/i;

const HEADER_RE = {
  highlights: /^(?:highlights?|key highlights?)\s*:?\s*(.*)$/i,
  inclusions: /^(?:inclusions?|inclusion|what'?s included|includes)\s*:?\s*(.*)$/i,
  exclusions: /^(?:exclusions?|exclusion|excludes|not included)\s*:?\s*(.*)$/i,
};

const LABEL_RE = {
  title: /^(?:package(?: name)?|tour(?: name)?|title)\s*:\s*(.+)$/i,
  destination: /^destination\s*:\s*(.+)$/i,
  duration: /^duration\s*:\s*(.+)$/i,
  price: /^price\s*:\s*(.+)$/i,
};

const PRICE_INLINE_RE = /(?:₹|rs\.?|inr)\s?([\d,]+(?:\.\d+)?)/i;
const DURATION_INLINE_RE =
  /(\d+)\s*(?:n\b|nights?)[^\d]{0,5}(\d+)\s*(?:d\b|days?)|(\d+)\s*(?:d\b|days?)[^\d]{0,5}(\d+)\s*(?:n\b|nights?)/i;

const stripBullet = (line) => line.replace(/^[-•*]\s*/, '');

export const parseFlyerText = (rawText) => {
  const lines = (rawText || '').split(/\r?\n/);
  const firstLine = lines.map((l) => l.trim()).find(Boolean);

  let title;
  let destination;
  let duration;
  let price;
  const highlightLines = [];
  const inclusionLines = [];
  const exclusionLines = [];
  const dayBlocks = [];

  let currentDay = null;
  let currentSection = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    const dayMatch = line.match(DAY_RE);
    if (dayMatch) {
      currentSection = null;
      currentDay = { dayNumber: parseInt(dayMatch[1], 10), title: dayMatch[2].trim(), lines: [] };
      dayBlocks.push(currentDay);
      continue;
    }

    let headerMatched = false;
    for (const key of ['highlights', 'inclusions', 'exclusions']) {
      const m = line.match(HEADER_RE[key]);
      if (m) {
        currentDay = null;
        currentSection = key;
        headerMatched = true;
        const rest = m[1] && m[1].trim();
        if (rest) {
          const bucket = key === 'highlights' ? highlightLines : key === 'inclusions' ? inclusionLines : exclusionLines;
          rest.split(/[,•]/).map((s) => s.trim()).filter(Boolean).forEach((item) => bucket.push(item));
        }
        break;
      }
    }
    if (headerMatched) continue;

    let labelMatched = false;
    for (const key of ['title', 'destination', 'duration', 'price']) {
      const m = line.match(LABEL_RE[key]);
      if (m) {
        const value = m[1].trim();
        if (key === 'title') title = value;
        if (key === 'destination') destination = value;
        if (key === 'duration') duration = value;
        if (key === 'price') {
          const priceMatch = value.match(PRICE_INLINE_RE) || value.match(/([\d,]+)/);
          if (priceMatch) price = priceMatch[1].replace(/,/g, '');
        }
        labelMatched = true;
        currentSection = null;
        currentDay = null;
        break;
      }
    }
    if (labelMatched) continue;

    if (currentDay) {
      currentDay.lines.push(line);
      continue;
    }

    if (currentSection === 'highlights') {
      highlightLines.push(stripBullet(line));
      continue;
    }
    if (currentSection === 'inclusions') {
      inclusionLines.push(stripBullet(line));
      continue;
    }
    if (currentSection === 'exclusions') {
      exclusionLines.push(stripBullet(line));
      continue;
    }

    if (price === undefined) {
      const pm = line.match(PRICE_INLINE_RE);
      if (pm) price = pm[1].replace(/,/g, '');
    }
    if (duration === undefined) {
      const dm = line.match(DURATION_INLINE_RE);
      if (dm) {
        if (dm[1] && dm[2]) duration = `${dm[2]} Days / ${dm[1]} Nights`;
        else if (dm[3] && dm[4]) duration = `${dm[3]} Days / ${dm[4]} Nights`;
      }
    }
  }

  if (
    title === undefined &&
    firstLine &&
    firstLine.length <= 80 &&
    !DAY_RE.test(firstLine) &&
    !Object.values(HEADER_RE).some((re) => re.test(firstLine)) &&
    !Object.values(LABEL_RE).some((re) => re.test(firstLine))
  ) {
    title = firstLine;
  }

  return {
    title,
    destination,
    duration,
    price,
    highlights: highlightLines.length ? highlightLines.join('\n') : undefined,
    inclusions: inclusionLines.length ? inclusionLines.join('\n') : undefined,
    exclusions: exclusionLines.length ? exclusionLines.join('\n') : undefined,
    dayPlans: dayBlocks.length
      ? dayBlocks.map((d) => ({ dayNumber: d.dayNumber, title: d.title, activitiesText: d.lines.join('\n') }))
      : undefined,
  };
};

export default parseFlyerText;
