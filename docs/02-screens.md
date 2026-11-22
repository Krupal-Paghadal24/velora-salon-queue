# Screens & Features

All routes must work on direct refresh and be responsive. Shared navigation must expose only the links appropriate to the current role. All visible labels use the central EN/GU translation dictionary.

## Shared visual system
- Brand: Velora Salon Queue.
- Palette: warm ivory page background, deep forest green for primary text/navigation, sage for positive/available states, amber for attention, muted red for destructive/no-show states, copper for primary action accents.
- Use a refined editorial heading font paired with a highly readable sans-serif body font. Do not sacrifice readability.
- Cards have subtle borders/shadows, medium corner radius and consistent spacing. Avoid excessive gradients, glassmorphism and oversized empty hero sections.
- Show clear focus rings, disabled states, loading skeletons, inline validation and toast feedback.
- Customer mobile layout target: 360–430px. Reception target: tablet landscape. TV target: 1920×1080.

## Screen 1: Home — `/`
**User/purpose:** Customer discovers salon status and joins the queue.
- Header: Velora wordmark, language toggle EN/GU, salon open/closed badge, compact navigation.
- Hero: concise headline such as “Your time matters. Your turn, made clear.” and a primary “Join the Queue” CTA.
- Live queue summary: people waiting, approximate current wait, last-updated indicator.
- Barber availability cards: name, speciality (optional), Available / Busy / On Break. Do not imply a barber is available if their state is stale.
- Service preview cards: service name, duration, price; only enabled services.
- How it works: Choose service → Get token → Track your turn.
- Footer: opening hours, address placeholder configurable in settings, contact placeholder. Do not invent a real address or phone number.
**Actions:** Join CTA navigates to `/join`; language toggle switches all UI labels; staff links are discreet and lead to staff login.
**States:** salon closed, online joining closed, no barbers on duty, no queue, loading and server unavailable.

## Screen 2: Join Queue — `/join`
**User/purpose:** Customer creates one queue entry.
- Step indicator: Your details → Services → Barber → Confirm.
- Fields: full name (required, 2–60 chars), Indian mobile number (required, normalize to +91 + 10 digits).
- Service cards: multi-select, maximum 3; show EN/GU name, duration and price. Disabled services cannot be selected.
- Barber choice: “Any available barber” plus individual on-duty barbers. Show On Break / Unavailable state and disable incompatible choices.
- Live summary: selected services, total service duration, total price, chosen barber preference, approximate wait (clearly labelled estimate).
- Consent note: queue status is shown through the private tracking link; no marketing consent implied.
- Primary button: “Confirm & Get Token”; disabled until valid.
**Actions:** Validate on client and server; submit once; on success create a queue entry and navigate to `/status/:publicId`. If same phone has an active entry, show the existing token and tracking link instead of creating a duplicate.
**States:** no services available, no barber on duty, queue closed, invalid phone, duplicate active phone, server error, submitting state.

## Screen 3: My Status — `/status/:publicId`
**User/purpose:** Customer tracks their own place.
- Large token number and current status pill.
- Position in compatible queue (not a misleading global position), e.g. “2 customers ahead for your selected barber”.
- Estimated wait in minutes with “estimate, may change” note.
- Selected services, total duration, preferred/assigned barber.
- Progress timeline: Waiting → Called → In Service → Done. Cancelled and No-show are terminal outcomes with clear copy.
- When second in line: “Please start making your way to the salon.”
- When Called: prominent “It’s your turn — please go to [barber]” state.
- Cancel button only while Waiting; confirmation dialog required.
**Actions:** live updates through Socket.IO; reconnect triggers refetch. Cancel request is server-validated. Never expose another customer's phone number or private tracking URL.
**States:** loading, invalid/expired link, cancelled, no-show, done, disconnected/reconnecting.

## Screen 4: Reception Dashboard — `/reception`
**User/purpose:** Receptionist controls the shared queue on a tablet.
- Staff top bar: current date/time, salon open state, connection indicator, signed-in staff and logout.
- Summary strip: waiting, in service, completed today, average wait (label as approximate).
- Barber lanes/cards: each barber's status, current token/customer, service elapsed time, next compatible customer, Call Next button.
- Waiting list table: token, customer name, masked phone, services, barber preference, joined time, wait duration, status, actions.
- Add Walk-in button opens a side panel/modal with name, phone, services and barber preference; it joins the same queue at the end.
- Waiting over 60 minutes gets an amber warning; over 90 minutes gets a stronger warning.
- Search by token/name/phone suffix; filters by status and barber.
**Actions:** Call Next for a selected barber; mark Called customer No-show; cancel waiting customer; add walk-in; open customer tracking link (staff-only). Confirm destructive actions. All mutations server-authorized and broadcast to relevant clients.
**States:** no waiting customers, no barber available, stale connection, server error, empty search result.

## Screen 5: Barber View — `/barber/:barberId`
**User/purpose:** Barber manages their own work from a phone.
- Header with barber name, connection status and Available / On Break toggle.
- Current customer card: token, first name, selected services, total expected duration and timer.
- Main action: Start Service when status is Called; Finish Service when In Service.
- “Next for you” card shows the earliest compatible waiting entry without allowing the barber to take an incompatible specific-barber entry.
- Small recent-completed list for today's work.
**Actions:** Start changes Called → In Service; Finish changes In Service → Done. Availability changes are server-validated. A barber cannot start a second customer while already serving one.
**States:** no current customer, on break, disconnected, no next customer.

## Screen 6: Waiting Area TV — `/display`
**User/purpose:** Waiting customers can see whose turn it is from a distance.
- Dedicated full-screen layout, no navigation or controls requiring staff authentication.
- Dark forest-green canvas with high-contrast ivory text and copper accent.
- Main area: one column/card per on-duty barber with barber name, current token (“Now Serving”) or “Available”.
- Secondary area: next five called/waiting tokens in queue order with barber assignment/preference and approximate time.
- Newly called token receives a brief subtle highlight animation; do not use flashing effects that impair accessibility.
- Show salon name, current time and connection status.
- Never display customer full names, phone numbers or tracking URLs.
**Actions:** read-only; updates automatically; reconnect refetches current state.
**States:** no customers waiting, all barbers on break, connection lost.

## Screen 7: Owner Settings — `/admin`
**User/purpose:** Owner/manager configures daily operations.
- Protected staff route with owner/manager authorization.
- Tabs/sections: Services, Barbers & Duty, Salon Hours, Today's Summary.
- Services table: EN name, GU name, duration minutes, price INR, enabled toggle, edit action. Add/edit form validates non-empty names, duration 5–240 minutes, price >= 0.
- Barbers: name, speciality, on-duty toggle, availability/break state. Do not remove a barber with active work; allow off-duty only when no active customer.
- Salon hours: opening/closing time, timezone fixed to Asia/Kolkata, online joining cutoff default 30 minutes before close.
- Today's summary: served count, no-show count, average waiting time, most selected service. Show honest empty states; do not fabricate chart data.
- Queue control: open/close online joining. Closing online joining does not prevent receptionist walk-ins unless salon itself is closed.
**Actions:** save changes with confirmation/feedback; all changes persist and broadcast to customer/reception/barber/TV views.
**States:** unauthorized, validation errors, loading, no data today, save failed.

## Navigation and responsive rules
- Customer: bottom sticky CTA only when useful; no horizontal overflow.
- Reception: table becomes stacked cards on narrow screens; tablet landscape is primary.
- Barber: one-column large controls; buttons reachable with one hand.
- TV: 1920×1080 with large token typography readable from several metres.
- All seven routes must support direct URL entry and refresh. Unknown routes show a useful not-found screen.
