# TripSafe + Cabs — full issue log

Everything hit while building and certifying the two new TripJack products.
Split into **fixed on our side** and **still pending** (needs TripJack).

---

## CABS

### Fixed — our bugs

| # | Error / symptom | Root cause | Fix |
|---|---|---|---|
| 1 | `400 "Agent id is mandatory"` on Book | Doc showed `"agentId": xxxxx` as a placeholder; it's the account's own numeric User Id, not customer data | Injected server-side in `CabsService.book()` from `TRIPJACK_CABS_AGENT_ID` |
| 2 | `500` — "Cannot read field intCompact because parameter1 is null" | `pricingInfo.tjTaxAmount` / `tjManagementFee` are required but absent from the doc's plain Booking sample (only in the Embedded one) | Always send both |
| 3 | Book rejected: "Expected net amount is X, Expected Gross amount is X+tax" | `fareBreakup.totalFare` is the **pre-tax net**, despite the name | Payable = `totalFare + totalTax`; fixed in the payload *and* every price shown to the customer |
| 4 | Cancel button vanished after Refresh Status | Code required an exact `PAYMENT_SUCCESS` string; Cabs' status vocabulary is undocumented | Show Cancel for anything not `CANCELLED`/`FAILED` |
| 5 | A `FAILED` booking rendered a green "Cab Booked" success screen | Only `CANCELLED` was ever checked | Distinct red failed state |
| 6 | Cab bookings never appeared in Profile → Bookings | No persistence layer existed (unlike flights/activities) | Added `CabBooking` entity/service/controller + sync |
| 7 | **100% of round-trip payments failed** — "Net Payable Amount is \<double\>" | A round trip creates **two bookings**; Book's `totalPrice` reports only **one leg** | Call `GET /cabs/v1/payment/summary/{bookingId}` for the authoritative `amountPayable` |
| 8 | Embedded Book would have failed on `agentId` | Embedded needs `agentId` *inside* each `bookingRequestList[]` entry, not top-level | `withAgentIdInEmbeddedList()` |

### Field-name traps confirmed live (2026-09-08)

- **Quotes takes `pickupDate` as `"YYYY-MM-DD HH:MM"`** — not `pickupDateTime`, and not ISO-8601. Sending the Book request's spelling returns `"pickupDate: Pickup date is required"`.
- **Embedded Book returns `data.pickupBookingId`**, where plain Book returns `data.bookingId`. Documented, and `CabBookingScreen.js:209` already reads it correctly — but reading `bookingId` yields `null` and then fails payment with `"The given id must not be null"`.
- **`payment-modes` requires `payUserId`**, not just `bookingId`. It is the only way to read the Cabs wallet balance, and it reports the *same* wallet as `/ums/v1/user-detail` — Cabs is not a separate wallet. An unchanged balance after a cab payment means it was debited and auto-refunded, not that it bills elsewhere.

### Minor — ours

`quoteFilter: {paxCount}` was never sent on the Quotes request (only `passengers`), though the doc's sample sends both. Now sent to match the documented shape — but tested live, it does **not** narrow the results: a 2-passenger search still returns 10-seat Minibuses either way. Capacity filtering is ours to do at display time if we ever want it.

**Field-naming trap worth remembering:** Quotes returns `paxCapacity` (vehicle seating) *and* a per-quote `paxCount`; Book's `quotationInfo.paxCount` is a passthrough of the **quote's** value, not the traveller count. Auditing Book's `paxCount` against the test-case traveller counts produces four false failures — the traveller count lives only in the Quotes request's `passengers`.

### Still pending — TripJack side

| Issue | Detail |
|---|---|
| **Some bookings auto-fail after payment** | 4.1.02, 4.2.02 and the international 4.5 Embedded (DXB pickup) all reached `PAYMENT_SUCCESS`, then flipped to `FAILED` + `REFUND_SUCCESS`. Credit auto-returned each time. **A domestic 4.5 retry (DEL pickup, identical code path) held `SUCCESS` and cancelled cleanly for a full ₹1,423 refund** — so this is route/vendor supply, not our integration. Those three may still not certify as passing. |
| **`payment-summary` and `payment-modes` undocumented** | Both exist in TripJack's Postman collection, neither appears in the 1,400-line PDF. `payment-summary` is *required* for correct round-trip payment. |

---

## TRIPSAFE

### Fixed — our bugs

| # | Error / symptom | Root cause | Fix |
|---|---|---|---|
| 1 | `errCode 1015` "Total amount passed in payment doesn't match" | Sent `amount: 0`. The Review response has **no `isr` wrapper** (unlike Search), so the fare lookup silently found nothing | Read `data.iinfo.pli[0]` for Review |
| 2 | `errCode 2581` "Already order exist with same booking reference" | A reviewed `bookingId` was reused after a screen reset | Detect 2581 and recover the existing booking via Booking-Details |
| 3 | AMT: "difference between ed and sd must be equal to 365 days" | The error text is **wrong** — the real requirement is **364** (matches their own sample's actual calendar span) | `ed = sd + 364` |
| 4 | AMT returned no results with `cd` | AMT's coverage-duration field is **`adr`**, not `cd` (which is Student's) | Use `adr` |
| 5 | AMT still failed after the 364 fix | `addDays()` used `toISOString()`, which converts to UTC and shifted the date back a day in IST | Build the date from local `getFullYear/getMonth/getDate` |
| 6 | AMT: single region returned nothing | "1 Popular Region" means one of the two **region sets** (WW / XUSC), not one code | Send the full set |
| 7 | Embedded search: wrong request shape | Missing `isp: {pht:"REGULAR"}`, only sent destination (needs both countries), `iti` needed the full traveller shape not just `{age}` | All three corrected |
| 8 | Embedded plan list showed "Price unavailable" | Embedded **search** has no `tfd` — pricing is in `pfd.ppd.ppdf` | `extractEmbeddedSearchFare()` |
| 9 | Insurance booking id would have saved as `"[object Object]"` | `ipi` is an **object** `{bid, ifd, sd}`, not an id string | Read `ipi.bid`; prefer the Review response's own `bid` |
| 10 | **Every cancellation returned `REJECTED`, no refund** | The PDF says `type: "INSURANCE_CANCELLATION"` for confirm — **it's wrong**, must be `"CANCELLATION"` on both steps | Corrected; recovered ₹19,477 of "stuck" credit |
| 11 | Multi-traveller cancellations still `REJECTED` | Travellers must be cancelled **one at a time**; all-at-once fails. Undocumented anywhere | `submitCancellation` loops per traveller |
| 12 | Customer shown raw "Insufficient Balance" | That's the *agency* wallet — reads as if the customer's card was declined | Friendly `errCode 2001` message; nothing is charged |
| 13 | `TripSafeBookingScreen` showed raw TripJack text for every error | It never used the shared error mapper at all | Routed through `parseTripJackError` |
| 14 | Nearly wrote off scenarios as unaffordable | `ptf` overstated one price by **5.6×** (29,200 vs real 5,200) — and matched exactly for AMT, so it's inconsistent | Never price from `ptf` |
| 15 | Declared 3 scenarios "blocked, needs ₹175,800 top-up" | Budget was built from `ptf`, the field issue 14 had already flagged as unreliable | Re-priced; see 16 |
| 16 | Re-priced from search `pfd.ppd.ppdf` — **and got that wrong too** | `ppdf` is a day-by-day table keyed `1..N`, not one figure. My pricing script sorted the rows and took the cheapest, i.e. the **1-day** price. Read at the key matching the coverage duration it reproduces Review *exactly* — verified on Standalone 11d and 90d, Student `cd=365`, AMT `adr=60`, all to the rupee | Key = `adr` for AMT, `cd` for Student, else inclusive days. Implemented as `TripSafeResultsScreen.coverageDayKey` |
| 17 | TripSafe plan list showed **no prices at all** | `extractFare` only looked for `tfd`/`pfd.ifc`, which exist on Review but never on Search — it returned `null` for every plan on every journey type, so the whole list read "Price on next step". The code comment admitted the shape had never been checked against a live response | Added `extractSearchFare` using the day-key above; verified against 8 saved live responses |
| 18 | Student "3 Years" option always failed | `cd=1095` is rejected even though TripJack's own error lists 1095 as valid | Chip removed from `STUDENT_DURATIONS` until they fix it |
| 19 | Trips over 180 days returned a raw API error | No client-side duration cap | Friendly limit message pointing at Annual Multi-Trip |

### Still pending — TripJack side

| Issue | Detail | Impact |
|---|---|---|
| **TripSafe not enabled on production key** | `403 errCode 412` "API key is invalid" on account 41067728 | **Blocks go-live.** Also blocks Embedded for real customers, since flight + insurance must share one account |
| **Domestic TripSafe unreachable** | Their portal sells "Domestic Gold Plus", but domestic API searches return `errCode 8067`. Zero mentions of "domestic" in the 94-page PDF, the brochure, the coverage sheet, or the Postman collection | Domestic insurance can't be offered |
| **Student `cd=1095` (3 years) rejected** | Error says the value must be "180 or 365 or 730 or 1095" — while rejecting 1095. 180/365/730 all work | Option withdrawn from the app |
| **TC04's region type is wrong** | Specifies `rt:"POPULARREGION"`; Embedded only accepts `rt:"COUNTRY"` | Cosmetic — TC04 **passes** with `COUNTRY` and returns the expected "Classic Super" |
| **Misleading nested cancel status** | On a `REJECTED` confirm, nested travellers still show `"status":"CANCELLED"` and negative `tmr` | Actively misleads integrators (it misled us for two days) |
| **`Modify Review API` undocumented** | Appears in the SLA table and Postman collection; no section in the PDF | Unknown whether we need it |
| **Wallet blocked on face value** | Balance is checked against TF, not the net debit after commission | Budget by face value |
| **Standalone `ed` max is 180 days *inclusive*** | Error says "less than or equal to 180 days"; `sd+180` is rejected, `sd+179` accepted | Same inclusive convention as the `ppdf` day keys |

---

## FLIGHTS (found while working on the above)

| Issue | Status |
|---|---|
| Fare-rule windows shown as raw hours ("6–8760 Hrs") | **Fixed** — now "6 hours – 1 year before departure" |
| Garbled `__nls_____bs__` in fare rules | **Fixed** — leftover template tokens stripped |
| Seat selection gave no price feedback | **Fixed** — toast showing the price impact |
| Section tabs clipped at the top | **Fixed** — explicit height |
| Raw "Keys Passed in the request is already expired" | **Fixed** — friendly message + "Search Again" |
| "Free Meal" fare still charges for meals | **Not a bug** — `mi: true` = complimentary onboard meal; the SSR menu is a separate paid pre-order. Clarifying note added to the UI |
| UAT flights can't be cancelled | **Environment limitation** — `pnr: "TESTPNR"`, `ticketNumber: null`, so there's nothing to refund. ₹29,166 unrecoverable |

---

## Process lessons

1. **Ask for the vendor's Postman collection on day one.** It resolved in minutes what two days of black-box testing got wrong (the cancellation constant), and revealed two Cabs endpoints the PDF never mentions.
2. **Consistent reproduction ≠ identified cause.** Cancellation was called "definitively broken on TripJack's side" after three reproductions. All three shared the same two client-side mistakes.
3. **Don't "correct" a doc sample's literal values to match its prose.** The AMT sample's 364-day span was right; the surrounding text and the error message were both wrong.
4. **When an error message's stated reason looks wrong, send a deliberately invalid value.** If valid and garbage produce identical errors, the field is being rejected wholesale rather than evaluated.
5. **Re-poll booking status before reporting success.** `PAYMENT_SUCCESS` is not final for Cabs — two "completed" scenarios later auto-failed.
6. **A wrong price is worse than no price, and I produced three in a row** (`ptf`, then the 1-day `ppdf` row, then a mis-scoped comparison) before checking against Review. When a number decides whether work is possible, verify it against the authoritative endpoint *before* drawing conclusions from it — all three wrong figures were internally consistent, and none survived a single Review call.
7. **Isolate vendor failures with a controlled retry.** Three cab bookings auto-failing looked like our integration until the same code path was run against a domestic route and held. One deliberate variation settled what three repetitions of the same case could not.
