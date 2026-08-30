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
