// HotelBeds' Detail/Rate response includes a paxAmounts[] array per rate -
// one entry per age band (e.g. CHILD 2-12, ADULT 13-999) with the per-unit
// price for that band, independent of how many of each were actually
// searched for (see "Detail Simple and Full Request.txt"). We match each of
// our actual travelers' ages against these bands ourselves to build an
// itemized breakdown - a traveler outside every CHILD band (e.g. a
// 13-year-old on a tour whose child rate tops out at 12) is priced at
// whatever band their age actually falls into, which is often ADULT.
const matchPaxBand = (age, paxAmounts) =>
  (paxAmounts || []).find((band) => age >= (band.ageFrom ?? 0) && age <= (band.ageTo ?? 999)) || null;

export const buildPaxBreakdown = ({ paxAmounts, adults, childAges }) => {
  if (!Array.isArray(paxAmounts) || paxAmounts.length === 0) return null;

  const lines = [];
  let total = 0;

  const adultBand = matchPaxBand(30, paxAmounts);
  const adultsCount = adults || 1;
  if (adultBand) {
    const lineTotal = adultBand.amount * adultsCount;
    total += lineTotal;
    lines.push({
      label: `${adultsCount} Adult${adultsCount === 1 ? '' : 's'}`,
      unitAmount: adultBand.amount,
      lineTotal,
    });
  }

  (childAges || []).forEach((age) => {
    const band = matchPaxBand(age, paxAmounts);
    if (!band) return;
    total += band.amount;
    const isChildBand = (band.paxType || '').toUpperCase().includes('CHILD');
    lines.push({
      label: isChildBand ? `Child (Age ${age})` : `Child (Age ${age}) - priced as adult`,
      unitAmount: band.amount,
      lineTotal: band.amount,
    });
  });

  if (lines.length === 0) return null;
  return { lines, total };
};

// Mirrors the backend's ActivityVoucherService#paxSummary - HotelBeds'
// confirm/booking-detail response uses "AD"/"CH" for paxType (see
// booking confirm.txt), distinct from the confirm REQUEST's "ADULT"/"CHILD".
export const describePaxDistribution = (paxes) => {
  if (!Array.isArray(paxes) || paxes.length === 0) return '';

  let adults = 0;
  let children = 0;
  const childAges = [];

  paxes.forEach((pax) => {
    if ((pax.paxType || '').toUpperCase() === 'CH') {
      children += 1;
      if (pax.age != null) childAges.push(pax.age);
    } else {
      adults += 1;
    }
  });

  let summary = `${adults} Adult${adults === 1 ? '' : 's'}`;
  if (children > 0) {
    summary += `, ${children} Child${children === 1 ? '' : 'ren'}`;
    if (childAges.length > 0) {
      summary += ` (Age${childAges.length === 1 ? '' : 's'}: ${childAges.join(', ')})`;
    }
  }
  return summary;
};

// Mirrors the backend's ActivityVoucherService#contractRemarks.
export const contractRemarks = (comments) => {
  if (!Array.isArray(comments)) return '';
  return comments
    .filter((c) => c.type === 'CONTRACT_REMARKS')
    .map((c) => c.text)
    .filter(Boolean)
    .join('\n');
};

// HotelBeds concatenates distinct remark segments (meeting point, schedule,
// voucher type, restrictions, etc.) into one CONTRACT_REMARKS string using
// "//" as a delimiter - split it back out into readable bullet points
// instead of one dense paragraph. Doesn't drop or reorder any text, just
// re-splits it on the supplier's own delimiter.
export const splitRemarks = (text) => {
  if (!text) return [];
  return text
    .split(/\n|\/\//)
    .map((segment) => segment.trim())
    .filter(Boolean);
};

export const formatCancellationDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};
