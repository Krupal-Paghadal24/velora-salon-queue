-- 002_seed_demo_data.sql
-- Idempotent Demo Seed Data for Velora Salon Queue

-- 1. Default Salon Settings
INSERT INTO salon_settings (
  id, salon_name, timezone, opening_time, closing_time, online_cutoff_minutes, is_online_joining_enabled, address_line, contact_phone
) VALUES (
  1, 'Velora Salon', 'Asia/Kolkata', '09:00:00', '21:00:00', 30, true, 'Shop 4, Heritage Arcade, C.G. Road, Ahmedabad', '+91 98765 43210'
) ON CONFLICT (id) DO NOTHING;

-- 2. Services Catalogue (Authentic Indian salon services with English & Gujarati names)
INSERT INTO services (id, name_en, name_gu, duration_minutes, price_inr, is_enabled, sort_order)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'Haircut & Styling', 'વાળ કાપવા અને સ્ટાઇલ', 30, 350.00, true, 1),
  ('11111111-1111-1111-1111-111111111102', 'Beard Trim & Shaping', 'દાઢી ટ્રીમ અને આકાર', 20, 200.00, true, 2),
  ('11111111-1111-1111-1111-111111111103', 'Royal Hot Towel Shave', 'રોયલ હોટ ટુવાલ શેવ', 25, 250.00, true, 3),
  ('11111111-1111-1111-1111-111111111104', 'Hair Spa & Scalp Therapy', 'હેર સ્પા અને સ્કેલ્પ થેરાપી', 45, 800.00, true, 4),
  ('11111111-1111-1111-1111-111111111105', 'Herbal Facial & De-Tan', 'હર્બલ ફેશિયલ અને ડી-ટેન', 45, 950.00, true, 5),
  ('11111111-1111-1111-1111-111111111106', 'Ayurvedic Head Massage', 'આયુર્વેદિક હેડ મસાજ', 20, 250.00, true, 6)
ON CONFLICT (id) DO NOTHING;

-- 3. Barbers (Realistic Indian names)
INSERT INTO barbers (id, name, speciality, is_on_duty, status)
VALUES
  ('22222222-2222-2222-2222-222222222201', 'Aarav Patel', 'Classic Fades & Styling', true, 'AVAILABLE'),
  ('22222222-2222-2222-2222-222222222202', 'Rohan Sharma', 'Beard Sculpting & Royal Shave', true, 'AVAILABLE'),
  ('22222222-2222-2222-2222-222222222203', 'Vikram Dave', 'Hair Spa & Grooming', true, 'ON_BREAK'),
  ('22222222-2222-2222-2222-222222222204', 'Kabir Mehta', 'Creative Cuts & Colour', true, 'AVAILABLE')
ON CONFLICT (id) DO NOTHING;

-- 4. Staff Users (Demo credentials: password is "demo123" for all demo users)
-- Password hash: velorademosalt1234:21ba4cfa079d875da8e8256744186e6bea2af4425d4db599886a0101ea0fd1645f1fea440406491d941e109541eb6f1504cb5e87114e98335fd6d91264b5b655
INSERT INTO staff_users (id, username, password_hash, full_name, role, barber_id)
VALUES
  ('33333333-3333-3333-3333-333333333301', 'owner', 'velorademosalt1234:21ba4cfa079d875da8e8256744186e6bea2af4425d4db599886a0101ea0fd1645f1fea440406491d941e109541eb6f1504cb5e87114e98335fd6d91264b5b655', 'Bhavin Shah (Owner)', 'OWNER', NULL),
  ('33333333-3333-3333-3333-333333333302', 'reception', 'velorademosalt1234:21ba4cfa079d875da8e8256744186e6bea2af4425d4db599886a0101ea0fd1645f1fea440406491d941e109541eb6f1504cb5e87114e98335fd6d91264b5b655', 'Priya Joshi (Reception)', 'RECEPTIONIST', NULL),
  ('33333333-3333-3333-3333-333333333303', 'aarav', 'velorademosalt1234:21ba4cfa079d875da8e8256744186e6bea2af4425d4db599886a0101ea0fd1645f1fea440406491d941e109541eb6f1504cb5e87114e98335fd6d91264b5b655', 'Aarav Patel', 'BARBER', '22222222-2222-2222-2222-222222222201'),
  ('33333333-3333-3333-3333-333333333304', 'rohan', 'velorademosalt1234:21ba4cfa079d875da8e8256744186e6bea2af4425d4db599886a0101ea0fd1645f1fea440406491d941e109541eb6f1504cb5e87114e98335fd6d91264b5b655', 'Rohan Sharma', 'BARBER', '22222222-2222-2222-2222-222222222202')
ON CONFLICT (username) DO NOTHING;
