-- Seed data for local Supabase development

-- Insert test events
INSERT INTO public.events (id, name, capacity, venue, reserved, venue_link, release_date, ticketing_date, banner, start_time_date, doors_open, "desc", img, route, tagline, tickets, live, scanned, scanned_count, latitude, longitude, address, img_version, livestream)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Test Speaker: Jane Doe', 100, 'Memorial Auditorium', 10, 'https://maps.google.com', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days', true, NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' - INTERVAL '30 minutes', 'An exciting talk about technology and innovation.', NULL, 'jane-doe', 'Innovation & Beyond', 0, false, 0, 0, 37.4275, -122.1697, '551 Serra Mall, Stanford, CA 94305', 1, false),
  ('00000000-0000-0000-0000-000000000002', 'Past Speaker: John Smith', 200, 'Dinkelspiel Auditorium', 20, 'https://maps.google.com', NOW() - INTERVAL '30 days', NOW() - INTERVAL '28 days', false, NOW() - INTERVAL '7 days', NOW() - INTERVAL '7 days' - INTERVAL '30 minutes', 'A retrospective on AI in education.', NULL, 'john-smith', 'AI & Education', 50, false, 30, 30, 37.4265, -122.1645, '471 Lagunita Dr, Stanford, CA 94305', 1, false),
  ('00000000-0000-0000-0000-000000000003', 'Mystery Speaker', 150, 'Bing Concert Hall', 15, 'https://maps.google.com', NOW() + INTERVAL '7 days', NOW() + INTERVAL '9 days', false, NOW() + INTERVAL '30 days', NOW() + INTERVAL '30 days' - INTERVAL '30 minutes', 'Mystery event - stay tuned!', NULL, 'mystery-event', NULL, 0, false, 0, 0, 37.4321, -122.1660, '327 Lasuen St, Stanford, CA 94305', 1, false);

-- Insert test tickets for past event
INSERT INTO public.tickets (id, email, event_id, type, name, scanned)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'testuser1@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Test User One', true),
  ('10000000-0000-0000-0000-000000000002', 'testuser2@stanford.edu', '00000000-0000-0000-0000-000000000002', 'STANDARD', 'Test User Two', true),
  ('10000000-0000-0000-0000-000000000003', 'vip@stanford.edu', '00000000-0000-0000-0000-000000000002', 'VIP', 'VIP Guest', true);

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
  ('both@stanford.edu', 'admin,scanner');

-- Insert test referrals
INSERT INTO public.referrals (event_id, referral_code, count)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'abc123', 5),
  ('00000000-0000-0000-0000-000000000002', 'def456', 3);

-- Insert test notify entries
INSERT INTO public.notify (email, speaker_id)
VALUES
  ('testuser1@stanford.edu', '00000000-0000-0000-0000-000000000001'),
  ('testuser2@stanford.edu', '00000000-0000-0000-0000-000000000001');
