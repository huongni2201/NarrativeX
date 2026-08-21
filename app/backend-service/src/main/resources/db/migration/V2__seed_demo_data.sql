-- Deterministic local/demo dataset. PostgreSQL remains the source of truth.
-- This migration is intentionally idempotent so it is safe to apply to a local
-- database more than once. The first account is the requested user account.

INSERT INTO schema_baseline (id, description)
VALUES
    ('seed_marker_01', 'Demo seed marker 01'),
    ('seed_marker_02', 'Demo seed marker 02'),
    ('seed_marker_03', 'Demo seed marker 03'),
    ('seed_marker_04', 'Demo seed marker 04'),
    ('seed_marker_05', 'Demo seed marker 05'),
    ('seed_marker_06', 'Demo seed marker 06'),
    ('seed_marker_07', 'Demo seed marker 07'),
    ('seed_marker_08', 'Demo seed marker 08'),
    ('seed_marker_09', 'Demo seed marker 09'),
    ('seed_marker_10', 'Demo seed marker 10')
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth_users (id, email, display_name, avatar_url, password_hash, enabled)
VALUES
    ('seed-user-01', 'huongnn2201@gmail.com', 'Huong Nguyen', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop', '{bcrypt}$2a$10$lmmtKjv3TmMUiNC7mOb2DOMPpRDonZsOj7YGLAzNbNHfF1oZimBtm', TRUE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO projects (id, name, description, cover_image_url, owner_id, status, source_language, narration_language, metadata_language, image_aspect_ratio, image_quality_tier)
VALUES
    (1001, 'Lanterns of the Old Quarter', 'A story about a traditional artisan creating amber lanterns across historic Hanoi streets.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD'),
    (1002, 'The Clockmaker''s Map', 'An apprentice unravels secret maps hidden inside Victorian pocket watches.', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACTIVE', 'en-US', 'en-US', 'en-US', 'RATIO_16_9', 'HIGH'),
    (1003, 'Mekong Moonlight', 'A midnight boat journey along the mystical waters of the Mekong river.', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACTIVE', 'vi-VN', 'en-US', 'en-US', 'RATIO_9_16', 'STANDARD'),
    (1004, 'A House Made of Rain', 'Reflections of family memories resonating through seasonal summer showers.', 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'DRAFT', 'en-US', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'STANDARD'),
    (1005, 'The Paper Dragon', 'An origami dragon comes alive at dusk to protect a sleeping town.', 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACTIVE', 'zh-CN', 'en-US', 'en-US', 'RATIO_1_1', 'HIGH'),
    (1006, 'Whispers Beneath the Pines', 'Two travelers discover a forest choir protecting an ancient sacred tree.', 'https://images.unsplash.com/photo-1448375240586-882707db888b?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACTIVE', 'en-US', 'en-US', 'en-US', 'RATIO_16_9', 'ULTRA'),
    (1007, 'Seven Seeds', 'Generational wisdom passed through heirloom seeds and changing seasons.', 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ARCHIVED', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_9_16', 'STANDARD'),
    (1008, 'The Blue Kite', 'A message of hope flies above city rooftops tied to a vibrant blue kite.', 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACTIVE', 'en-US', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'HIGH'),
    (1009, 'River of Small Stars', 'Mapping celestial constellations mirrored in the ripples of a quiet river.', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'DRAFT', 'en-US', 'en-US', 'en-US', 'RATIO_1_1', 'STANDARD'),
    (1010, 'The Last Seed Keeper', 'A solitary guardian traverses barren valleys to plant the last memory of green.', 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=800&auto=format&fit=crop', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACTIVE', 'vi-VN', 'vi-VN', 'vi-VN', 'RATIO_16_9', 'HIGH')
ON CONFLICT (id) DO NOTHING;

INSERT INTO story_versions (id, project_id, version_number, content, source_language, status, moderation_decision)
VALUES
    (2001, 1001, 1, 'A lantern maker follows a warm light through the old quarter and finds a forgotten promise.', 'vi-VN', 'ACTIVE', 'SAFE'),
    (2002, 1002, 1, 'A young cartographer discovers that a clockmaker has hidden a city inside a pocket watch.', 'en-US', 'ACTIVE', 'SAFE'),
    (2003, 1003, 1, 'At midnight, a boatman follows moonlit ripples toward a village that appears only once a year.', 'vi-VN', 'ACTIVE', 'SAFE'),
    (2004, 1004, 1, 'A family learns to listen to the rain after it begins speaking in the voice of an old friend.', 'en-US', 'DRAFT', 'SAFE'),
    (2005, 1005, 1, 'A paper dragon leaves a trail of origami scales to guide a child home before dawn.', 'zh-CN', 'ACTIVE', 'SAFE'),
    (2006, 1006, 1, 'Two hikers hear a choir beneath the pines and uncover a forest protecting its oldest tree.', 'en-US', 'ACTIVE', 'SAFE'),
    (2007, 1007, 1, 'Seven seeds pass from grandmother to granddaughter through seven seasons of change.', 'vi-VN', 'SUPERSEDED', 'SAFE'),
    (2008, 1008, 1, 'A blue kite rises above the city and carries a quiet message across rooftops.', 'en-US', 'ACTIVE', 'SAFE'),
    (2009, 1009, 1, 'A child maps the constellations reflected in a river of small stars.', 'en-US', 'DRAFT', 'SAFE'),
    (2010, 1010, 1, 'The last seed keeper crosses a dry valley to return one green memory to the earth.', 'vi-VN', 'ACTIVE', 'SAFE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO chapters (id, story_version_id, order_index, title, source_text, source_hash, status, estimated_duration_ms, generation_progress, source_story_version_id)
VALUES
    (3001, 2001, 1, 'The First Lantern', 'The first lantern flickered before the street woke.', encode(sha256(convert_to('The first lantern flickered before the street woke.', 'UTF8')), 'hex'), 'READY', 90000, 100, 2001),
    (3002, 2002, 1, 'A Map in Brass', 'The map was hidden inside a brass clock.', encode(sha256(convert_to('The map was hidden inside a brass clock.', 'UTF8')), 'hex'), 'READY', 96000, 100, 2002),
    (3003, 2003, 1, 'The Midnight Crossing', 'The river opened beneath the moon.', encode(sha256(convert_to('The river opened beneath the moon.', 'UTF8')), 'hex'), 'READY', 84000, 100, 2003),
    (3004, 2004, 1, 'Rain at the Window', 'The rain arrived with a familiar voice.', encode(sha256(convert_to('The rain arrived with a familiar voice.', 'UTF8')), 'hex'), 'DRAFT', 78000, 20, 2004),
    (3005, 2005, 1, 'Folded Wings', 'The paper dragon unfolded its first wing.', encode(sha256(convert_to('The paper dragon unfolded its first wing.', 'UTF8')), 'hex'), 'READY', 87000, 100, 2005),
    (3006, 2006, 1, 'The Listening Pines', 'The hikers stopped where the forest began to sing.', encode(sha256(convert_to('The hikers stopped where the forest began to sing.', 'UTF8')), 'hex'), 'READY', 93000, 100, 2006),
    (3007, 2007, 1, 'The First Seed', 'The grandmother planted the first seed.', encode(sha256(convert_to('The grandmother planted the first seed.', 'UTF8')), 'hex'), 'ARCHIVED', 72000, 100, 2007),
    (3008, 2008, 1, 'The Blue Thread', 'A blue kite pulled against the morning wind.', encode(sha256(convert_to('A blue kite pulled against the morning wind.', 'UTF8')), 'hex'), 'READY', 81000, 100, 2008),
    (3009, 2009, 1, 'Water Constellations', 'The river held a second sky.', encode(sha256(convert_to('The river held a second sky.', 'UTF8')), 'hex'), 'DRAFT', 75000, 20, 2009),
    (3010, 2010, 1, 'The Dry Valley', 'The seed keeper entered the valley alone.', encode(sha256(convert_to('The seed keeper entered the valley alone.', 'UTF8')), 'hex'), 'READY', 102000, 100, 2010)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storyboard_revisions (id, chapter_id, revision_number, source_hash, source_row_version, status)
VALUES
    (3501, 3001, 1, encode(sha256(convert_to('The first lantern flickered before the street woke.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3502, 3002, 1, encode(sha256(convert_to('The map was hidden inside a brass clock.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3503, 3003, 1, encode(sha256(convert_to('The river opened beneath the moon.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3504, 3004, 1, encode(sha256(convert_to('The rain arrived with a familiar voice.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3505, 3005, 1, encode(sha256(convert_to('The paper dragon unfolded its first wing.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3506, 3006, 1, encode(sha256(convert_to('The hikers stopped where the forest began to sing.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3507, 3007, 1, encode(sha256(convert_to('The grandmother planted the first seed.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3508, 3008, 1, encode(sha256(convert_to('A blue kite pulled against the morning wind.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3509, 3009, 1, encode(sha256(convert_to('The river held a second sky.', 'UTF8')), 'hex'), 0, 'DRAFT'),
    (3510, 3010, 1, encode(sha256(convert_to('The seed keeper entered the valley alone.', 'UTF8')), 'hex'), 0, 'DRAFT')
ON CONFLICT (id) DO NOTHING;

UPDATE chapters SET current_storyboard_revision_id = 3501 WHERE id = 3001;
UPDATE chapters SET current_storyboard_revision_id = 3502 WHERE id = 3002;
UPDATE chapters SET current_storyboard_revision_id = 3503 WHERE id = 3003;
UPDATE chapters SET current_storyboard_revision_id = 3504 WHERE id = 3004;
UPDATE chapters SET current_storyboard_revision_id = 3505 WHERE id = 3005;
UPDATE chapters SET current_storyboard_revision_id = 3506 WHERE id = 3006;
UPDATE chapters SET current_storyboard_revision_id = 3507 WHERE id = 3007;
UPDATE chapters SET current_storyboard_revision_id = 3508 WHERE id = 3008;
UPDATE chapters SET current_storyboard_revision_id = 3509 WHERE id = 3009;
UPDATE chapters SET current_storyboard_revision_id = 3510 WHERE id = 3010;

INSERT INTO scenes (id, chapter_id, storyboard_revision_id, order_index, title, narration, duration_seconds, status)
VALUES
    (4001, 3001, 3501, 1, 'Street Before Dawn', 'The old quarter breathes before sunrise.', 42, 'APPROVED'),
    (4002, 3002, 3502, 1, 'Brass Mechanism', 'Tiny gears reveal a hidden coastline.', 45, 'APPROVED'),
    (4003, 3003, 3503, 1, 'Moonlit Water', 'The boat glides between silver reflections.', 38, 'REVIEW'),
    (4004, 3004, 3504, 1, 'Rainy Room', 'Rain taps a pattern on the glass.', 36, 'DRAFT'),
    (4005, 3005, 3505, 1, 'Origami Dragon', 'Folded paper lifts into a living silhouette.', 40, 'APPROVED'),
    (4006, 3006, 3506, 1, 'Pine Choir', 'The trees turn wind into a layered song.', 44, 'APPROVED'),
    (4007, 3007, 3507, 1, 'Garden Hands', 'Careful hands place a seed in dark soil.', 34, 'OUTDATED'),
    (4008, 3008, 3508, 1, 'Rooftop Wind', 'The kite crosses a row of sunlit roofs.', 39, 'APPROVED'),
    (4009, 3009, 3509, 1, 'River Sky', 'Stars average and ripple in the current below.', 41, 'DRAFT'),
    (4010, 3010, 3510, 1, 'Valley Footpath', 'A narrow path leads toward a green horizon.', 47, 'APPROVED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO visual_beats (id, scene_id, order_index, title, visual_intent, review_status, motion_mode, camera_movement, aspect_ratio_override, quality_tier_override, text_start, text_end, audio_start_ms, audio_end_ms, camera_angle)
VALUES
    (5001, 4001, 1, 'Lanterns at dawn', 'Warm lanterns form a river of light through quiet stone streets.', 'APPROVED', 'BASIC_MOTION', 'PAN', 'RATIO_16_9', 'STANDARD', 0, 46, 0, 42000, 'WIDE'),
    (5002, 4002, 1, 'Brass gears mechanism', 'Brass gears rotate around a miniature hand-drawn city.', 'APPROVED', 'BASIC_MOTION', 'PUSH_IN', 'RATIO_16_9', 'HIGH', 0, 38, 0, 45000, 'CLOSE_UP'),
    (5003, 4003, 1, 'River moonlight crossing', 'A small boat cuts a silver path across the river.', 'APPROVED', 'BASIC_MOTION', 'TRACK', 'RATIO_9_16', 'STANDARD', 0, 39, 0, 38000, 'WIDE'),
    (5004, 4004, 1, 'Rain window reflection', 'Raindrops merge into soft reflections of a family room.', 'NEEDS_REVIEW', 'STILL', 'NONE', 'RATIO_16_9', 'STANDARD', 0, 42, 0, 36000, 'MEDIUM'),
    (5005, 4005, 1, 'Paper dragon silhouette', 'An origami dragon opens paper wings above a sleeping town.', 'APPROVED', 'BASIC_MOTION', 'TILT', 'RATIO_1_1', 'HIGH', 0, 44, 0, 40000, 'LOW_ANGLE'),
    (5006, 4006, 1, 'Pine forest choir', 'Pine branches sway in rhythmic layers beneath a deep sky.', 'APPROVED', 'BASIC_MOTION', 'PARALLAX', 'RATIO_16_9', 'ULTRA', 0, 46, 0, 44000, 'WIDE'),
    (5007, 4007, 1, 'Garden seed timelapse', 'A seed settles into soil while seasons pass in a time-lapse.', 'APPROVED', 'STILL', 'NONE', 'RATIO_9_16', 'STANDARD', 0, 48, 0, 34000, 'CLOSE_UP'),
    (5008, 4008, 1, 'Blue kite rooftop breeze', 'A bright blue kite pulls a red thread across rooftops.', 'APPROVED', 'BASIC_MOTION', 'TRACK', 'RATIO_16_9', 'HIGH', 0, 48, 0, 39000, 'HIGH_ANGLE'),
    (5009, 4009, 1, 'Star reflection current', 'Constellations ripple and reform in the moving river.', 'NEEDS_REVIEW', 'BASIC_MOTION', 'ZOOM_OUT', 'RATIO_1_1', 'STANDARD', 0, 48, 0, 41000, 'POV'),
    (5010, 4010, 1, 'Green shoot in the valley', 'A single green shoot appears at the end of the dry path.', 'APPROVED', 'BASIC_MOTION', 'PUSH_IN', 'RATIO_16_9', 'HIGH', 0, 47, 0, 47000, 'MEDIUM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO generation_jobs (id, job_id, project_id, job_type, status, resource_class, progress, current_step, requested_by_user_id, billed_to_user_id)
VALUES
    (6001, '00000000-0000-4000-8000-000000000001', 1001, 'STORY_ANALYZE', 'COMPLETED', 'CPU_LIGHT', 100, 'completed', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6002, '00000000-0000-4000-8000-000000000002', 1002, 'IMAGE_GENERATE', 'COMPLETED', 'GPU_HEAVY', 100, 'completed', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6003, '00000000-0000-4000-8000-000000000003', 1003, 'IMAGE_GENERATE', 'RUNNING', 'GPU_HEAVY', 64, 'rendering_visual_beats', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6004, '00000000-0000-4000-8000-000000000004', 1004, 'STORY_ANALYZE', 'QUEUED', 'CPU_LIGHT', 0, 'queued', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6005, '00000000-0000-4000-8000-000000000005', 1005, 'RENDER_PROJECT', 'COMPLETED', 'GPU_HEAVY', 100, 'completed', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6006, '00000000-0000-4000-8000-000000000006', 1006, 'RENDER_PROJECT', 'FAILED', 'GPU_HEAVY', 72, 'provider_output_review', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6007, '00000000-0000-4000-8000-000000000007', 1007, 'RENDER_SHORT', 'COMPLETED', 'GPU_HEAVY', 100, 'completed', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6008, '00000000-0000-4000-8000-000000000008', 1008, 'IMAGE_GENERATE', 'COMPLETED', 'GPU_HEAVY', 100, 'completed', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6009, '00000000-0000-4000-8000-000000000009', 1009, 'STORY_ANALYZE', 'QUEUED', 'CPU_LIGHT', 0, 'queued', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com')),
    (6010, '00000000-0000-4000-8000-000000000010', 1010, 'RENDER_PROJECT', 'COMPLETED', 'GPU_HEAVY', 100, 'completed', (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'))
ON CONFLICT (id) DO NOTHING;

INSERT INTO stage_attempts (id, generation_job_id, stage_name, attempt_number, status, worker_id, heartbeat_at)
VALUES
    (7001, 6001, 'ANALYZE', 1, 'COMPLETED', 'seed-worker-01', CURRENT_TIMESTAMP),
    (7002, 6002, 'IMAGE', 1, 'COMPLETED', 'seed-worker-02', CURRENT_TIMESTAMP),
    (7003, 6003, 'IMAGE', 1, 'RUNNING', 'seed-worker-03', CURRENT_TIMESTAMP),
    (7004, 6004, 'ANALYZE', 1, 'QUEUED', NULL, NULL),
    (7005, 6005, 'VIDEO', 1, 'COMPLETED', 'seed-worker-05', CURRENT_TIMESTAMP),
    (7006, 6006, 'VIDEO', 1, 'FAILED', 'seed-worker-06', CURRENT_TIMESTAMP),
    (7007, 6007, 'SHORT', 1, 'COMPLETED', 'seed-worker-07', CURRENT_TIMESTAMP),
    (7008, 6008, 'IMAGE', 1, 'COMPLETED', 'seed-worker-08', CURRENT_TIMESTAMP),
    (7009, 6009, 'ANALYZE', 1, 'QUEUED', NULL, NULL),
    (7010, 6010, 'VIDEO', 1, 'COMPLETED', 'seed-worker-10', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO provider_operations (id, stage_attempt_id, provider_key, provider_operation_id, status, request_fingerprint, result_fingerprint, normalized_result_json, actual_cost, billing_currency, usage_json, pricing_snapshot_json)
VALUES
    (8001, 7001, 'demo.analysis', 'demo-op-0001', 'COMPLETED', 'seed-fp-8001', encode(sha256(convert_to('seed-rfp-8001', 'UTF8')), 'hex'), '{"scenes":1}'::jsonb, 0.015000000, 'USD', '{"tokens":1600}'::jsonb, '{"unitCost":0.00001}'::jsonb),
    (8002, 7002, 'demo.image', 'demo-op-0002', 'COMPLETED', 'seed-fp-8002', encode(sha256(convert_to('seed-rfp-8002', 'UTF8')), 'hex'), '{"images":4}'::jsonb, 0.150000000, 'USD', '{"images":4}'::jsonb, '{"unitCost":0.0375}'::jsonb),
    (8003, 7003, 'demo.image', 'demo-op-0003', 'RUNNING', 'seed-fp-8003', NULL, NULL, NULL, NULL, NULL, NULL),
    (8004, 7004, 'demo.analysis', NULL, 'RESERVED', 'seed-fp-8004', NULL, NULL, NULL, NULL, NULL, NULL),
    (8005, 7005, 'demo.video', 'demo-op-0005', 'COMPLETED', 'seed-fp-8005', encode(sha256(convert_to('seed-rfp-8005', 'UTF8')), 'hex'), '{"video":"demo.mp4"}'::jsonb, 0.650000000, 'USD', '{"seconds":87}'::jsonb, '{"unitCost":0.0075}'::jsonb),
    (8006, 7006, 'demo.video', 'demo-op-0006', 'FAILED', 'seed-fp-8006', NULL, NULL, NULL, NULL, NULL, NULL),
    (8007, 7007, 'demo.short', 'demo-op-0007', 'COMPLETED', 'seed-fp-8007', encode(sha256(convert_to('seed-rfp-8007', 'UTF8')), 'hex'), '{"short":"demo.mp4"}'::jsonb, 0.280000000, 'USD', '{"seconds":34}'::jsonb, '{"unitCost":0.0082}'::jsonb),
    (8008, 7008, 'demo.image', 'demo-op-0008', 'COMPLETED', 'seed-fp-8008', encode(sha256(convert_to('seed-rfp-8008', 'UTF8')), 'hex'), '{"images":5}'::jsonb, 0.120000000, 'USD', '{"images":5}'::jsonb, '{"unitCost":0.024}'::jsonb),
    (8009, 7009, 'demo.analysis', NULL, 'RESERVED', 'seed-fp-8009', NULL, NULL, NULL, NULL, NULL, NULL),
    (8010, 7010, 'demo.video', 'demo-op-0010', 'COMPLETED', 'seed-fp-8010', encode(sha256(convert_to('seed-rfp-8010', 'UTF8')), 'hex'), '{"video":"demo.mp4"}'::jsonb, 0.550000000, 'USD', '{"seconds":102}'::jsonb, '{"unitCost":0.0054}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO operation_plans (id, project_id, generation_job_id, operation_type, estimate_min, estimate_max, max_authorized_cost, confidence)
VALUES
    (9001, 1001, 6001, 'STORY_ANALYSIS', 0.010000, 0.020000, 0.025000, 'HIGH'),
    (9002, 1002, 6002, 'IMAGE_GENERATION', 0.100000, 0.180000, 0.200000, 'HIGH'),
    (9003, 1003, 6003, 'IMAGE_GENERATION', 0.120000, 0.220000, 0.250000, 'MEDIUM'),
    (9004, 1004, 6004, 'STORY_ANALYSIS', 0.010000, 0.030000, 0.035000, 'LOW'),
    (9005, 1005, 6005, 'VIDEO_RENDER', 0.500000, 0.800000, 1.000000, 'MEDIUM'),
    (9006, 1006, 6006, 'VIDEO_RENDER', 0.600000, 1.100000, 1.250000, 'MEDIUM'),
    (9007, 1007, 6007, 'SHORT_EXPORT', 0.200000, 0.350000, 0.400000, 'HIGH'),
    (9008, 1008, 6008, 'IMAGE_GENERATION', 0.100000, 0.160000, 0.180000, 'HIGH'),
    (9009, 1009, 6009, 'STORY_ANALYSIS', 0.010000, 0.030000, 0.035000, 'LOW'),
    (9010, 1010, 6010, 'VIDEO_RENDER', 0.450000, 0.700000, 0.850000, 'HIGH')
ON CONFLICT (id) DO NOTHING;

INSERT INTO moderation_decisions (id, user_id, project_id, entity_type, entity_id, direction, result, categories_json, provider_signal_json, policy_version, reviewer_id, resolved_at)
VALUES
    (10001, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1001, 'STORY_VERSION', '2001', 'INPUT', 'ALLOW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.01}'::jsonb, 'moderation-v1', NULL, CURRENT_TIMESTAMP),
    (10002, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1002, 'STORY_VERSION', '2002', 'INPUT', 'ALLOW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.02}'::jsonb, 'moderation-v1', NULL, CURRENT_TIMESTAMP),
    (10003, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1003, 'VISUAL_BEAT', '5003', 'OUTPUT', 'ALLOW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.03}'::jsonb, 'moderation-v1', NULL, CURRENT_TIMESTAMP),
    (10004, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1004, 'STORY_VERSION', '2004', 'INPUT', 'REVIEW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.14}'::jsonb, 'moderation-v1', 'seed-reviewer-04', NULL),
    (10005, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1005, 'VISUAL_BEAT', '5005', 'OUTPUT', 'ALLOW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.01}'::jsonb, 'moderation-v1', NULL, CURRENT_TIMESTAMP),
    (10006, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1006, 'VISUAL_BEAT', '5006', 'OUTPUT', 'BLOCK', '{"violence":0,"adult":1}'::jsonb, '{"provider":"demo-moderator","score":0.92}'::jsonb, 'moderation-v1', 'seed-reviewer-06', CURRENT_TIMESTAMP),
    (10007, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1007, 'STORY_VERSION', '2007', 'INPUT', 'ALLOW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.01}'::jsonb, 'moderation-v1', NULL, CURRENT_TIMESTAMP),
    (10008, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1008, 'VISUAL_BEAT', '5008', 'OUTPUT', 'ALLOW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.02}'::jsonb, 'moderation-v1', NULL, CURRENT_TIMESTAMP),
    (10009, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1009, 'STORY_VERSION', '2009', 'INPUT', 'REVIEW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.12}'::jsonb, 'moderation-v1', 'seed-reviewer-09', NULL),
    (10010, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1010, 'VISUAL_BEAT', '5010', 'OUTPUT', 'ALLOW', '{"violence":0,"adult":0}'::jsonb, '{"provider":"demo-moderator","score":0.01}'::jsonb, 'moderation-v1', NULL, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO notification_preferences (user_id, render_complete_email, render_failed_email, short_complete_email, web_push_enabled)
VALUES
    ((SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), TRUE, TRUE, TRUE, TRUE)
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO notifications (id, user_id, project_id, event_key, type, channel_state_json, title_key, message_key, read_at)
VALUES
    (11001, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1001, 'seed-event-01', 'RENDER_COMPLETE', '{"in_app":"DELIVERED","email":"DELIVERED"}'::jsonb, 'render.complete.title', 'render.complete.message', NULL),
    (11002, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1002, 'seed-event-02', 'RENDER_COMPLETE', '{"in_app":"READ"}'::jsonb, 'render.complete.title', 'render.complete.message', CURRENT_TIMESTAMP),
    (11003, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1003, 'seed-event-03', 'JOB_PROGRESS', '{"in_app":"DELIVERED"}'::jsonb, 'job.progress.title', 'job.progress.message', NULL),
    (11004, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1004, 'seed-event-04', 'REVIEW_REQUIRED', '{"in_app":"DELIVERED"}'::jsonb, 'review.required.title', 'review.required.message', NULL),
    (11005, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1005, 'seed-event-05', 'RENDER_COMPLETE', '{"in_app":"READ","email":"DELIVERED"}'::jsonb, 'render.complete.title', 'render.complete.message', CURRENT_TIMESTAMP),
    (11006, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1006, 'seed-event-06', 'RENDER_FAILED', '{"in_app":"DELIVERED","email":"FAILED"}'::jsonb, 'render.failed.title', 'render.failed.message', NULL),
    (11007, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1007, 'seed-event-07', 'SHORT_COMPLETE', '{"in_app":"READ","email":"DELIVERED"}'::jsonb, 'short.complete.title', 'short.complete.message', CURRENT_TIMESTAMP),
    (11008, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1008, 'seed-event-08', 'RENDER_COMPLETE', '{"in_app":"DELIVERED"}'::jsonb, 'render.complete.title', 'render.complete.message', NULL),
    (11009, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1009, 'seed-event-09', 'REVIEW_REQUIRED', '{"in_app":"DELIVERED"}'::jsonb, 'review.required.title', 'review.required.message', NULL),
    (11010, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1010, 'seed-event-10', 'RENDER_COMPLETE', '{"in_app":"READ","email":"DELIVERED"}'::jsonb, 'render.complete.title', 'render.complete.message', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO outbox_events (id, aggregate_type, aggregate_id, event_type, event_key, payload_json, status, attempts)
VALUES
    (12001, 'GenerationJob', '6001', 'RENDER_COMPLETED', 'seed-outbox-01', '{"jobId":"6001","source":"seed"}'::jsonb, 'PUBLISHED', 1),
    (12002, 'GenerationJob', '6002', 'RENDER_COMPLETED', 'seed-outbox-02', '{"jobId":"6002","source":"seed"}'::jsonb, 'PUBLISHED', 1),
    (12003, 'GenerationJob', '6003', 'JOB_PROGRESS', 'seed-outbox-03', '{"jobId":"6003","progress":64}'::jsonb, 'PENDING', 0),
    (12004, 'GenerationJob', '6004', 'JOB_QUEUED', 'seed-outbox-04', '{"jobId":"6004","source":"seed"}'::jsonb, 'PENDING', 0),
    (12005, 'GenerationJob', '6005', 'RENDER_COMPLETED', 'seed-outbox-05', '{"jobId":"6005","source":"seed"}'::jsonb, 'PUBLISHED', 1),
    (12006, 'GenerationJob', '6006', 'RENDER_FAILED', 'seed-outbox-06', '{"jobId":"6006","source":"seed"}'::jsonb, 'PUBLISHED', 2),
    (12007, 'GenerationJob', '6007', 'SHORT_COMPLETED', 'seed-outbox-07', '{"jobId":"6007","source":"seed"}'::jsonb, 'PUBLISHED', 1),
    (12008, 'GenerationJob', '6008', 'RENDER_COMPLETED', 'seed-outbox-08', '{"jobId":"6008","source":"seed"}'::jsonb, 'PUBLISHED', 1),
    (12009, 'GenerationJob', '6009', 'JOB_QUEUED', 'seed-outbox-09', '{"jobId":"6009","source":"seed"}'::jsonb, 'PENDING', 0),
    (12010, 'GenerationJob', '6010', 'RENDER_COMPLETED', 'seed-outbox-10', '{"jobId":"6010","source":"seed"}'::jsonb, 'PUBLISHED', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO plan_entitlements (id, plan_key, version, watermark_required, max_video_quality, max_longform_exports_month, max_short_exports_month, max_concurrent_expensive_jobs, feature_flags_json, monthly_credits, active_from)
VALUES
    (13001, 'DEMO_FREE_01', 1, TRUE, 'STANDARD', 2, 5, 1, '{"storyAnalysis":true}'::jsonb, 2.000000, CURRENT_TIMESTAMP),
    (13002, 'DEMO_FREE_02', 1, TRUE, 'STANDARD', 2, 5, 1, '{"storyAnalysis":true}'::jsonb, 2.000000, CURRENT_TIMESTAMP),
    (13003, 'DEMO_CREATOR_01', 1, FALSE, 'HIGH', 10, 20, 2, '{"storyAnalysis":true,"shorts":true}'::jsonb, 10.000000, CURRENT_TIMESTAMP),
    (13004, 'DEMO_CREATOR_02', 1, FALSE, 'HIGH', 10, 20, 2, '{"storyAnalysis":true,"shorts":true}'::jsonb, 10.000000, CURRENT_TIMESTAMP),
    (13005, 'DEMO_PRO_01', 1, FALSE, 'ULTRA', 30, 60, 4, '{"storyAnalysis":true,"shorts":true,"batchReview":true}'::jsonb, 50.000000, CURRENT_TIMESTAMP),
    (13006, 'DEMO_PRO_02', 1, FALSE, 'ULTRA', 30, 60, 4, '{"storyAnalysis":true,"shorts":true,"batchReview":true}'::jsonb, 50.000000, CURRENT_TIMESTAMP),
    (13007, 'DEMO_TEAM_01', 1, FALSE, 'HIGH', 50, 100, 6, '{"storyAnalysis":true,"shorts":true,"team":true}'::jsonb, 100.000000, CURRENT_TIMESTAMP),
    (13008, 'DEMO_TEAM_02', 1, FALSE, 'HIGH', 50, 100, 6, '{"storyAnalysis":true,"shorts":true,"team":true}'::jsonb, 100.000000, CURRENT_TIMESTAMP),
    (13009, 'DEMO_ENTERPRISE_01', 1, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, 1000.000000, CURRENT_TIMESTAMP),
    (13010, 'DEMO_ENTERPRISE_02', 1, FALSE, 'ULTRA', NULL, NULL, 10, '{"storyAnalysis":true,"shorts":true,"priority":true}'::jsonb, 1000.000000, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_plan_assignments (user_id, plan_key, entitlement_version, status, period_start, period_end)
VALUES
    ((SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'DEMO_PRO_01', 1, 'ACTIVE', DATE '2026-08-01', DATE '2026-09-01')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO usage_windows (user_id, period_key, longform_exports, short_exports, credits_used)
VALUES
    ((SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 3, 4, 1.250000)
ON CONFLICT (user_id, period_key) DO NOTHING;

INSERT INTO characters (id, owner_id, workspace_id, canonical_name, aliases, status)
VALUES
    (16001, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-01', 'Mai the Lantern Maker', '["Mai","Lantern Maker"]'::jsonb, 'ACTIVE'),
    (16002, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-02', 'Theo Clockmaker', '["Theo"]'::jsonb, 'ACTIVE'),
    (16003, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-03', 'Bao the Boatman', '["Bao","River Guide"]'::jsonb, 'ACTIVE'),
    (16004, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-04', 'An Rain Listener', '["An"]'::jsonb, 'ACTIVE'),
    (16005, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-05', 'Lian Paper Dragon', '["Lian"]'::jsonb, 'ACTIVE'),
    (16006, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-06', 'Pine Keeper', '["The Keeper"]'::jsonb, 'ACTIVE'),
    (16007, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-07', 'Grandmother Minh', '["Minh","Grandmother"]'::jsonb, 'ACTIVE'),
    (16008, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-08', 'The Kite Child', '["Kite Child"]'::jsonb, 'ACTIVE'),
    (16009, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-09', 'Nhi Star Mapper', '["Nhi"]'::jsonb, 'ACTIVE'),
    (16010, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'workspace-seed-10', 'The Seed Keeper', '["Keeper"]'::jsonb, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO character_versions (id, character_id, version_number, bible, visual_prompt, master_asset_id, reference_asset_ids, status, locked_at, locked_by)
VALUES
    (20001, 16001, 1, 'Patient artisan with observant eyes and a brave heart.', 'Cinematic portrait of a Vietnamese lantern maker, warm amber light, consistent face.', NULL, '["seed-ref-16001"]'::jsonb, 'LOCKED', CURRENT_TIMESTAMP, 'seed-user-01'),
    (20002, 16002, 1, 'Inventive clockmaker who hides maps inside mechanisms.', 'Cinematic portrait of a thoughtful clockmaker, brass workshop, soft rim light.', NULL, '["seed-ref-16002"]'::jsonb, 'LOCKED', CURRENT_TIMESTAMP, 'seed-user-01'),
    (20003, 16003, 1, 'A calm boatman who reads water like a book.', 'Cinematic portrait of a river boatman under moonlight, misty river, natural colors.', NULL, '["seed-ref-16003"]'::jsonb, 'APPROVED', NULL, NULL),
    (20004, 16004, 1, 'A listener who hears memories in rainfall.', 'Cinematic portrait of a young listener by a rainy window, reflective mood.', NULL, '["seed-ref-16004"]'::jsonb, 'DRAFT', NULL, NULL),
    (20005, 16005, 1, 'A child with paper-folding talent and a strong sense of direction.', 'Cinematic portrait of a child with paper dragon, dawn light, storybook realism.', NULL, '["seed-ref-16005"]'::jsonb, 'LOCKED', CURRENT_TIMESTAMP, 'seed-user-01'),
    (20006, 16006, 1, 'Guardian of a singing forest and its oldest pine.', 'Cinematic portrait of a forest keeper among tall pines, cool green palette.', NULL, '["seed-ref-16006"]'::jsonb, 'APPROVED', NULL, NULL),
    (20007, 16007, 1, 'A grandmother whose patience carries a family through seasons.', 'Cinematic portrait of a Vietnamese grandmother in a seed garden, golden hour.', NULL, '["seed-ref-16007"]'::jsonb, 'LOCKED', CURRENT_TIMESTAMP, 'seed-user-01'),
    (20008, 16008, 1, 'A quiet child who communicates through a blue kite.', 'Cinematic portrait of a child on a rooftop with blue kite, bright sky.', NULL, '["seed-ref-16008"]'::jsonb, 'APPROVED', NULL, NULL),
    (20009, 16009, 1, 'A curious mapper who turns reflections into constellations.', 'Cinematic portrait of a child beside a star-reflecting river, dreamy realism.', NULL, '["seed-ref-16009"]'::jsonb, 'DRAFT', NULL, NULL),
    (20010, 16010, 1, 'A determined keeper carrying the final green memory of a valley.', 'Cinematic portrait of a seed keeper crossing a dry valley, hopeful green accent.', NULL, '["seed-ref-16010"]'::jsonb, 'LOCKED', CURRENT_TIMESTAMP, 'seed-user-01')
ON CONFLICT (id) DO NOTHING;

INSERT INTO outfit_versions (id, character_id, version_number, name, description, prompt, status)
VALUES
    (21001, 16001, 1, 'Amber Work Apron', 'Indigo shirt and amber-threaded apron.', 'Indigo artisan clothing, amber accents, practical work apron.', 'APPROVED'),
    (21002, 16002, 1, 'Brassmaker Coat', 'Long brown coat with brass buttons.', 'Victorian-inspired brown coat, brass buttons, workshop patina.', 'APPROVED'),
    (21003, 16003, 1, 'River Indigo', 'Light indigo shirt and woven sash.', 'River boatman clothing, indigo fabric, woven sash.', 'APPROVED'),
    (21004, 16004, 1, 'Raincoat', 'Simple yellow raincoat with worn boots.', 'Yellow raincoat, worn boots, soft rainy-day styling.', 'DRAFT'),
    (21005, 16005, 1, 'Paper Festival', 'Bright festival tunic with folded-paper details.', 'Colorful festival tunic, paper-fold accents, child-safe styling.', 'APPROVED'),
    (21006, 16006, 1, 'Pine Cloak', 'Deep green cloak made for forest walks.', 'Deep green forest cloak, natural fibers, subtle pine motif.', 'APPROVED'),
    (21007, 16007, 1, 'Garden Shawl', 'Woven shawl and seed-pouch belt.', 'Woven garden shawl, seed pouch, warm earth tones.', 'APPROVED'),
    (21008, 16008, 1, 'Blue Kite Jacket', 'Blue jacket with a red thread bracelet.', 'Blue jacket, red thread bracelet, rooftop wind.', 'APPROVED'),
    (21009, 16009, 1, 'Star Map Hoodie', 'Comfortable hoodie covered with tiny map marks.', 'Star map hoodie, reflective details, gentle night palette.', 'DRAFT'),
    (21010, 16010, 1, 'Seed Keeper Pack', 'Dusty travel clothes and a protected seed pack.', 'Travel clothes, seed pack, dry valley, hopeful green accent.', 'APPROVED')
ON CONFLICT (id) DO NOTHING;

INSERT INTO character_appearances (id, character_id, project_id, timeline_key, age_state, hairstyle, injury, wardrobe_context, appearance_prompt, outfit_version_id)
VALUES
    (22001, 16001, 1001, 'chapter-01', 'adult', 'Shoulder-length black hair', NULL, 'At the lantern workshop', 'Warm amber rim light, focused expression.', 21001),
    (22002, 16002, 1002, 'chapter-01', 'middle-aged', 'Short silver-streaked hair', NULL, 'Inside the brass workshop', 'Brass reflections, precise hands, thoughtful eyes.', 21002),
    (22003, 16003, 1003, 'chapter-01', 'adult', 'Short dark hair', NULL, 'On a moonlit boat', 'Cool moonlight, calm posture, river mist.', 21003),
    (22004, 16004, 1004, 'chapter-01', 'young adult', 'Loose wavy hair', NULL, 'By a rainy window', 'Soft window light, reflective mood.', 21004),
    (22005, 16005, 1005, 'chapter-01', 'child', 'Short bob haircut', NULL, 'At a paper-covered desk', 'Bright paper colors, curious gaze, safe storybook style.', 21005),
    (22006, 16006, 1006, 'chapter-01', 'adult', 'Long braided hair', NULL, 'Among the pines', 'Green forest light, protective stance.', 21006),
    (22007, 16007, 1007, 'chapter-01', 'elder', 'Silver hair in a bun', NULL, 'In the seed garden', 'Golden-hour garden light, welcoming smile.', 21007),
    (22008, 16008, 1008, 'chapter-01', 'child', 'Short dark hair', NULL, 'On a city rooftop', 'Clear sky, blue kite, light wind.', 21008),
    (22009, 16009, 1009, 'chapter-01', 'child', 'Curly dark hair', NULL, 'Beside the river', 'Star reflections, blue hour, curious expression.', 21009),
    (22010, 16010, 1010, 'chapter-01', 'adult', 'Long windblown hair', NULL, 'Crossing the dry valley', 'Dusty horizon with one hopeful green shoot.', 21010)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_characters (id, project_id, character_id, role, importance, project_aliases, story_metadata, groups_json, pinned_character_version_id, status)
VALUES
    (23001, 1001, 16001, 'PROTAGONIST', 10, '["Mai"]'::jsonb, 'The lantern maker drives the search for the lost promise.', '["core"]'::jsonb, 20001, 'ACTIVE'),
    (23002, 1002, 16002, 'PROTAGONIST', 10, '["Theo"]'::jsonb, 'The clockmaker understands the hidden map.', '["core"]'::jsonb, 20002, 'ACTIVE'),
    (23003, 1003, 16003, 'PROTAGONIST', 10, '["Bao"]'::jsonb, 'The boatman guides the midnight crossing.', '["core"]'::jsonb, 20003, 'ACTIVE'),
    (23004, 1004, 16004, 'PROTAGONIST', 10, '["An"]'::jsonb, 'The listener deciphers the rain.', '["core"]'::jsonb, 20004, 'ACTIVE'),
    (23005, 1005, 16005, 'PROTAGONIST', 10, '["Lian"]'::jsonb, 'The child follows the paper dragon home.', '["core"]'::jsonb, 20005, 'ACTIVE'),
    (23006, 1006, 16006, 'GUARDIAN', 9, '["Keeper"]'::jsonb, 'The keeper protects the oldest pine.', '["core","forest"]'::jsonb, 20006, 'ACTIVE'),
    (23007, 1007, 16007, 'MENTOR', 8, '["Minh"]'::jsonb, 'The grandmother passes on the seed tradition.', '["family"]'::jsonb, 20007, 'ACTIVE'),
    (23008, 1008, 16008, 'PROTAGONIST', 10, '["Kite Child"]'::jsonb, 'The child sends the message across rooftops.', '["core"]'::jsonb, 20008, 'ACTIVE'),
    (23009, 1009, 16009, 'PROTAGONIST', 10, '["Nhi"]'::jsonb, 'The mapper reads the river sky.', '["core"]'::jsonb, 20009, 'ACTIVE'),
    (23010, 1010, 16010, 'PROTAGONIST', 10, '["Keeper"]'::jsonb, 'The seed keeper restores the valley.', '["core"]'::jsonb, 20010, 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity_consents (id, user_id, character_id, reference_asset_id, reference_type, consent_basis, policy_version, accepted_at, revoked_at)
VALUES
    (15001, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16001, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15002, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16002, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15003, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16003, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15004, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16004, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15005, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16005, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15006, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16006, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15007, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16007, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15008, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16008, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15009, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16009, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL),
    (15010, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 16010, NULL, 'SYNTHETIC', 'DEMO_FIXTURE', 'identity-v1', CURRENT_TIMESTAMP, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO identity_profiles (id, user_id, project_id, character_id, private_template_ref, algorithm_version, retention_class, expires_at, deleted_at)
VALUES
    (24001, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1001, 16001, 'demo://identity-template/01', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24002, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1002, 16002, 'demo://identity-template/02', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24003, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1003, 16003, 'demo://identity-template/03', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24004, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1004, 16004, 'demo://identity-template/04', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24005, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1005, 16005, 'demo://identity-template/05', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24006, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1006, 16006, 'demo://identity-template/06', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24007, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1007, 16007, 'demo://identity-template/07', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24008, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1008, 16008, 'demo://identity-template/08', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24009, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1009, 16009, 'demo://identity-template/09', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL),
    (24010, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1010, 16010, 'demo://identity-template/10', 'demo-identity-v1', 'STANDARD', CURRENT_TIMESTAMP + INTERVAL '365 days', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO ai_audit_events (id, user_id, project_id, job_id, capability, provider, model_key, prompt_version, schema_version, safety_policy_version, input_fingerprint, usage_json, generation_params_json)
VALUES
    (17001, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1001, 6001, 'STORY_ANALYZE', 'demo-provider', 'demo-text-v1', 'prompt-v1', 'story-analysis-v1', 'safety-v1', 'seed-fingerprint-01', '{"inputTokens":1200,"outputTokens":400}'::jsonb, '{"temperature":0.2}'::jsonb),
    (17002, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1002, 6002, 'IMAGE_GENERATE', 'demo-provider', 'demo-image-v1', 'prompt-v1', 'image-plan-v1', 'safety-v1', 'seed-fingerprint-02', '{"images":4}'::jsonb, '{"aspectRatio":"16:9"}'::jsonb),
    (17003, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1003, 6003, 'IMAGE_GENERATE', 'demo-provider', 'demo-image-v1', 'prompt-v1', 'image-plan-v1', 'safety-v1', 'seed-fingerprint-03', '{"images":3}'::jsonb, '{"aspectRatio":"9:16"}'::jsonb),
    (17004, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1004, 6004, 'STORY_ANALYZE', 'demo-provider', 'demo-text-v1', 'prompt-v1', 'story-analysis-v1', 'safety-v1', 'seed-fingerprint-04', '{"inputTokens":800}'::jsonb, '{"temperature":0.3}'::jsonb),
    (17005, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1005, 6005, 'RENDER_PROJECT', 'demo-provider', 'demo-video-v1', 'prompt-v1', 'render-v1', 'safety-v1', 'seed-fingerprint-05', '{"durationSeconds":87}'::jsonb, '{"quality":"HIGH"}'::jsonb),
    (17006, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1006, 6006, 'RENDER_PROJECT', 'demo-provider', 'demo-video-v1', 'prompt-v1', 'render-v1', 'safety-v1', 'seed-fingerprint-06', '{"durationSeconds":93}'::jsonb, '{"quality":"ULTRA"}'::jsonb),
    (17007, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1007, 6007, 'RENDER_SHORT', 'demo-provider', 'demo-short-v1', 'prompt-v1', 'short-v1', 'safety-v1', 'seed-fingerprint-07', '{"durationSeconds":34}'::jsonb, '{"aspectRatio":"9:16"}'::jsonb),
    (17008, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1008, 6008, 'IMAGE_GENERATE', 'demo-provider', 'demo-image-v1', 'prompt-v1', 'image-plan-v1', 'safety-v1', 'seed-fingerprint-08', '{"images":5}'::jsonb, '{"aspectRatio":"16:9"}'::jsonb),
    (17009, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1009, 6009, 'STORY_ANALYZE', 'demo-provider', 'demo-text-v1', 'prompt-v1', 'story-analysis-v1', 'safety-v1', 'seed-fingerprint-09', '{"inputTokens":900}'::jsonb, '{"temperature":0.3}'::jsonb),
    (17010, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1010, 6010, 'RENDER_PROJECT', 'demo-provider', 'demo-video-v1', 'prompt-v1', 'render-v1', 'safety-v1', 'seed-fingerprint-10', '{"durationSeconds":102}'::jsonb, '{"quality":"HIGH"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO data_deletion_requests (id, user_id, scope, scope_id, status, started_at, completed_at, retention_deadline)
VALUES
    (18001, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'PROJECT', '1001', 'REQUESTED', NULL, NULL, CURRENT_TIMESTAMP + INTERVAL '30 days'),
    (18002, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'PROJECT', '1002', 'IN_PROGRESS', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP + INTERVAL '30 days'),
    (18003, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ASSET', 'asset-seed-03', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '29 days'),
    (18004, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACCOUNT', 'seed-user-01', 'REQUESTED', NULL, NULL, CURRENT_TIMESTAMP + INTERVAL '30 days'),
    (18005, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'PROJECT', '1005', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP + INTERVAL '27 days'),
    (18006, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'PROJECT', '1006', 'FAILED', CURRENT_TIMESTAMP - INTERVAL '3 days', NULL, CURRENT_TIMESTAMP + INTERVAL '30 days'),
    (18007, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ASSET', 'asset-seed-07', 'REQUESTED', NULL, NULL, CURRENT_TIMESTAMP + INTERVAL '30 days'),
    (18008, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'PROJECT', '1008', 'IN_PROGRESS', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP + INTERVAL '30 days'),
    (18009, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'ACCOUNT', 'seed-user-01', 'COMPLETED', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP + INTERVAL '26 days'),
    (18010, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'PROJECT', '1010', 'REQUESTED', NULL, NULL, CURRENT_TIMESTAMP + INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_preferences (user_id, preferred_locale, timezone, default_narration_language, default_metadata_language)
VALUES
    ((SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'vi-VN', 'Asia/Ho_Chi_Minh', 'vi-VN', 'vi-VN')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO abuse_events (id, user_id, ip_hash, session_id, route_key, signal_type, action, policy_version)
VALUES
    (19001, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-01', 'seed-session-01', '/api/v1/projects', 'RATE_OK', 'ALLOW', 'abuse-v1'),
    (19002, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-02', 'seed-session-02', '/api/v1/projects', 'RATE_OK', 'ALLOW', 'abuse-v1'),
    (19003, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-03', 'seed-session-03', '/api/v1/generation', 'BURST', 'THROTTLE', 'abuse-v1'),
    (19004, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-04', 'seed-session-04', '/api/v1/analysis-jobs', 'RATE_OK', 'ALLOW', 'abuse-v1'),
    (19005, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-05', 'seed-session-05', '/api/v1/generation', 'RATE_OK', 'ALLOW', 'abuse-v1'),
    (19006, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-06', 'seed-session-06', '/api/v1/generation', 'CONCURRENCY', 'THROTTLE', 'abuse-v1'),
    (19007, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-07', 'seed-session-07', '/api/v1/shorts', 'RATE_OK', 'ALLOW', 'abuse-v1'),
    (19008, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-08', 'seed-session-08', '/api/v1/assets', 'RATE_OK', 'ALLOW', 'abuse-v1'),
    (19009, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-09', 'seed-session-09', '/api/v1/analysis-jobs', 'ANOMALY', 'REVIEW', 'abuse-v1'),
    (19010, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 'seed-ip-hash-10', 'seed-session-10', '/api/v1/generation', 'RATE_OK', 'ALLOW', 'abuse-v1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_locations (id, project_id, name, description, visual_prompt, reference_image_url, status)
VALUES
    (25001, 1001, 'Hanoi Old Quarter Night Market', 'Lively ancient stone streets lined with glowing amber silk lanterns.', 'Cinematic night scene of Old Quarter Hanoi, red and gold lanterns, wet cobblestones reflecting warm light.', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop', 'ACTIVE'),
    (25002, 1001, 'Traditional Lantern Workshop', 'Artisan workshop filled with bamboo frames, silk fabrics, and glowing lamps.', 'Warm intimate lantern craftsman workshop, soft shadows, ambient lighting.', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop', 'ACTIVE'),
    (25003, 1002, 'Brass Clockmaker Workshop', 'Victorian style workshop with intricate gears, pendulum clocks, and brass tools.', 'Steampunk Victorian watchmaker workshop, dusty sunbeams through arched windows, brass machinery.', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop', 'ACTIVE'),
    (25004, 1003, 'Mekong River at Midnight', 'Misty river bank with calm silver water reflecting full moonlight.', 'Atmospheric nighttime riverbank, wooden boat on water, glowing ripples under moonlight.', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop', 'ACTIVE')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_assets (id, project_id, name, asset_type, storage_key, url, mime_type, status, metadata_json)
VALUES
    (26001, 1001, 'old_quarter_lantern_master.png', 'IMAGE', 'projects/1001/assets/lantern_master.png', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop', 'image/png', 'ACTIVE', '{"width":1920,"height":1080,"source":"reference"}'::jsonb),
    (26002, 1001, 'lantern_maker_portrait.png', 'IMAGE', 'projects/1001/assets/artisan_portrait.png', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=1200&auto=format&fit=crop', 'image/png', 'ACTIVE', '{"width":1024,"height":1024,"source":"character_master"}'::jsonb),
    (26003, 1002, 'brass_gears_blueprint.png', 'IMAGE', 'projects/1002/assets/brass_gears.png', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1200&auto=format&fit=crop', 'image/png', 'ACTIVE', '{"width":1920,"height":1080,"source":"reference"}'::jsonb),
    (26004, 1003, 'moonlit_water_concept.png', 'IMAGE', 'projects/1003/assets/mekong_moonlight.png', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1200&auto=format&fit=crop', 'image/png', 'ACTIVE', '{"width":1080,"height":1920,"source":"concept_art"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Continuity and storyboard relationship fixtures
-- -----------------------------------------------------------------------------

INSERT INTO scene_characters (scene_id, order_index, project_character_id)
VALUES
    (4001, 0, 23001),
    (4002, 0, 23002),
    (4003, 0, 23003),
    (4004, 0, 23004),
    (4005, 0, 23005),
    (4006, 0, 23006),
    (4007, 0, 23007),
    (4008, 0, 23008),
    (4009, 0, 23009),
    (4010, 0, 23010)
ON CONFLICT DO NOTHING;

INSERT INTO visual_beat_characters (visual_beat_id, project_character_id, role)
VALUES
    (5001, 23001, 'PRIMARY'),
    (5002, 23002, 'PRIMARY'),
    (5003, 23003, 'PRIMARY'),
    (5004, 23004, 'PRIMARY'),
    (5005, 23005, 'PRIMARY'),
    (5006, 23006, 'PRIMARY'),
    (5007, 23007, 'PRIMARY'),
    (5008, 23008, 'PRIMARY'),
    (5009, 23009, 'PRIMARY'),
    (5010, 23010, 'PRIMARY')
ON CONFLICT DO NOTHING;

INSERT INTO project_character_ai_identities
    (project_id, ai_key, project_character_id, aliases, observations, first_seen_chapter_id, last_seen_chapter_id, match_basis, confidence)
VALUES
    (1001, 'mai-lantern-maker', 23001, '["Mai","lantern maker"]'::jsonb, '["amber workshop","red silk lantern"]'::jsonb, 3001, 3001, 'CREATED', 1.000),
    (1002, 'theo-clockmaker', 23002, '["Theo","clockmaker"]'::jsonb, '["brass workshop","pocket watch"]'::jsonb, 3002, 3002, 'CREATED', 1.000),
    (1003, 'bao-boatman', 23003, '["Bao","boatman"]'::jsonb, '["wooden boat","moonlit river"]'::jsonb, 3003, 3003, 'CREATED', 1.000)
ON CONFLICT (project_id, ai_key) DO NOTHING;

INSERT INTO project_location_ai_identities
    (project_id, ai_key, project_location_id, aliases, observations, first_seen_chapter_id, last_seen_chapter_id, match_basis, confidence)
VALUES
    (1001, 'old-quarter-market', 25001, '["old quarter","night market"]'::jsonb, '["wet cobblestones","amber lanterns"]'::jsonb, 3001, 3001, 'CREATED', 1.000),
    (1001, 'lantern-workshop', 25002, '["workshop","lantern studio"]'::jsonb, '["bamboo frames","silk fabric"]'::jsonb, 3001, 3001, 'CREATED', 1.000),
    (1002, 'brass-workshop', 25003, '["clockmaker workshop"]'::jsonb, '["brass gears","dusty sunbeams"]'::jsonb, 3002, 3002, 'CREATED', 1.000)
ON CONFLICT (project_id, ai_key) DO NOTHING;

INSERT INTO project_favorites (user_id, project_id)
VALUES
    ((SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1001),
    ((SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1002),
    ((SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), 1003)
ON CONFLICT (user_id, project_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Backend-authoritative media plan fixtures
-- -----------------------------------------------------------------------------

INSERT INTO media_plans
    (id, chapter_id, chapter_row_version, source_hash, production_mode, revision, narration_characters, image_generate_count, image_edit_count, basic_motion_seconds, planned_i2v_seconds, estimated_cost, created_at)
VALUES
    ('00000000-0000-4000-8000-000000001001', 3001, 0,
     encode(sha256(convert_to('The first lantern flickered before the street woke.', 'UTF8')), 'hex'),
     'IMAGE_MOTION', 1, 54, 1, 0, 42, 0, 0.025000, CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

INSERT INTO media_scene_plans
    (media_plan_id, scene_index, scene_id, scene_order_index, narration, duration_seconds)
VALUES
    ('00000000-0000-4000-8000-000000001001', 0, 4001, 1, 'The old quarter breathes before sunrise.', 42)
ON CONFLICT (media_plan_id, scene_index) DO NOTHING;

INSERT INTO media_beat_plans
    (media_plan_id, scene_index, beat_index, visual_beat_id, visual_beat_order_index, visual_intent, semantic_motion_mode, motion_strategy)
VALUES
    ('00000000-0000-4000-8000-000000001001', 0, 0, 5001, 1,
     'Warm lanterns form a river of light through quiet stone streets.', 'BASIC_MOTION', 'BASIC_IMAGE_MOTION')
ON CONFLICT (media_plan_id, scene_index, beat_index) DO NOTHING;

UPDATE generation_jobs
SET media_plan_id = '00000000-0000-4000-8000-000000001001',
    media_plan_revision = 1,
    production_mode = 'IMAGE_MOTION'
WHERE id = 6005;

-- -----------------------------------------------------------------------------
-- Quota reservation lifecycle fixtures
-- -----------------------------------------------------------------------------

INSERT INTO quota_reservations
    (id, user_id, period_key, generation_job_id, estimated_cost, actual_cost, billing_currency, status, finalized_at)
VALUES
    (6101, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6001, 0.025000, 0.015000000, 'USD', 'CONSUMED', CURRENT_TIMESTAMP),
    (6102, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6002, 0.200000, 0.150000000, 'USD', 'CONSUMED', CURRENT_TIMESTAMP),
    (6103, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6003, 0.250000, NULL, NULL, 'RESERVED', NULL),
    (6104, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6004, 0.035000, NULL, NULL, 'RESERVED', NULL),
    (6105, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6005, 1.000000, 0.650000000, 'USD', 'CONSUMED', CURRENT_TIMESTAMP),
    (6106, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6006, 1.250000, 0.000000000, 'USD', 'RELEASED', CURRENT_TIMESTAMP),
    (6107, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6007, 0.400000, 0.280000000, 'USD', 'CONSUMED', CURRENT_TIMESTAMP),
    (6108, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6008, 0.180000, 0.120000000, 'USD', 'CONSUMED', CURRENT_TIMESTAMP),
    (6109, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6009, 0.035000, NULL, NULL, 'RESERVED', NULL),
    (6110, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6010, 0.850000, 0.550000000, 'USD', 'CONSUMED', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Full-chapter TTS and uploaded narration fixtures
-- -----------------------------------------------------------------------------

INSERT INTO generation_jobs
    (id, job_id, project_id, job_type, status, resource_class, progress, current_step, requested_by_user_id, billed_to_user_id, story_version_id, chapter_id, chapter_row_version, source_hash, source_text, source_language, idempotency_key)
VALUES
    (6020, '00000000-0000-4000-8000-000000000020', 1001, 'NARRATION_GENERATE', 'QUEUED', 'PROVIDER_INTERACTIVE', 0, 'queued',
     (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'),
     (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'),
     2001, 3001, 0,
     encode(sha256(convert_to('The first lantern flickered before the street woke.', 'UTF8')), 'hex'),
     'The first lantern flickered before the street woke.', 'vi-VN', 'seed-narration-job-6020')
ON CONFLICT (id) DO NOTHING;

INSERT INTO stage_attempts (id, generation_job_id, stage_name, attempt_number, status, worker_id, heartbeat_at)
VALUES (7020, 6020, 'NARRATION', 1, 'QUEUED', NULL, NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO provider_operations
    (id, stage_attempt_id, provider_key, provider_operation_id, status, request_fingerprint)
VALUES (8020, 7020, 'demo.tts', NULL, 'RESERVED', 'seed-tts-request-8020')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operation_plans
    (id, project_id, generation_job_id, operation_type, estimate_min, estimate_max, max_authorized_cost, confidence)
VALUES (9020, 1001, 6020, 'NARRATION_GENERATE', 0.010000, 0.030000, 0.040000, 'MEDIUM')
ON CONFLICT (id) DO NOTHING;

INSERT INTO quota_reservations
    (id, user_id, period_key, generation_job_id, estimated_cost, actual_cost, billing_currency, status, finalized_at)
VALUES (6111, (SELECT id FROM auth_users WHERE email = 'huongnn2201@gmail.com'), '2026-08', 6020, 0.040000, NULL, NULL, 'RESERVED', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_assets
    (id, project_id, name, asset_type, storage_key, url, mime_type, status, metadata_json)
VALUES
    (26005, 1001, 'first_lantern_narration.wav', 'AUDIO', 'projects/1001/assets/first_lantern_narration.wav', NULL, 'audio/wav', 'ACTIVE',
     '{"durationMs":42000,"source":"tts","sampleRateHz":48000,"channels":2}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO narration_requests
    (id, project_id, chapter_id, chapter_row_version, source_hash, source_text, voice_id, language, speaking_rate, segmentation_version, request_fingerprint)
VALUES
    ('00000000-0000-4000-8000-000000002001', 1001, 3001, 0,
     encode(sha256(convert_to('The first lantern flickered before the street woke.', 'UTF8')), 'hex'),
     'The first lantern flickered before the street woke.', 'demo-vi-female-01', 'vi-VN', 1.0000, 'sentence-v1', repeat('1', 64))
ON CONFLICT (id) DO NOTHING;

INSERT INTO narration_operations (id, narration_request_id, generation_job_id, stage_attempt_id)
VALUES
    ('00000000-0000-4000-8000-000000002002', '00000000-0000-4000-8000-000000002001', 6020, 7020)
ON CONFLICT (id) DO NOTHING;

INSERT INTO narration_assets
    (id, narration_request_id, project_asset_id, duration_ms, size_bytes, codec, sample_rate_hz, channels, checksum)
VALUES
    ('00000000-0000-4000-8000-000000002003', '00000000-0000-4000-8000-000000002001', 26005, 42000, 840000, 'PCM_S16LE', 48000, 2, repeat('2', 64))
ON CONFLICT (id) DO NOTHING;

INSERT INTO narration_alignments
    (id, narration_asset_id, source_hash, alignment_version, spans_json)
VALUES
    ('00000000-0000-4000-8000-000000002004', '00000000-0000-4000-8000-000000002003',
     encode(sha256(convert_to('The first lantern flickered before the street woke.', 'UTF8')), 'hex'),
     'demo-align-v1', '[{"textStart":0,"textEnd":54,"audioStartMs":0,"audioEndMs":42000}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO media_assets
    (id, account_id, asset_type, origin, storage_key, original_filename, content_type, size_bytes, sha256, duration_ms, status)
VALUES
    ('00000000-0000-4000-8000-000000004001', 'seed-user-01', 'AUDIO', 'USER_UPLOAD',
     'accounts/seed-user-01/uploads/river-intro.wav', 'river-intro.wav', 'audio/wav', 1200000, repeat('3', 64), 60000, 'READY')
ON CONFLICT (id) DO NOTHING;

INSERT INTO narration_sets
    (id, story_id, source, status, narration_fingerprint, total_duration_ms)
VALUES
    ('00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-000000005101', 'USER_PROVIDED_AUDIO', 'READY', repeat('4', 64), 60000)
ON CONFLICT (id) DO NOTHING;

INSERT INTO narration_parts
    (id, narration_set_id, media_asset_id, sequence, duration_ms, sha256)
VALUES
    ('00000000-0000-4000-8000-000000005002', '00000000-0000-4000-8000-000000005001', '00000000-0000-4000-8000-000000004001', 0, 60000, repeat('3', 64))
ON CONFLICT (id) DO NOTHING;

INSERT INTO narration_documents
    (id, story_id, document_fingerprint)
VALUES
    ('00000000-0000-4000-8000-000000006001', '00000000-0000-4000-8000-000000005101', repeat('5', 64))
ON CONFLICT (id) DO NOTHING;

INSERT INTO narration_document_chapters
    (narration_document_id, chapter_id, chapter_revision_id, sequence, global_text_start, global_text_end, source_hash, row_version)
VALUES
    ('00000000-0000-4000-8000-000000006001', '00000000-0000-4000-8000-000000006101', '00000000-0000-4000-8000-000000006201', 0, 0, 54,
     encode(sha256(convert_to('The first lantern flickered before the street woke.', 'UTF8')), 'hex'), 0)
ON CONFLICT (narration_document_id, sequence) DO NOTHING;

INSERT INTO narration_alignment_runs
    (id, narration_document_id, narration_set_id, document_fingerprint, narration_fingerprint, provider, provider_version, status, coverage, confidence, spans_json)
VALUES
    ('00000000-0000-4000-8000-000000006002', '00000000-0000-4000-8000-000000006001', '00000000-0000-4000-8000-000000005001',
     repeat('5', 64), repeat('4', 64), 'demo-aligner', 'demo-aligner-v1', 'READY', 1.00000, 0.98000,
     '[{"chapterSequence":0,"audioStartMs":0,"audioEndMs":60000}]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Immutable render input and output fixtures
-- -----------------------------------------------------------------------------

INSERT INTO render_manifests
    (id, project_id, chapter_id, media_plan_id, chapter_row_version, source_hash, render_fingerprint, manifest_json)
VALUES
    (27001, 1001, 3001, '00000000-0000-4000-8000-000000001001', 0,
     encode(sha256(convert_to('The first lantern flickered before the street woke.', 'UTF8')), 'hex'),
     repeat('6', 64),
     '{"productionMode":"IMAGE_MOTION","sceneCount":1,"beatCount":1,"watermark":true}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO final_artifacts
    (id, project_id, chapter_id, generation_job_id, render_manifest_id, artifact_type, render_fingerprint, storage_key, mime_type, size_bytes, checksum_sha256, duration_ms, width, height, fps, status)
VALUES
    (28001, 1001, 3001, 6005, 27001, 'CHAPTER_VIDEO', repeat('6', 64),
     'projects/1001/chapters/3001/final/demo-render.mp4', 'video/mp4', 24800000, repeat('7', 64), 42000, 1920, 1080, 24.000, 'READY')
ON CONFLICT (id) DO NOTHING;
