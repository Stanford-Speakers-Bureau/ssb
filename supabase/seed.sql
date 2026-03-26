-- Seed data for local Supabase development

-- Insert test events
INSERT INTO public.events (id, name, capacity, venue, reserved, venue_link, release_date, ticketing_date, start_time_date, doors_open, "desc", img, route, tagline, tickets, live, scanned, scanned_count, latitude, longitude, address, img_version, livestream, hide_ticketing_date, waitlist_chance, referrals_enabled, standby_enabled)
VALUES
  -- 1: Standard upcoming event, ticketing open
  ('00000000-0000-0000-0000-000000000001', 'Speaker: Jane Doe', 100, 'Memorial Auditorium', 10, 'https://maps.google.com', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' - INTERVAL '30 minutes', 'An exciting talk about technology and innovation.', NULL, 'jane-doe', 'Innovation & Beyond', 0, false, 0, 0, 37.4275, -122.1697, '551 Serra Mall, Stanford, CA 94305', 1, NULL, false, 'High', false, false),
  -- 2: Past event (most recent past, 7 days ago)
  ('00000000-0000-0000-0000-000000000002', 'Past Speaker: John Smith', 200, 'Dinkelspiel Auditorium', 20, 'https://maps.google.com', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' - INTERVAL '30 minutes', 'A retrospective on AI in education.', NULL, 'john-smith', 'AI & Education', 50, false, 30, 30, 37.4265, -122.1645, '471 Lagunita Dr, Stanford, CA 94305', 1, NULL, false, NULL, false, false),
  -- 3: Mystery event (release_date 7 days out, name hidden on frontend)
  ('00000000-0000-0000-0000-000000000003', 'Mystery Speaker', 150, 'Bing Concert Hall', 15, 'https://maps.google.com', NOW() + INTERVAL '7 days', NOW() + INTERVAL '9 days', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days' - INTERVAL '30 minutes', 'Mystery event - stay tuned!', NULL, 'mystery-event', NULL, 0, false, 0, 0, 37.4321, -122.1660, '327 Lasuen St, Stanford, CA 94305', 1, NULL, false, NULL, false, false),
  -- 4: Waitlist event (sold out, public capacity filled, 7 days out)
  ('00000000-0000-0000-0000-000000000004', 'Waitlist Speaker: Alice Chen', 50, 'Cemex Auditorium', 10, 'https://maps.google.com', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' - INTERVAL '30 minutes', 'A fascinating discussion on quantum computing and its real-world applications.', NULL, 'alice-chen', 'Quantum Frontiers', 40, false, 0, 0, 37.4300, -122.1640, '655 Knight Way, Stanford, CA 94305', 1, NULL, false, 'Medium', false, false),
  -- 5: Standby event (sold out, doors open in ~2 hours, standby mode on)
  ('00000000-0000-0000-0000-000000000005', 'Standby Speaker: Bob Williams', 30, 'Hewlett Teaching Center', 5, 'https://maps.google.com', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW() + INTERVAL '3 hours', NOW() + INTERVAL '2 hours', 'An intimate fireside chat on startup culture and venture capital.', NULL, 'bob-williams', 'Startup Stories', 25, false, 0, 0, 37.4285, -122.1670, '370 Jane Stanford Way, Stanford, CA 94305', 1, NULL, false, 'Low', false, true),
  -- 6: Past event (oldest, ~60 days ago)
  ('00000000-0000-0000-0000-000000000006', 'Past Speaker: Grace Kim', 120, 'Cemex Auditorium', 10, 'https://maps.google.com', NOW() - INTERVAL '75 days', NOW() - INTERVAL '73 days', NOW() - INTERVAL '60 days', NOW() - INTERVAL '60 days' - INTERVAL '30 minutes', 'How neuroscience is reshaping product design.', NULL, 'grace-kim', 'Neuro & Design', 40, false, 28, 28, 37.4300, -122.1640, '655 Knight Way, Stanford, CA 94305', 1, NULL, false, NULL, false, false),
  -- 0b: Past event (middle, ~30 days ago)
  ('00000000-0000-0000-0000-00000000000b', 'Past Speaker: Marcus Rivera', 150, 'NVIDIA Auditorium', 15, 'https://maps.google.com', NOW() - INTERVAL '45 days', NOW() - INTERVAL '43 days', NOW() - INTERVAL '30 days', NOW() - INTERVAL '30 days' - INTERVAL '30 minutes', 'The economics of open source software.', NULL, 'marcus-rivera', 'Open Source Econ', 45, false, 30, 30, 37.4270, -122.1720, '475 Via Ortega, Stanford, CA 94305', 1, NULL, false, NULL, false, false),
  -- 7: Ticketing soon, date hidden (hide_ticketing_date = true)
  ('00000000-0000-0000-0000-000000000007', 'Speaker: Carol Davis', 120, 'Cubberley Auditorium', 12, 'https://maps.google.com', NOW() - INTERVAL '7 days', NOW() + INTERVAL '3 days', NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days' - INTERVAL '30 minutes', 'Exploring the intersection of art and artificial intelligence.', NULL, 'carol-davis', 'Art Meets AI', 0, false, 0, 0, 37.4240, -122.1680, '485 Lasuen Mall, Stanford, CA 94305', 1, NULL, true, NULL, false, false),
  -- 8: Ticketing date visible (hide_ticketing_date = false)
  ('00000000-0000-0000-0000-000000000008', 'Speaker: Dave Park', 180, 'NVIDIA Auditorium', 18, 'https://maps.google.com', NOW() - INTERVAL '7 days', NOW() + INTERVAL '5 days', NOW() + INTERVAL '28 days', NOW() + INTERVAL '28 days' - INTERVAL '30 minutes', 'The future of sustainable energy and climate tech.', NULL, 'dave-park', 'Climate & Code', 0, false, 0, 0, 37.4270, -122.1720, '475 Via Ortega, Stanford, CA 94305', 1, NULL, false, NULL, false, false),
  -- 9: Live event (doors opened 1 hour ago, event starts now, standby enabled)
  ('00000000-0000-0000-0000-000000000009', 'Live Speaker: Emily Zhang', 80, 'Gates B01', 8, 'https://maps.google.com', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW(), NOW() - INTERVAL '1 hours', 'Breaking down the latest breakthroughs in large language models.', NULL, 'emily-zhang', 'LLMs Unpacked', 35, true, 15, 15, 37.4300, -122.1745, '353 Jane Stanford Way, Stanford, CA 94305', 1, NULL, false, NULL, false, true),
  -- 10: Referrals-enabled event (ticketing open, not sold out)
  ('00000000-0000-0000-0000-00000000000a', 'Speaker: Frank Lee', 250, 'Memorial Church', 25, 'https://maps.google.com', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' - INTERVAL '30 minutes', 'A talk on building communities through technology and storytelling.', NULL, 'frank-lee', 'Community & Code', 20, false, 0, 0, 37.4270, -122.1700, '450 Jane Stanford Way, Stanford, CA 94305', 1, NULL, false, 'High', true, false);

-- =============================================================================
-- SHARED USER POOL across past events for attendance tracking
-- Users reappear across events with varying scan patterns:
--   attendee1-5:   Loyalists   — register for all 3 past events, always show up
--   attendee6-10:  Flakers     — register for all 3, rarely/never show up
--   attendee11-15: Mixed       — register for 2-3, sometimes show
--   attendee16-20: Occasional  — register for 1-2, sometimes show
--   attendee21-25: One-timers  — register for 1 event only
--   attendee26-30: VIPs        — register for 2-3 events as VIP, mostly show
-- =============================================================================

-- ── Event 6 (oldest past, ~60 days ago): 25 tickets, 15 scanned ──
INSERT INTO public.tickets (id, email, event_id, type, name, scanned, scan_time, scan_user, scan_email, created_at)
VALUES
  -- Loyalists (all show)
  ('a0000000-0000-0000-0000-000000000001', 'attendee1@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Alex Chen',       true,  NOW() - INTERVAL '60 days' + INTERVAL '25 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '73 days'),
  ('a0000000-0000-0000-0000-000000000002', 'attendee2@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Brooke Davis',    true,  NOW() - INTERVAL '60 days' + INTERVAL '12 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '73 days'),
  ('a0000000-0000-0000-0000-000000000003', 'attendee3@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Carlos Mendez',   true,  NOW() - INTERVAL '60 days' + INTERVAL '8 minutes',  'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '73 days'),
  ('a0000000-0000-0000-0000-000000000004', 'attendee4@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Diana Patel',     true,  NOW() - INTERVAL '60 days' + INTERVAL '18 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '72 days'),
  ('a0000000-0000-0000-0000-000000000005', 'attendee5@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Ethan Nakamura',  true,  NOW() - INTERVAL '60 days' + INTERVAL '35 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '72 days'),
  -- Flakers (none show)
  ('a0000000-0000-0000-0000-000000000006', 'attendee6@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Fiona Walsh',     false, NULL, NULL, NULL, NOW() - INTERVAL '72 days'),
  ('a0000000-0000-0000-0000-000000000007', 'attendee7@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'George Liu',      false, NULL, NULL, NULL, NOW() - INTERVAL '71 days'),
  ('a0000000-0000-0000-0000-000000000008', 'attendee8@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Hannah Kim',      false, NULL, NULL, NULL, NOW() - INTERVAL '71 days'),
  ('a0000000-0000-0000-0000-000000000009', 'attendee9@stanford.edu',  '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Isaac Okafor',    false, NULL, NULL, NULL, NOW() - INTERVAL '70 days'),
  ('a0000000-0000-0000-0000-000000000010', 'attendee10@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Julia Santos',    false, NULL, NULL, NULL, NOW() - INTERVAL '70 days'),
  -- Mixed (some show)
  ('a0000000-0000-0000-0000-000000000011', 'attendee11@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Kevin Zhao',      true,  NOW() - INTERVAL '60 days' + INTERVAL '5 minutes',  'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '70 days'),
  ('a0000000-0000-0000-0000-000000000012', 'attendee12@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Lily Thompson',   true,  NOW() - INTERVAL '60 days' + INTERVAL '22 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '69 days'),
  ('a0000000-0000-0000-0000-000000000013', 'attendee13@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Miguel Herrera',  false, NULL, NULL, NULL, NOW() - INTERVAL '69 days'),
  ('a0000000-0000-0000-0000-000000000014', 'attendee14@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Nina Johansson',  true,  NOW() - INTERVAL '60 days' + INTERVAL '40 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '68 days'),
  ('a0000000-0000-0000-0000-000000000015', 'attendee15@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Oscar Brown',     false, NULL, NULL, NULL, NOW() - INTERVAL '68 days'),
  -- Occasional (first appearance)
  ('a0000000-0000-0000-0000-000000000016', 'attendee16@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Priya Sharma',    true,  NOW() - INTERVAL '60 days' + INTERVAL '15 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '67 days'),
  ('a0000000-0000-0000-0000-000000000017', 'attendee17@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Quinn Mitchell',  false, NULL, NULL, NULL, NOW() - INTERVAL '67 days'),
  -- One-timers (only event 6)
  ('a0000000-0000-0000-0000-000000000021', 'attendee21@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Uma Kapoor',      true,  NOW() - INTERVAL '60 days' + INTERVAL '10 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '66 days'),
  ('a0000000-0000-0000-0000-000000000022', 'attendee22@stanford.edu', '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Victor Huang',    true,  NOW() - INTERVAL '60 days' + INTERVAL '28 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '66 days'),
  -- VIPs
  ('a0000000-0000-0000-0000-000000000026', 'attendee26@stanford.edu', '00000000-0000-0000-0000-000000000006', 'VIP',      'Zara Williams',   true,  NOW() - INTERVAL '60 days' + INTERVAL '2 minutes',  'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '73 days'),
  ('a0000000-0000-0000-0000-000000000027', 'attendee27@stanford.edu', '00000000-0000-0000-0000-000000000006', 'VIP',      'Aaron Foster',    true,  NOW() - INTERVAL '60 days' + INTERVAL '4 minutes',  'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '73 days'),
  ('a0000000-0000-0000-0000-000000000028', 'attendee28@stanford.edu', '00000000-0000-0000-0000-000000000006', 'VIP',      'Beth Martinez',   true,  NOW() - INTERVAL '60 days' + INTERVAL '6 minutes',  'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '73 days'),
  -- Extra standard (fill)
  ('a0000000-0000-0000-0000-000000000031', 'extra1@stanford.edu',     '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Extra One',       true,  NOW() - INTERVAL '60 days' + INTERVAL '20 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '65 days'),
  ('a0000000-0000-0000-0000-000000000032', 'extra2@stanford.edu',     '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Extra Two',       false, NULL, NULL, NULL, NOW() - INTERVAL '65 days'),
  ('a0000000-0000-0000-0000-000000000033', 'extra3@stanford.edu',     '00000000-0000-0000-0000-000000000006', 'STANDARD', 'Extra Three',     false, NULL, NULL, NULL, NOW() - INTERVAL '64 days');

-- ── Event 0b (middle past, ~30 days ago): 23 tickets, 14 scanned ──
INSERT INTO public.tickets (id, email, event_id, type, name, scanned, scan_time, scan_user, scan_email, created_at)
VALUES
  -- Loyalists (all show)
  ('b0000000-0000-0000-0000-000000000001', 'attendee1@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Alex Chen',       true,  NOW() - INTERVAL '30 days' + INTERVAL '20 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '43 days'),
  ('b0000000-0000-0000-0000-000000000002', 'attendee2@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Brooke Davis',    true,  NOW() - INTERVAL '30 days' + INTERVAL '7 minutes',  'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '43 days'),
  ('b0000000-0000-0000-0000-000000000003', 'attendee3@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Carlos Mendez',   true,  NOW() - INTERVAL '30 days' + INTERVAL '14 minutes', 'Scanner C', 'scannerc@stanford.edu', NOW() - INTERVAL '42 days'),
  ('b0000000-0000-0000-0000-000000000004', 'attendee4@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Diana Patel',     true,  NOW() - INTERVAL '30 days' + INTERVAL '22 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '42 days'),
  ('b0000000-0000-0000-0000-000000000005', 'attendee5@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Ethan Nakamura',  true,  NOW() - INTERVAL '30 days' + INTERVAL '30 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '41 days'),
  -- Flakers (7 shows once as exception, rest don't)
  ('b0000000-0000-0000-0000-000000000006', 'attendee6@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Fiona Walsh',     false, NULL, NULL, NULL, NOW() - INTERVAL '41 days'),
  ('b0000000-0000-0000-0000-000000000007', 'attendee7@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'George Liu',      true,  NOW() - INTERVAL '30 days' + INTERVAL '45 minutes', 'Scanner C', 'scannerc@stanford.edu', NOW() - INTERVAL '40 days'),
  ('b0000000-0000-0000-0000-000000000008', 'attendee8@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Hannah Kim',      false, NULL, NULL, NULL, NOW() - INTERVAL '40 days'),
  ('b0000000-0000-0000-0000-000000000009', 'attendee9@stanford.edu',  '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Isaac Okafor',    false, NULL, NULL, NULL, NOW() - INTERVAL '39 days'),
  ('b0000000-0000-0000-0000-000000000010', 'attendee10@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Julia Santos',    false, NULL, NULL, NULL, NOW() - INTERVAL '39 days'),
  -- Mixed (different pattern from event 6)
  ('b0000000-0000-0000-0000-000000000011', 'attendee11@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Kevin Zhao',      false, NULL, NULL, NULL, NOW() - INTERVAL '38 days'),
  ('b0000000-0000-0000-0000-000000000012', 'attendee12@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Lily Thompson',   false, NULL, NULL, NULL, NOW() - INTERVAL '38 days'),
  ('b0000000-0000-0000-0000-000000000013', 'attendee13@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Miguel Herrera',  true,  NOW() - INTERVAL '30 days' + INTERVAL '18 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '37 days'),
  ('b0000000-0000-0000-0000-000000000014', 'attendee14@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Nina Johansson',  false, NULL, NULL, NULL, NOW() - INTERVAL '37 days'),
  ('b0000000-0000-0000-0000-000000000015', 'attendee15@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Oscar Brown',     true,  NOW() - INTERVAL '30 days' + INTERVAL '35 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '36 days'),
  -- Occasional (returning)
  ('b0000000-0000-0000-0000-000000000018', 'attendee18@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Rachel Green',    true,  NOW() - INTERVAL '30 days' + INTERVAL '12 minutes', 'Scanner C', 'scannerc@stanford.edu', NOW() - INTERVAL '36 days'),
  ('b0000000-0000-0000-0000-000000000019', 'attendee19@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Sam Taylor',      false, NULL, NULL, NULL, NOW() - INTERVAL '35 days'),
  -- One-timers (only event 0b)
  ('b0000000-0000-0000-0000-000000000023', 'attendee23@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Wade Cooper',     true,  NOW() - INTERVAL '30 days' + INTERVAL '9 minutes',  'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '34 days'),
  ('b0000000-0000-0000-0000-000000000024', 'attendee24@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'STANDARD', 'Xena Park',       false, NULL, NULL, NULL, NOW() - INTERVAL '34 days'),
  -- VIPs (returning)
  ('b0000000-0000-0000-0000-000000000026', 'attendee26@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'VIP',      'Zara Williams',   true,  NOW() - INTERVAL '30 days' + INTERVAL '3 minutes',  'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '43 days'),
  ('b0000000-0000-0000-0000-000000000027', 'attendee27@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'VIP',      'Aaron Foster',    true,  NOW() - INTERVAL '30 days' + INTERVAL '5 minutes',  'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '43 days'),
  ('b0000000-0000-0000-0000-000000000029', 'attendee29@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'VIP',      'Chris Donovan',   false, NULL, NULL, NULL, NOW() - INTERVAL '42 days'),
  ('b0000000-0000-0000-0000-000000000030', 'attendee30@stanford.edu', '00000000-0000-0000-0000-00000000000b', 'EXTERNAL', 'Dana Morgan',     true,  NOW() - INTERVAL '30 days' + INTERVAL '1 minutes',  'Scanner C', 'scannerc@stanford.edu', NOW() - INTERVAL '43 days');

-- ── Event 2 (most recent past, ~7 days ago): 25 tickets, 15 scanned ──
INSERT INTO public.tickets (id, email, event_id, type, name, scanned, scan_time, scan_user, scan_email, created_at, referral)
VALUES
  -- Loyalists (all show)
  ('c0000000-0000-0000-0000-000000000001', 'attendee1@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Alex Chen',       true,  NOW() - INTERVAL '7 days' + INTERVAL '15 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '28 days', NULL),
  ('c0000000-0000-0000-0000-000000000002', 'attendee2@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Brooke Davis',    true,  NOW() - INTERVAL '7 days' + INTERVAL '8 minutes',  'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '28 days', 'abc123'),
  ('c0000000-0000-0000-0000-000000000003', 'attendee3@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Carlos Mendez',   true,  NOW() - INTERVAL '7 days' + INTERVAL '20 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '27 days', NULL),
  ('c0000000-0000-0000-0000-000000000004', 'attendee4@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Diana Patel',     true,  NOW() - INTERVAL '7 days' + INTERVAL '25 minutes', 'Scanner C', 'scannerc@stanford.edu', NOW() - INTERVAL '27 days', 'abc123'),
  ('c0000000-0000-0000-0000-000000000005', 'attendee5@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Ethan Nakamura',  true,  NOW() - INTERVAL '7 days' + INTERVAL '32 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '26 days', NULL),
  -- Flakers (none show)
  ('c0000000-0000-0000-0000-000000000006', 'attendee6@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Fiona Walsh',     false, NULL, NULL, NULL, NOW() - INTERVAL '26 days', 'def456'),
  ('c0000000-0000-0000-0000-000000000007', 'attendee7@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'George Liu',      false, NULL, NULL, NULL, NOW() - INTERVAL '25 days', NULL),
  ('c0000000-0000-0000-0000-000000000008', 'attendee8@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Hannah Kim',      false, NULL, NULL, NULL, NOW() - INTERVAL '25 days', NULL),
  ('c0000000-0000-0000-0000-000000000009', 'attendee9@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Isaac Okafor',    false, NULL, NULL, NULL, NOW() - INTERVAL '24 days', 'def456'),
  ('c0000000-0000-0000-0000-000000000010', 'attendee10@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Julia Santos',    false, NULL, NULL, NULL, NOW() - INTERVAL '24 days', NULL),
  -- Mixed (some show in event 2)
  ('c0000000-0000-0000-0000-000000000011', 'attendee11@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Kevin Zhao',      true,  NOW() - INTERVAL '7 days' + INTERVAL '10 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '23 days', NULL),
  ('c0000000-0000-0000-0000-000000000012', 'attendee12@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Lily Thompson',   true,  NOW() - INTERVAL '7 days' + INTERVAL '18 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '23 days', 'abc123'),
  ('c0000000-0000-0000-0000-000000000013', 'attendee13@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Miguel Herrera',  false, NULL, NULL, NULL, NOW() - INTERVAL '22 days', NULL),
  ('c0000000-0000-0000-0000-000000000014', 'attendee14@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Nina Johansson',  true,  NOW() - INTERVAL '7 days' + INTERVAL '38 minutes', 'Scanner C', 'scannerc@stanford.edu', NOW() - INTERVAL '22 days', NULL),
  ('c0000000-0000-0000-0000-000000000015', 'attendee15@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Oscar Brown',     false, NULL, NULL, NULL, NOW() - INTERVAL '21 days', 'def456'),
  -- Newcomers to event 2
  ('c0000000-0000-0000-0000-000000000020', 'attendee20@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Tyler Adams',     true,  NOW() - INTERVAL '7 days' + INTERVAL '12 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '20 days', NULL),
  ('c0000000-0000-0000-0000-000000000025', 'attendee25@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Yuki Tanaka',     false, NULL, NULL, NULL, NOW() - INTERVAL '19 days', NULL),
  -- VIPs (returning)
  ('c0000000-0000-0000-0000-000000000026', 'attendee26@stanford.edu', '00000000-0000-0000-0000-000000000002', 'VIP',      'Zara Williams',   true,  NOW() - INTERVAL '7 days' + INTERVAL '2 minutes',  'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '28 days', NULL),
  ('c0000000-0000-0000-0000-000000000027', 'attendee27@stanford.edu', '00000000-0000-0000-0000-000000000002', 'VIP',      'Aaron Foster',    false, NULL, NULL, NULL, NOW() - INTERVAL '28 days', NULL),
  ('c0000000-0000-0000-0000-000000000028', 'attendee28@stanford.edu', '00000000-0000-0000-0000-000000000002', 'VIP',      'Beth Martinez',   true,  NOW() - INTERVAL '7 days' + INTERVAL '5 minutes',  'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '28 days', NULL),
  -- Referral tickets (show)
  ('c0000000-0000-0000-0000-000000000041', 'referred1@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Referred One',    true,  NOW() - INTERVAL '7 days' + INTERVAL '16 minutes', 'Scanner C', 'scannerc@stanford.edu', NOW() - INTERVAL '20 days', 'abc123'),
  ('c0000000-0000-0000-0000-000000000042', 'referred2@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Referred Two',    true,  NOW() - INTERVAL '7 days' + INTERVAL '22 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '19 days', 'abc123'),
  -- Referral tickets (no-show)
  ('c0000000-0000-0000-0000-000000000043', 'referred3@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Referred Three',  false, NULL, NULL, NULL, NOW() - INTERVAL '18 days', 'def456'),
  ('c0000000-0000-0000-0000-000000000044', 'referred4@stanford.edu',  '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Referred Four',   false, NULL, NULL, NULL, NOW() - INTERVAL '17 days', 'def456');

-- ── Event 4 (waitlist, future): 40 STANDARD to fill capacity ──
INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'user' || n || '@stanford.edu',
  '00000000-0000-0000-0000-000000000004',
  'STANDARD',
  'User ' || n,
  false
FROM generate_series(100, 139) AS n;

-- ── Event 5 (standby, future): 25 STANDARD + 2 STANDBY ──
INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'user' || n || '@stanford.edu',
  '00000000-0000-0000-0000-000000000005',
  'STANDARD',
  'User ' || n,
  false
FROM generate_series(200, 224) AS n;

INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
VALUES
  ('10000000-0000-0000-0000-000000000250', 'standby1@stanford.edu', '00000000-0000-0000-0000-000000000005', 'STANDBY', 'Standby User One', false),
  ('10000000-0000-0000-0000-000000000251', 'standby2@stanford.edu', '00000000-0000-0000-0000-000000000005', 'STANDBY', 'Standby User Two', false);

-- ── Event 9 (live): reuse some shared users + unique users ──
-- Shared users who also attend the live event
INSERT INTO public.tickets (id, email, event_id, type, name, scanned, scan_time, scan_user, scan_email, created_at)
VALUES
  ('d0000000-0000-0000-0000-000000000001', 'attendee1@stanford.edu',  '00000000-0000-0000-0000-000000000009', 'STANDARD', 'Alex Chen',       true,  NOW() - INTERVAL '30 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '12 days'),
  ('d0000000-0000-0000-0000-000000000002', 'attendee2@stanford.edu',  '00000000-0000-0000-0000-000000000009', 'STANDARD', 'Brooke Davis',    true,  NOW() - INTERVAL '25 minutes', 'Scanner B', 'scannerb@stanford.edu', NOW() - INTERVAL '12 days'),
  ('d0000000-0000-0000-0000-000000000003', 'attendee3@stanford.edu',  '00000000-0000-0000-0000-000000000009', 'STANDARD', 'Carlos Mendez',   true,  NOW() - INTERVAL '20 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '11 days'),
  ('d0000000-0000-0000-0000-000000000006', 'attendee6@stanford.edu',  '00000000-0000-0000-0000-000000000009', 'STANDARD', 'Fiona Walsh',     false, NULL, NULL, NULL, NOW() - INTERVAL '11 days'),
  ('d0000000-0000-0000-0000-000000000011', 'attendee11@stanford.edu', '00000000-0000-0000-0000-000000000009', 'STANDARD', 'Kevin Zhao',      true,  NOW() - INTERVAL '15 minutes', 'Scanner C', 'scannerc@stanford.edu', NOW() - INTERVAL '10 days'),
  ('d0000000-0000-0000-0000-000000000026', 'attendee26@stanford.edu', '00000000-0000-0000-0000-000000000009', 'VIP',      'Zara Williams',   true,  NOW() - INTERVAL '35 minutes', 'Scanner A', 'scannera@stanford.edu', NOW() - INTERVAL '12 days');

-- Additional unique live event tickets
INSERT INTO public.tickets (id, email, event_id, type, name, scanned, scan_time, scan_user, scan_email, created_at)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'user' || n || '@stanford.edu',
  '00000000-0000-0000-0000-000000000009',
  'STANDARD',
  'User ' || n,
  n <= 315,
  CASE WHEN n <= 315 THEN NOW() - INTERVAL '1 hours' + (n - 300) * INTERVAL '3 minutes' ELSE NULL END,
  CASE WHEN n <= 315 THEN CASE WHEN n % 3 = 0 THEN 'Scanner A' WHEN n % 3 = 1 THEN 'Scanner B' ELSE 'Scanner C' END ELSE NULL END,
  CASE WHEN n <= 315 THEN CASE WHEN n % 3 = 0 THEN 'scannera@stanford.edu' WHEN n % 3 = 1 THEN 'scannerb@stanford.edu' ELSE 'scannerc@stanford.edu' END ELSE NULL END,
  NOW() - INTERVAL '12 days' + (n - 300) * INTERVAL '2 hours'
FROM generate_series(300, 329) AS n;

-- Standby tickets for live event
INSERT INTO public.tickets (id, email, event_id, type, name, scanned, scan_time, scan_user, scan_email)
VALUES
  ('10000000-0000-0000-0000-000000000340', 'standby-live1@stanford.edu', '00000000-0000-0000-0000-000000000009', 'STANDBY', 'Standby Live One',   true,  NOW() - INTERVAL '10 minutes', 'Scanner C', 'scannerc@stanford.edu'),
  ('10000000-0000-0000-0000-000000000341', 'standby-live2@stanford.edu', '00000000-0000-0000-0000-000000000009', 'STANDBY', 'Standby Live Two',   true,  NOW() - INTERVAL '8 minutes',  'Scanner A', 'scannera@stanford.edu'),
  ('10000000-0000-0000-0000-000000000342', 'standby-live3@stanford.edu', '00000000-0000-0000-0000-000000000009', 'STANDBY', 'Standby Live Three', false, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000343', 'standby-live4@stanford.edu', '00000000-0000-0000-0000-000000000009', 'STANDBY', 'Standby Live Four',  false, NULL, NULL, NULL),
  ('10000000-0000-0000-0000-000000000344', 'standby-live5@stanford.edu', '00000000-0000-0000-0000-000000000009', 'STANDBY', 'Standby Live Five',  false, NULL, NULL, NULL);

-- ── Event 10 (referrals, future): reuse some shared users + unique ──
INSERT INTO public.tickets (id, email, event_id, type, name, scanned, referral)
VALUES
  ('e0000000-0000-0000-0000-000000000001', 'attendee1@stanford.edu',  '00000000-0000-0000-0000-00000000000a', 'STANDARD', 'Alex Chen',      false, 'ref001'),
  ('e0000000-0000-0000-0000-000000000002', 'attendee2@stanford.edu',  '00000000-0000-0000-0000-00000000000a', 'STANDARD', 'Brooke Davis',   false, NULL),
  ('e0000000-0000-0000-0000-000000000004', 'attendee4@stanford.edu',  '00000000-0000-0000-0000-00000000000a', 'STANDARD', 'Diana Patel',    false, 'ref001'),
  ('e0000000-0000-0000-0000-000000000006', 'attendee6@stanford.edu',  '00000000-0000-0000-0000-00000000000a', 'STANDARD', 'Fiona Walsh',    false, NULL),
  ('e0000000-0000-0000-0000-000000000026', 'attendee26@stanford.edu', '00000000-0000-0000-0000-00000000000a', 'VIP',      'Zara Williams',  false, 'ref002');

INSERT INTO public.tickets (id, email, event_id, type, name, scanned, referral)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'user' || n || '@stanford.edu',
  '00000000-0000-0000-0000-00000000000a',
  'STANDARD',
  'User ' || n,
  false,
  CASE WHEN n % 3 = 0 THEN 'ref001' WHEN n % 3 = 1 THEN 'ref002' ELSE NULL END
FROM generate_series(400, 414) AS n;

-- Waitlist entries for waitlist event (event 4) only — no waitlist for standby events
INSERT INTO public.waitlist (event_id, email, name, position)
VALUES
  ('00000000-0000-0000-0000-000000000004', 'waitlist1@stanford.edu', 'Waitlist User One', 1),
  ('00000000-0000-0000-0000-000000000004', 'waitlist2@stanford.edu', 'Waitlist User Two', 2),
  ('00000000-0000-0000-0000-000000000004', 'waitlist3@stanford.edu', 'Waitlist User Three', 3);

-- Insert test suggestions
INSERT INTO public.suggest (id, email, speaker, approved, votes, reviewed, duplicate)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'testuser1@stanford.edu', 'Elon Musk', true, 5, true, false),
  ('20000000-0000-0000-0000-000000000002', 'testuser2@stanford.edu', 'Tim Cook', false, 3, false, false),
  ('20000000-0000-0000-0000-000000000003', 'testuser1@stanford.edu', 'Satya Nadella', false, 1, false, false);

-- Insert test votes
INSERT INTO public.votes (email, speaker_id)
VALUES
  ('testuser1@stanford.edu', '20000000-0000-0000-0000-000000000001'),
  ('testuser2@stanford.edu', '20000000-0000-0000-0000-000000000001'),
  ('testuser3@stanford.edu', '20000000-0000-0000-0000-000000000001'),
  ('testuser4@stanford.edu', '20000000-0000-0000-0000-000000000001'),
  ('testuser5@stanford.edu', '20000000-0000-0000-0000-000000000001'),
  ('testuser1@stanford.edu', '20000000-0000-0000-0000-000000000002'),
  ('testuser2@stanford.edu', '20000000-0000-0000-0000-000000000002'),
  ('testuser3@stanford.edu', '20000000-0000-0000-0000-000000000002');

-- Insert test roles (admin and scanner)
INSERT INTO public.roles (email, roles)
VALUES
  ('test@stanford.edu', 'admin'),
  ('scanner@stanford.edu', 'scanner'),
  ('both@stanford.edu', 'admin,scanner');

-- Sync referral counts (trigger auto-creates rows, just fix counts)
UPDATE public.referrals r SET
  count = (SELECT count(*)::int FROM public.tickets t WHERE t.event_id = r.event_id AND t.referral = r.referral_code);

-- Insert test notify entries
INSERT INTO public.notify (email, speaker_id)
VALUES
  ('testuser1@stanford.edu', '00000000-0000-0000-0000-000000000001'),
  ('testuser2@stanford.edu', '00000000-0000-0000-0000-000000000001'),
  ('testuser1@stanford.edu', '00000000-0000-0000-0000-000000000007'),
  ('testuser2@stanford.edu', '00000000-0000-0000-0000-000000000008');
