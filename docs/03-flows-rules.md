# Flows, Queue Rules & Acceptance Tests

## Main flow: remote customer
1. Customer opens `/`, sees live salon/queue status and enabled services.
2. Customer selects Join Queue, enters name/mobile, selects 1–3 services and a barber or Any.
3. Server validates the request and checks whether the phone already has an active queue entry.
4. If valid, server atomically assigns the next daily token and creates a Waiting entry.
5. Customer receives a private, unguessable tracking URL and sees token, compatible position and estimated wait.
6. Receptionist calls the next compatible customer for a barber.
7. Customer status changes to Called; status page and TV update in real time.
8. Barber starts service; status becomes In Service.
9. Barber finishes; status becomes Done and the queue estimates recalculate.

## Main flow: walk-in
1. Receptionist selects Add Walk-in.
2. Receptionist enters customer name, mobile, services and barber preference.
3. Server applies the same validation and duplicate-phone check as online joining.
4. Walk-in receives a token and is appended to the end of the queue.

## Status model and allowed transitions
- Waiting → Called
- Waiting → Cancelled
- Called → In Service
- Called → No-show
- In Service → Done
- Done, Cancelled and No-show are terminal.
- No backward transitions. Any invalid transition returns a clear 409/400 response and leaves data unchanged.

## Queue ordering and barber compatibility
- First come, first served, based on server-created `joined_at` and a stable sequence tie-breaker.
- For barber X, Call Next selects the earliest Waiting entry where preferred barber is X or preference is Any.
- A customer who selected a specific barber must never be assigned to another barber.
- “Any” may be assigned to the first available barber that can take a customer.
- A barber can have at most one Called/In Service customer at a time; enforce this on the server/database, not only in the UI.
- A barber On Break or Off Duty cannot receive a new customer.
- When a barber goes On Break, do not silently reassign customers who explicitly chose that barber. Show a clear explanation and let reception resolve the case.
- Calls are serialized/transactional so two receptionists cannot call the same customer simultaneously.

## Token rules
- Daily tokens reset to 1 at the start of each salon-local calendar day (Asia/Kolkata).
- Token assignment must be atomic and unique per salon-local date, including simultaneous submissions.
- A cancelled/no-show entry keeps its historical token; a customer re-added later receives a new token at the end.
- Never recycle tokens during the same day.

## Wait-time estimate
- Treat the estimate as approximate, not a guarantee.
- For a specific barber, estimate using the remaining time of their current service plus the total service durations of compatible waiting entries ahead, divided by the number of eligible available barbers only when the customer selected Any.
- For a specific barber, do not divide by all barbers; only that barber's workload matters.
- Round up to whole minutes and never display a negative value.
- If no eligible barber is available or the estimate cannot be computed, show “Wait time unavailable” rather than 0 minutes.
- Recalculate after join, call, start, done, cancellation, no-show, barber availability change and service configuration change.

## Duplicate, cancel and no-show rules
- One active queue entry per normalized mobile number. Active means Waiting, Called or In Service.
- If the same phone tries to join again, return the existing active entry; do not create a duplicate or new token.
- Customer can cancel only while Waiting. Called/In Service cancellation requires receptionist intervention.
- If a customer is Called but has not arrived within 10 minutes, receptionist may mark No-show.
- If a no-show customer later arrives, receptionist creates a new walk-in at the end with a new token.
- A no-show/cancelled/done record remains in history for today's statistics.

## Opening and online joining rules
- Salon open/closed state follows configured Asia/Kolkata opening hours.
- Online joining closes 30 minutes before closing by default; owner may change the cutoff.
- Walk-ins may still be added by reception while online joining is closed, provided the salon is open.
- If salon is closed, prevent both online joining and walk-in creation.
- If no barbers are on duty/available, explain why joining is unavailable rather than accepting a request that cannot be served.

## Real-time and persistence rules
- PostgreSQL is the source of truth. Browser localStorage may hold only non-sensitive UI preferences, never queue records.
- Every successful mutation persists before broadcasting the update.
- Reception, barber, customer tracking and TV screens update within approximately 5 seconds.
- On Socket.IO reconnect, each client refetches authoritative state; do not rely only on missed socket events.
- If live connection is lost, show a visible stale/offline indicator and keep the last known state labelled as potentially outdated.
- Refreshing or restarting the frontend/backend must not erase active queue entries.

## Security and privacy
- Staff mutations require authenticated staff identity and role authorization.
- Do not put secrets, database service-role keys or staff credentials in frontend bundles.
- Customer tracking uses a cryptographically random public ID, not sequential database IDs.
- Public TV display shows tokens only, not names or phone numbers.
- Normalize phone numbers before duplicate checks; mask phone numbers in receptionist list except where role permissions require full detail.

## Acceptance test checklist
- [ ] Valid customer joins with two services; duration and price are correct.
- [ ] Invalid/short Indian mobile number is rejected by both client and server.
- [ ] Same phone attempts to join twice; existing active token is returned and no duplicate row is created.
- [ ] Two simultaneous joins receive different sequential daily tokens.
- [ ] Daily token counter resets using Asia/Kolkata date, not UTC date.
- [ ] Customer can cancel while Waiting; cannot cancel after Called.
- [ ] Call Next for barber X skips earlier customer assigned to another specific barber.
- [ ] Any customer can be assigned to an available barber; specific barber preference is never overridden.
- [ ] Barber cannot receive a second active customer while already serving one.
- [ ] Start and Done enforce forward-only status transitions.
- [ ] Called customer can be marked No-show after 10 minutes; re-added customer gets a new token at queue end.
- [ ] Barber On Break/Off Duty cannot receive new work.
- [ ] Closing online joining disables customer Join while reception can still add walk-ins when salon is open.
- [ ] Disabled service disappears from Join Queue and cannot be submitted through a forged request.
- [ ] Reception, customer status, barber and TV screens update within approximately 5 seconds.
- [ ] Refresh and backend restart preserve active queue records.
- [ ] Socket reconnect causes a fresh state fetch.
- [ ] Gujarati toggle translates all visible labels, errors, statuses and buttons.
- [ ] Customer and staff screens work at phone/tablet/desktop widths; TV layout works at 1920×1080.
- [ ] All visible buttons have working actions; no console errors or failed production build.
