-- ============================================================
-- APadel — FIX EVERYTHING (safe to paste & run multiple times)
-- Paste this entire file into Supabase SQL Editor → Run
-- ============================================================

-- ─── Extensions ───────────────────────────────────────────
create extension if not exists pgcrypto schema extensions;
set search_path to public, extensions;

-- ─── Schema patches ───────────────────────────────────────
alter table public.registrations add column if not exists join_code text;
create unique index if not exists idx_registrations_join_code
  on public.registrations(join_code) where join_code is not null;

-- ─── Fix missing RLS policy for join-code registration ────
-- Allows an authenticated player to claim the player2 slot
-- when they know the join code (organizer-only update was too restrictive)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'registrations'
      and policyname = 'reg_update_join_code'
  ) then
    execute $p$
      create policy "reg_update_join_code"
        on public.registrations
        for update to authenticated
        using  (player2_id is null and join_code is not null)
        with check (player2_id = auth.uid())
    $p$;
  end if;
end;
$$;

-- ─── Admin account: ammaralkadyy@gmail.com ────────────────
-- If the email already exists (from Supabase Auth signup), just elevate to admin.
-- If it doesn't exist, create it fresh.
do $$
declare
  admin_id uuid;
begin
  -- Check if the email already exists in auth.users
  select id into admin_id from auth.users where email = 'ammaralkadyy@gmail.com' limit 1;

  if admin_id is null then
    -- New account
    admin_id := 'ffffffff-0000-0000-0000-000000000001';
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user
    ) values (
      admin_id, '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'ammaralkadyy@gmail.com',
      extensions.crypt('Ammar1234am', extensions.gen_salt('bf')),
      now(),
      '{"full_name":"Ammar Al-Kady"}'::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      now(), now(), '', '', '', '', false
    );
  else
    -- Account exists — just update the password
    update auth.users
    set encrypted_password = extensions.crypt('Ammar1234am', extensions.gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = admin_id;
  end if;

  -- Upsert the profile with admin role (works whether profile exists or not)
  insert into public.profiles (id, full_name, email, role)
  values (admin_id, 'Ammar Al-Kady', 'ammaralkadyy@gmail.com', 'admin')
  on conflict (id) do update set
    full_name = excluded.full_name,
    email     = excluded.email,
    role      = 'admin';
end;
$$;

-- ─── Clean up old test data (in FK-safe order) ────────────
delete from public.tournament_champions
  where tournament_id in (
    select id from public.tournaments
    where name in (
      'APadel Alexandria Open 2026',
      'APadel Cairo Masters 2026',
      'APadel Spring Cup 2026'
    )
  );

delete from public.tournaments
  where name in (
    'APadel Alexandria Open 2026',
    'APadel Cairo Masters 2026',
    'APadel Spring Cup 2026'
  );

delete from public.player_stats
  where player_id in (
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000002'::uuid,
    'a1000000-0000-0000-0000-000000000003'::uuid
  );

delete from public.profiles
  where id in (
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000002'::uuid,
    'a1000000-0000-0000-0000-000000000003'::uuid
  );

delete from auth.users
  where id in (
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'a1000000-0000-0000-0000-000000000002'::uuid,
    'a1000000-0000-0000-0000-000000000003'::uuid
  );

delete from public.announcements;

-- ─── Contact info ─────────────────────────────────────────
insert into public.contact_info (id, whatsapp, instagram, facebook, email, location)
values (1, '+20 100 123 4567', '@apadel.egypt', 'APadel Egypt', 'info@apadel.com', 'Cairo, Egypt')
on conflict (id) do update set
  whatsapp  = excluded.whatsapp,
  instagram = excluded.instagram,
  facebook  = excluded.facebook,
  email     = excluded.email,
  location  = excluded.location;

-- ─── Sponsors ─────────────────────────────────────────────
delete from public.sponsors;
insert into public.sponsors (name, sponsor_type, logo_url, website_url, is_active, sort_order) values
  ('Wilson',      'Title Sponsor',  null, 'https://www.wilson.com',       true, 1),
  ('Head',        'Racket Partner', null, 'https://www.head.com',         true, 2),
  ('Bullpadel',   'Official Ball',  null, 'https://www.bullpadel.com',    true, 3),
  ('Nox',         'Equipment',      null, 'https://www.noxsport.com',     true, 4),
  ('Red Bull',    'Energy Partner', null, 'https://www.redbull.com',      true, 5),
  ('Decathlon',   'Retail Partner', null, 'https://www.decathlon.com.eg', true, 6),
  ('Smouha Club', 'Club Partner',   null, '#',                            true, 7),
  ('Wadi Degla',  'Club Partner',   null, '#',                            true, 8);

-- ─── Point config ─────────────────────────────────────────
insert into public.point_config (id, match_win_points, title_bonus_points, runner_up_bonus_points)
values (1, 15, 50, 25)
on conflict (id) do update set
  match_win_points       = excluded.match_win_points,
  title_bonus_points     = excluded.title_bonus_points,
  runner_up_bonus_points = excluded.runner_up_bonus_points;

-- ─── 3 test players (password: Padel2026!) ────────────────
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, raw_app_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change, is_sso_user
) values
(
  'a1000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'ahmed.hassan@apadel.com',
  extensions.crypt('Padel2026!', extensions.gen_salt('bf')),
  now(),
  '{"full_name":"Ahmed Hassan","gender":"male","origin":"Cairo","phone":"+20 100 111 2233"}'::jsonb,
  '{"provider":"email","providers":["email"]}'::jsonb,
  now() - interval '60 days', now(), '', '', '', '', false
),
(
  'a1000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'karim.sherif@apadel.com',
  extensions.crypt('Padel2026!', extensions.gen_salt('bf')),
  now(),
  '{"full_name":"Karim Sherif","gender":"male","origin":"Alexandria","phone":"+20 100 222 3344"}'::jsonb,
  '{"provider":"email","providers":["email"]}'::jsonb,
  now() - interval '55 days', now(), '', '', '', '', false
),
(
  'a1000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'omar.farouk@apadel.com',
  extensions.crypt('Padel2026!', extensions.gen_salt('bf')),
  now(),
  '{"full_name":"Omar Farouk","gender":"male","origin":"Giza","phone":"+20 100 333 4455"}'::jsonb,
  '{"provider":"email","providers":["email"]}'::jsonb,
  now() - interval '45 days', now(), '', '', '', '', false
)
on conflict (id) do nothing;

-- ─── Profiles (manual — trigger doesn't fire from SQL Editor) ──
insert into public.profiles (id, full_name, email, gender, origin, phone, role)
values
  ('a1000000-0000-0000-0000-000000000001', 'Ahmed Hassan', 'ahmed.hassan@apadel.com', 'male', 'Cairo',      '+20 100 111 2233', 'player'),
  ('a1000000-0000-0000-0000-000000000002', 'Karim Sherif', 'karim.sherif@apadel.com', 'male', 'Alexandria', '+20 100 222 3344', 'player'),
  ('a1000000-0000-0000-0000-000000000003', 'Omar Farouk',  'omar.farouk@apadel.com',  'male', 'Giza',       '+20 100 333 4455', 'player')
on conflict (id) do update set
  full_name = excluded.full_name,
  email     = excluded.email,
  gender    = excluded.gender,
  origin    = excluded.origin,
  phone     = excluded.phone,
  role      = excluded.role;

-- ─── Player stats ─────────────────────────────────────────
insert into public.player_stats (player_id, total_points, wins, losses, titles, tournaments_played)
values
  ('a1000000-0000-0000-0000-000000000001', 185, 9, 3, 1, 3),
  ('a1000000-0000-0000-0000-000000000002', 145, 7, 3, 0, 3),
  ('a1000000-0000-0000-0000-000000000003',  95, 5, 3, 0, 2)
on conflict (player_id) do update set
  total_points       = excluded.total_points,
  wins               = excluded.wins,
  losses             = excluded.losses,
  titles             = excluded.titles,
  tournaments_played = excluded.tournaments_played;

-- ─── Tournaments ──────────────────────────────────────────
insert into public.tournaments (
  id, name, description, location, surface,
  num_courts, max_teams, entry_fee, prize_pool,
  first_place_cash, second_place_cash, third_place_cash,
  start_date, end_date, registration_deadline,
  status, image_url
) values
(
  'b1000000-0000-0000-0000-000000000001',
  'APadel Alexandria Open 2026',
  'Egypt''s premier coastal padel tournament. The Alexandria Open brings the country''s top ranked pairs to Smouha Club for two days of group stage and knockout action. Limited to 16 teams — register before July 13th.',
  'Smouha Club, Alexandria', 'Artificial Grass',
  6, 16, 500, 20000, 10000, 5000, 2500,
  '2026-07-18', '2026-07-19', '2026-07-13',
  'registration_open',
  'https://images.pexels.com/photos/34079998/pexels-photo-34079998.jpeg?auto=compress&cs=tinysrgb&w=1200'
),
(
  'b1000000-0000-0000-0000-000000000002',
  'APadel Cairo Masters 2026',
  'The Cairo Masters is our flagship capital event — four show courts at Wadi Degla New Cairo, 12 competing pairs, and a knockout format built for spectators as much as players.',
  'Wadi Degla Club, New Cairo', 'Artificial Grass',
  4, 12, 350, 12000, 6000, 3000, null,
  '2026-08-29', '2026-08-30', '2026-08-24',
  'upcoming',
  'https://images.pexels.com/photos/35248374/pexels-photo-35248374.jpeg?auto=compress&cs=tinysrgb&w=1200'
),
(
  'b1000000-0000-0000-0000-000000000003',
  'APadel Spring Cup 2026',
  'The inaugural APadel Spring Cup at Gezira Sporting Club brought together 16 pairs from across Egypt. Ahmed Hassan and Mohamed Ali claimed the title in a decisive final-set tiebreak.',
  'Gezira Sporting Club, Zamalek', 'Artificial Grass',
  4, 16, 400, 15000, 7500, 4000, 2000,
  '2026-04-10', '2026-04-11', null,
  'completed',
  'https://images.pexels.com/photos/35248470/pexels-photo-35248470.jpeg?auto=compress&cs=tinysrgb&w=1200'
)
on conflict (id) do nothing;

-- ─── Champions (Spring Cup) ───────────────────────────────
insert into public.tournament_champions
  (tournament_id, position, player1_name, player2_name, image_url)
values
  ('b1000000-0000-0000-0000-000000000003', 1, 'Ahmed Hassan',  'Mohamed Ali',   'https://images.pexels.com/photos/35248470/pexels-photo-35248470.jpeg?auto=compress&cs=tinysrgb&w=800'),
  ('b1000000-0000-0000-0000-000000000003', 2, 'Karim Sherif',  'Omar Farouk',   'https://images.pexels.com/photos/35248254/pexels-photo-35248254.jpeg?auto=compress&cs=tinysrgb&w=800'),
  ('b1000000-0000-0000-0000-000000000003', 3, 'Youssef Nabil', 'Tarek Ibrahim', 'https://images.pexels.com/photos/34079998/pexels-photo-34079998.jpeg?auto=compress&cs=tinysrgb&w=800')
on conflict (tournament_id, position) do update set
  image_url = excluded.image_url;

-- ─── Announcements ────────────────────────────────────────
insert into public.announcements (title, body, is_published) values
(
  'Alexandria Open 2026 — Registrations Are Live',
  'Registrations for the APadel Alexandria Open 2026 are officially open. Smouha Club, July 18–19. EGP 20,000 in prizes. Only 16 team spots — register before July 13th.',
  true
),
(
  'Spring Cup Results — Hassan & Ali Take the Title',
  'Ahmed Hassan and Mohamed Ali won the inaugural APadel Spring Cup at Gezira Sporting Club, defeating Karim Sherif and Omar Farouk in a tight three-set final. Full rankings are live.',
  true
),
(
  'Ranking System Now Live',
  'Players earn 15 points per match win, 50 bonus points for a tournament title, and 25 for runner-up. Rankings update automatically after each result.',
  true
);

-- ─── Done ─────────────────────────────────────────────────
-- Verify counts:
select 'auth.users'          as tbl, count(*) from auth.users           where email like '%apadel%' or email = 'ammaralkadyy@gmail.com'
union all
select 'profiles',                    count(*) from public.profiles
union all
select 'player_stats',                count(*) from public.player_stats
union all
select 'tournaments',                 count(*) from public.tournaments
union all
select 'announcements',               count(*) from public.announcements;
