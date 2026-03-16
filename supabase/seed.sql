-- Seed data for local Supabase development

-- Insert test events
INSERT INTO public.events (id, name, capacity, venue, reserved, venue_link, release_date, ticketing_date, start_time_date, doors_open, "desc", img, route, tagline, tickets, live, scanned, scanned_count, latitude, longitude, address, img_version, livestream, hide_ticketing_date, waitlist_chance, referrals_enabled)
VALUES
  -- 1: Standard upcoming event, ticketing open
  ('00000000-0000-0000-0000-000000000001', 'Test Speaker: Jane Doe', 100, 'Memorial Auditorium', 10, 'https://maps.google.com', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' - INTERVAL '30 minutes', 'An exciting talk about technology and innovation.', NULL, 'jane-doe', 'Innovation & Beyond', 0, false, 0, 0, 37.4275, -122.1697, '551 Serra Mall, Stanford, CA 94305', 1, NULL, false, 'High', false),
  -- 2: Past event
  ('00000000-0000-0000-0000-000000000002', 'Past Speaker: John Smith', 200, 'Dinkelspiel Auditorium', 20, 'https://maps.google.com', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days', NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' - INTERVAL '30 minutes', 'A retrospective on AI in education.', NULL, 'john-smith', 'AI & Education', 50, false, 30, 30, 37.4265, -122.1645, '471 Lagunita Dr, Stanford, CA 94305', 1, NULL, false, NULL, false),
  -- 3: Mystery event (release_date 7 days out, name hidden on frontend)
  ('00000000-0000-0000-0000-000000000003', 'Mystery Speaker', 150, 'Bing Concert Hall', 15, 'https://maps.google.com', NOW() + INTERVAL '7 days', NOW() + INTERVAL '9 days', NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days' - INTERVAL '30 minutes', 'Mystery event - stay tuned!', NULL, 'mystery-event', NULL, 0, false, 0, 0, 37.4321, -122.1660, '327 Lasuen St, Stanford, CA 94305', 1, NULL, false, NULL, false),
  -- 4: Waitlist event (sold out, public capacity filled, 7 days out)
  ('00000000-0000-0000-0000-000000000004', 'Waitlist Speaker: Alice Chen', 50, 'Cemex Auditorium', 10, 'https://maps.google.com', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' - INTERVAL '30 minutes', 'A fascinating discussion on quantum computing and its real-world applications.', NULL, 'alice-chen', 'Quantum Frontiers', 40, false, 0, 0, 37.4300, -122.1640, '655 Knight Way, Stanford, CA 94305', 1, NULL, false, 'Medium', false),
  -- 5: Standby event (sold out, doors open in ~2 hours, within waitlist cutoff)
  ('00000000-0000-0000-0000-000000000005', 'Standby Speaker: Bob Williams', 30, 'Hewlett Teaching Center', 5, 'https://maps.google.com', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW() + INTERVAL '3 hours', NOW() + INTERVAL '2 hours', 'An intimate fireside chat on startup culture and venture capital.', NULL, 'bob-williams', 'Startup Stories', 25, false, 0, 0, 37.4285, -122.1670, '370 Jane Stanford Way, Stanford, CA 94305', 1, NULL, false, 'Low', false),
  -- 6: Full mystery event (release_date far future, not revealed)
  ('00000000-0000-0000-0000-000000000006', 'TBA', 200, 'Frost Amphitheater', 20, 'https://maps.google.com', NOW() + INTERVAL '60 days', NOW() + INTERVAL '62 days', NOW() + INTERVAL '90 days', NOW() + INTERVAL '90 days' - INTERVAL '30 minutes', NULL, NULL, NULL, NULL, 0, false, 0, 0, 37.4310, -122.1630, '351 Lasuen St, Stanford, CA 94305', 1, NULL, false, NULL, false),
  -- 7: Ticketing soon, date hidden (hide_ticketing_date = true)
  ('00000000-0000-0000-0000-000000000007', 'Speaker: Carol Davis', 120, 'Cubberley Auditorium', 12, 'https://maps.google.com', NOW() - INTERVAL '7 days', NOW() + INTERVAL '3 days', NOW() + INTERVAL '21 days', NOW() + INTERVAL '21 days' - INTERVAL '30 minutes', 'Exploring the intersection of art and artificial intelligence.', NULL, 'carol-davis', 'Art Meets AI', 0, false, 0, 0, 37.4240, -122.1680, '485 Lasuen Mall, Stanford, CA 94305', 1, NULL, true, NULL, false),
  -- 8: Ticketing date visible (hide_ticketing_date = false)
  ('00000000-0000-0000-0000-000000000008', 'Speaker: Dave Park', 180, 'NVIDIA Auditorium', 18, 'https://maps.google.com', NOW() - INTERVAL '7 days', NOW() + INTERVAL '5 days', NOW() + INTERVAL '28 days', NOW() + INTERVAL '28 days' - INTERVAL '30 minutes', 'The future of sustainable energy and climate tech.', NULL, 'dave-park', 'Climate & Code', 0, false, 0, 0, 37.4270, -122.1720, '475 Via Ortega, Stanford, CA 94305', 1, NULL, false, NULL, false),
  -- 9: Live event (doors opened 1 hour ago, event starts now)
  ('00000000-0000-0000-0000-000000000009', 'Live Speaker: Emily Zhang', 80, 'Gates B01', 8, 'https://maps.google.com', NOW() - INTERVAL '14 days', NOW() - INTERVAL '12 days', NOW(), NOW() - INTERVAL '1 hours', 'Breaking down the latest breakthroughs in large language models.', NULL, 'emily-zhang', 'LLMs Unpacked', 35, true, 15, 15, 37.4300, -122.1745, '353 Jane Stanford Way, Stanford, CA 94305', 1, NULL, false, NULL, false),
  -- 10: Referrals-enabled event (ticketing open, not sold out)
  ('00000000-0000-0000-0000-00000000000a', 'Speaker: Frank Lee', 250, 'Memorial Church', 25, 'https://maps.google.com', NOW() - INTERVAL '5 days', NOW() - INTERVAL '3 days', NOW() + INTERVAL '10 days', NOW() + INTERVAL '10 days' - INTERVAL '30 minutes', 'A talk on building communities through technology and storytelling.', NULL, 'frank-lee', 'Community & Code', 20, false, 0, 0, 37.4270, -122.1700, '450 Jane Stanford Way, Stanford, CA 94305', 1, NULL, false, 'High', true);

-- Insert test tickets for past event (event 2)
INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'testuser1@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Test User One', true),
  ('10000000-0000-0000-0000-000000000002', 'testuser2@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Test User Two', true),
  ('10000000-0000-0000-0000-000000000003', 'vip@stanford.edu', '00000000-0000-0000-0000-000000000002', 'VIP', 'VIP Guest', true);

-- Fill waitlist event (event 4): 40 STANDARD tickets to reach capacity (50 - 10 reserved = 40)
INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'user' || n || '@stanford.edu',
  '00000000-0000-0000-0000-000000000004',
  'STANDARD',
  'User ' || n,
  false
FROM generate_series(100, 139) AS n;

-- Fill standby event (event 5): 25 STANDARD tickets to reach capacity (30 - 5 reserved = 25)
INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'user' || n || '@stanford.edu',
  '00000000-0000-0000-0000-000000000005',
  'STANDARD',
  'User ' || n,
  false
FROM generate_series(200, 224) AS n;

-- Tickets for live event (event 9): 35 total, 15 scanned
INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'user' || n || '@stanford.edu',
  '00000000-0000-0000-0000-000000000009',
  'STANDARD',
  'User ' || n,
  n <= 315
FROM generate_series(300, 334) AS n;

-- Tickets for referrals event (event 10): 20 tickets
INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
SELECT
  ('10000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'user' || n || '@stanford.edu',
  '00000000-0000-0000-0000-00000000000a',
  'STANDARD',
  'User ' || n,
  false
FROM generate_series(400, 419) AS n;

-- Waitlist entries for waitlist event (event 4)
INSERT INTO public.waitlist (event_id, email, name, position)
VALUES
  ('00000000-0000-0000-0000-000000000004', 'waitlist1@stanford.edu', 'Waitlist User One', 1),
  ('00000000-0000-0000-0000-000000000004', 'waitlist2@stanford.edu', 'Waitlist User Two', 2),
  ('00000000-0000-0000-0000-000000000004', 'waitlist3@stanford.edu', 'Waitlist User Three', 3);

-- Waitlist entries for standby event (event 5)
INSERT INTO public.waitlist (event_id, email, name, position)
VALUES
  ('00000000-0000-0000-0000-000000000005', 'standby1@stanford.edu', 'Standby User One', 1),
  ('00000000-0000-0000-0000-000000000005', 'standby2@stanford.edu', 'Standby User Two', 2);

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
  ('admin@stanford.edu', 'admin'),
  ('scanner@stanford.edu', 'scanner'),
  ('both@stanford.edu', 'admin,scanner'),
  ('anishan@stanford.edu', 'admin,scanner');

-- Insert test referrals
INSERT INTO public.referrals (event_id, referral_code, count)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'abc123', 5),
  ('00000000-0000-0000-0000-000000000002', 'def456', 3),
  ('00000000-0000-0000-0000-00000000000a', 'ref001', 8),
  ('00000000-0000-0000-0000-00000000000a', 'ref002', 2);

-- Insert test notify entries
INSERT INTO public.notify (email, speaker_id)
VALUES
  ('testuser1@stanford.edu', '00000000-0000-0000-0000-000000000001'),
  ('testuser2@stanford.edu', '00000000-0000-0000-0000-000000000001'),
  ('testuser1@stanford.edu', '00000000-0000-0000-0000-000000000007'),
  ('testuser2@stanford.edu', '00000000-0000-0000-0000-000000000008');
