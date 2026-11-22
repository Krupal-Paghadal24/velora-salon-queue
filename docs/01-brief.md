# Velora Salon Queue — Project Brief & Scope

## Problem
Busy salons often manage walk-ins through verbal instructions or paper lists. Customers cannot see their real queue position, staff repeatedly answer “how long?”, and customers with barber preferences can be placed incorrectly. Velora gives customers a clear live queue position while receptionists and barbers manage one shared queue.

## Product goal
Build a responsive, deployed web application that reduces confusion in a single-branch salon. The same queue must stay consistent across a customer's phone, the receptionist's tablet, each barber's phone and a waiting-area TV.

## Users
1. **Customer** — joins remotely or at the salon, chooses services and a barber preference, and tracks their token.
2. **Receptionist** — registers walk-ins, monitors all waiting customers, calls the next compatible customer, and handles cancellations/no-shows.
3. **Barber** — sees only their own current and next compatible customers, starts/finishes service, and changes availability/break status.
4. **Owner/Manager** — configures services, prices, durations, working barbers and salon hours; reviews today's operational summary.

## Must-have features
1. Customer queue entry with name, valid Indian mobile number, one to three services, and a specific barber or “Any available barber”.
2. Token generation, live queue position, estimated wait, and clear Waiting / Called / In Service / Done states.
3. Reception dashboard with barber lanes, ordered waiting list, walk-in registration, Call Next, No-show and Cancel actions.
4. Barber view with current customer, selected services, service timer, Start / Done actions and Available / On Break toggle.
5. TV display showing each barber's current token and the next five waiting tokens, without exposing customer phone numbers.
6. Owner settings for services (English/Gujarati name, duration, price, enabled state), barber duty/availability, opening hours and online-join cutoff.
7. Live synchronization between all open screens, persistent PostgreSQL storage, bilingual English/Gujarati UI, and a deployment-ready README.

## Explicit boundaries — do NOT build
- Online payments, billing, invoices or POS.
- Future-date appointments or calendar booking.
- SMS, WhatsApp or paid notification integrations.
- Loyalty points, reviews, customer accounts or marketing campaigns.
- Multiple branches, staff payroll or inventory.
- AI recommendations or chatbot features.
- GPS tracking or background location.
- A public staff PIN embedded in frontend source code.

## Product assumptions for the first version
- Single salon branch, one local timezone: Asia/Kolkata.
- Currency: INR (₹).
- Default opening hours and service catalogue are editable in Owner Settings.
- Demo salon name is “Velora Salon”; it can be renamed from one configuration location.
- Customer queue joining does not require account creation. A customer receives a private tracking URL and should keep it.
- Staff screens require server-verified staff authentication. Demo credentials, if created, must be seeded securely and documented as demo-only.
- “Any available barber” means the earliest compatible queue entry can be assigned to the barber who is available first; a specific barber preference must never be overridden.

## Look and feel
A premium, calm salon identity: warm ivory background, deep forest-green structure, muted sage queue states and restrained copper accents. Elegant typography, generous whitespace, crisp cards, refined micro-interactions and mobile-first usability.
