import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import API_CONFIG from '../config/api';

// Markup is what we add on top of a supplier's fare and collect on our own
// payment rail. It is NEVER part of what we send TripJack or HotelBeds - their
// booking calls must carry their exact fare (TripJack errCode 1015, and the
// Cabs "Net Payable Amount is ..." rejection). So everything here is display
// and collection only; the supplier amount is computed separately and untouched.
//
// Mirrors backend MarkupService.markupFor() so the number shown in search
// matches what the server will charge.
const MarkupContext = createContext({
  rules: {},
  markupFor: () => 0,
  sellingPrice: (base) => base,
  ready: false,
});

export const useMarkup = () => useContext(MarkupContext);

const key = (service, category, entityKey) =>
  `${service}|${category || 'DEFAULT'}|${(entityKey || '').toUpperCase()}`;

export const MarkupProvider = ({ token, children }) => {
  const [rules, setRules] = useState({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!token) {
      setRules({});
      setReady(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_CONFIG.BASE_URL}/markup`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;

        const next = {};
        (Array.isArray(data) ? data : []).forEach((rule) => {
          if (rule.active === false) return;
          next[key(rule.service, rule.category, rule.entityKey)] = {
            value: Number(rule.markupValue) || 0,
            unit: rule.markupUnit || 'FLAT_FULL',
          };
        });
        setRules(next);
      } catch {
        // Markup failing to load must never block browsing - prices simply
        // show without it until the next load.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const markupFor = useCallback(
    (service, category, baseAmount, paxCount = 1, entityKey = '') => {
      // Same order the backend resolves in: a specific airline/hotel override
      // beats the category rule, which beats the service-wide default.
      const entity = (entityKey || '').toUpperCase();
      const rule =
        (entity && rules[key(service, category, entity)]) ||
        (entity && rules[key(service, 'DEFAULT', entity)]) ||
        rules[key(service, category, '')] ||
        rules[key(service, 'DEFAULT', '')];
      if (!rule) return 0;

      const base = Number(baseAmount) || 0;
      const pax = Math.max(Number(paxCount) || 1, 1);
      const value = rule.value;

      switch (rule.unit) {
        case 'FLAT_PER_PAX':
          return value * pax;
        case 'PERCENT_FULL':
          return (base * value) / 100;
        case 'PERCENT_PER_PAX':
          return ((base / pax) * value * pax) / 100;
        default:
          return value; // FLAT_FULL
      }
    },
    [rules],
  );

  const sellingPrice = useCallback(
    (service, category, baseAmount, paxCount = 1, entityKey = '') =>
      (Number(baseAmount) || 0) + markupFor(service, category, baseAmount, paxCount, entityKey),
    [markupFor],
  );

  const value = useMemo(
    () => ({ rules, markupFor, sellingPrice, ready }),
    [rules, markupFor, sellingPrice, ready],
  );

  return <MarkupContext.Provider value={value}>{children}</MarkupContext.Provider>;
};

export default MarkupContext;
