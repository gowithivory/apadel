-- ============================================================
-- APadel — Complete Database Schema
-- Paste this entire file into Supabase SQL Editor and click Run.
-- ============================================================

-- ============================================================
-- PROFILES
-- One row per auth user. Created automatically via trigger.
-- ============================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text not null,
  email         text not null,
  phone         text,
  avatar_url    text,
  handedness    text check (handedness in ('right', 'left')),
  gender        text check (gender in ('male', 'female')),
  origin        text,
  role          text not null default 'player'
                  check (role in ('player', 'organizer_l1', 'organizer_l2', 'admin')),
  is_restricted boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Heal pre-existing installs: `create table if not exists` above does NOTHING
-- when the table already exists, so it never adds columns introduced in a later
-- schema version. Add any that are missing before the functions below reference
-- them. Each is a no-op on a fresh database.
alter table public.profiles add column if not exists phone         text;
alter table public.profiles add column if not exists avatar_url    text;
alter table public.profiles add column if not exists handedness    text;
alter table public.profiles add column if not exists gender        text;
alter table public.profiles add column if not exists origin        text;
alter table public.profiles add column if not exists role          text not null default 'player';
alter table public.profiles add column if not exists is_restricted boolean not null default false;
alter table public.profiles add column if not exists created_at    timestamptz not null default now();
alter table public.profiles add column if not exists updated_at    timestamptz not null default now();

alter table public.profiles enable row level security;

-- ============================================================
-- HELPER FUNCTIONS (used in RLS policies — defined after profiles table)
-- ============================================================

create or replace function public.get_my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_organizer_or_above()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('organizer_l1', 'organizer_l2', 'admin')
      and is_restricted = false
  )
$$;

create or replace function public.is_organizer_l2_or_above()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('organizer_l2', 'admin')
      and is_restricted = false
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role = 'admin'
  )
$$;

-- ============================================================
-- POINT CONFIGURATION
-- Singleton (id = 1). Controls how many points each action awards.
-- ============================================================

create table if not exists public.point_config (
  id                     integer primary key default 1 check (id = 1),
  match_win_points       integer not null default 15,
  title_bonus_points     integer not null default 50,
  runner_up_bonus_points integer not null default 25,
  updated_at             timestamptz not null default now()
);

alter table public.point_config enable row level security;

insert into public.point_config (id) values (1) on conflict do nothing;

-- ============================================================
-- SPONSORS
-- Managed entirely from admin panel. Displayed on homepage.
-- ============================================================

create table if not exists public.sponsors (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  sponsor_type text not null default 'Partner',
  logo_url     text,
  website_url  text,
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

alter table public.sponsors enable row level security;

-- ============================================================
-- CONTACT INFO
-- Singleton (id = 1). Editable from admin panel.
-- ============================================================

create table if not exists public.contact_info (
  id         integer primary key default 1 check (id = 1),
  whatsapp   text,
  instagram  text,
  facebook   text,
  email      text,
  location   text,
  updated_at timestamptz not null default now()
);

alter table public.contact_info enable row level security;

insert into public.contact_info (id, whatsapp, instagram, email, location)
values (1, '+20 100 000 0000', '@apadel.egypt', 'info@apadel.com', 'Cairo, Egypt')
on conflict do nothing;

-- ============================================================
-- CONTACT SUBMISSIONS
-- Form submissions from the contact page. Admin can view.
-- ============================================================

create table if not exists public.contact_submissions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null,
  phone      text,
  subject    text not null,
  message    text not null,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.contact_submissions enable row level security;

-- ============================================================
-- TOURNAMENTS
-- Full tournament configuration including prizes and point bonuses.
-- ============================================================

create table if not exists public.tournaments (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null,
  description                text,
  location                   text not null,
  format                     text not null default 'group_knockout'
                               check (format in ('group_knockout','single_elimination','round_robin')),
  surface                    text,
  num_courts                 integer not null default 4,
  max_teams                  integer not null default 24,
  entry_fee                  numeric not null default 0,
  prize_pool                 numeric not null default 0,
  -- Prize per placement (cash or cashback % of entry fee)
  first_place_cash           numeric,
  first_place_cashback_pct   numeric,
  second_place_cash          numeric,
  second_place_cashback_pct  numeric,
  third_place_cash           numeric,
  third_place_cashback_pct   numeric,
  fourth_place_cash          numeric,
  fourth_place_cashback_pct  numeric,
  -- Point bonuses (override global point_config if set)
  title_bonus_points         integer,
  runner_up_bonus_points     integer,
  -- Media
  image_url                  text,
  -- Scheduling
  start_date                 date not null,
  end_date                   date not null,
  registration_deadline      date,
  -- Status lifecycle: upcoming → registration_open → ongoing → completed
  status                     text not null default 'upcoming'
                               check (status in ('upcoming','registration_open','ongoing','completed','cancelled')),
  created_by                 uuid references public.profiles(id) on delete set null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

alter table public.tournaments enable row level security;

-- ============================================================
-- RULE TEMPLATES
-- Reusable rules. Organizers can pick from these when creating tournaments.
-- ============================================================

create table if not exists public.rule_templates (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  rule_text   text not null,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.rule_templates enable row level security;

-- ============================================================
-- TOURNAMENT RULES
-- Per-tournament ordered rules list.
-- ============================================================

create table if not exists public.tournament_rules (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  rule_text     text not null,
  sort_order    integer not null default 0
);

alter table public.tournament_rules enable row level security;

-- ============================================================
-- REGISTRATIONS
-- Team registrations. Two players per team.
-- ============================================================

create table if not exists public.registrations (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null references public.tournaments(id) on delete cascade,
  player1_id          uuid not null references public.profiles(id) on delete cascade,
  player2_id          uuid references public.profiles(id) on delete set null,
  player1_name        text not null,
  player2_name        text,
  phone               text,
  payment_receipt_url text,
  status              text not null default 'pending'
                        check (status in ('pending','approved','rejected')),
  seed                integer,
  group_name          text,
  join_code           text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.registrations enable row level security;

-- A team join code lets a second player claim the open player2 slot.
-- (Heal pre-existing tables + a unique index; both no-ops on a fresh DB.)
alter table public.registrations add column if not exists join_code text;
create unique index if not exists idx_registrations_join_code
  on public.registrations(join_code) where join_code is not null;

-- ============================================================
-- PLAYER STATS
-- One row per player. Maintained by triggers — never write manually.
-- ============================================================

create table if not exists public.player_stats (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null unique references public.profiles(id) on delete cascade,
  total_points       integer not null default 0,
  wins               integer not null default 0,
  losses             integer not null default 0,
  titles             integer not null default 0,
  tournaments_played integer not null default 0,
  updated_at         timestamptz not null default now()
);

alter table public.player_stats enable row level security;

-- ============================================================
-- MATCHES
-- One row per scheduled match in a tournament.
-- ============================================================

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round         integer not null,
  match_number  integer not null,
  phase         text not null default 'group'
                  check (phase in ('group','quarter_final','semi_final','final','third_place')),
  group_name    text,
  team1_reg_id  uuid references public.registrations(id) on delete set null,
  team2_reg_id  uuid references public.registrations(id) on delete set null,
  winner_reg_id uuid references public.registrations(id) on delete set null,
  score         text,
  status        text not null default 'scheduled'
                  check (status in ('scheduled','ongoing','completed','bye')),
  played_at     timestamptz,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tournament_id, round, match_number)
);

alter table public.matches enable row level security;

-- ============================================================
-- TOURNAMENT CHAMPIONS
-- Auto-populated when a tournament's final match is completed.
-- ============================================================

create table if not exists public.tournament_champions (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references public.tournaments(id) on delete cascade,
  registration_id uuid references public.registrations(id) on delete set null,
  position        integer not null check (position in (1,2,3,4)),
  player1_name    text not null,
  player2_name    text,
  image_url       text,
  created_at      timestamptz not null default now(),
  unique (tournament_id, position)
);

alter table public.tournament_champions enable row level security;

-- ============================================================
-- ANNOUNCEMENTS
-- Created by organizer_l2 and admin. Published ones shown publicly.
-- ============================================================

create table if not exists public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  is_published boolean not null default true,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_profiles_role       on public.profiles(role);
create index if not exists idx_profiles_gender     on public.profiles(gender);
create index if not exists idx_tournaments_status  on public.tournaments(status);
create index if not exists idx_tournaments_date    on public.tournaments(start_date);
create index if not exists idx_regs_tournament     on public.registrations(tournament_id);
create index if not exists idx_regs_player1        on public.registrations(player1_id);
create index if not exists idx_regs_player2        on public.registrations(player2_id);
create index if not exists idx_regs_status         on public.registrations(status);
create index if not exists idx_matches_tournament  on public.matches(tournament_id);
create index if not exists idx_matches_phase       on public.matches(phase);
create index if not exists idx_stats_points        on public.player_stats(total_points desc);
create index if not exists idx_announce_published  on public.announcements(is_published, created_at desc);

-- ============================================================
-- TRIGGER: Create profile when user signs up
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, email, avatar_url,
    handedness, gender, origin, phone, role
  ) values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'handedness',
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'origin',
    new.raw_user_meta_data->>'phone',
    'player'
  );

  insert into public.player_stats (player_id)
  values (new.id)
  on conflict (player_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGER: Update player stats when a non-final match completes
-- ============================================================

create or replace function public.update_stats_on_match()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_pts         integer;
  v_w1          uuid; v_w2 uuid;
  v_loser_id    uuid;
  v_l1          uuid; v_l2 uuid;
begin
  if new.status = 'completed'
     and new.winner_reg_id is not null
     and new.phase != 'final'
     and (old.status is distinct from 'completed' or old.winner_reg_id is distinct from new.winner_reg_id)
  then
    select match_win_points into v_pts from public.point_config where id = 1;
    v_pts := coalesce(v_pts, 15);

    select player1_id, player2_id into v_w1, v_w2
    from public.registrations where id = new.winner_reg_id;

    v_loser_id := case
      when new.winner_reg_id = new.team1_reg_id then new.team2_reg_id
      else new.team1_reg_id
    end;

    if v_loser_id is not null then
      select player1_id, player2_id into v_l1, v_l2
      from public.registrations where id = v_loser_id;
    end if;

    -- Winners: add points and a win
    if v_w1 is not null then
      insert into public.player_stats (player_id, total_points, wins)
      values (v_w1, v_pts, 1)
      on conflict (player_id) do update set
        total_points = player_stats.total_points + v_pts,
        wins         = player_stats.wins + 1,
        updated_at   = now();
    end if;
    if v_w2 is not null then
      insert into public.player_stats (player_id, total_points, wins)
      values (v_w2, v_pts, 1)
      on conflict (player_id) do update set
        total_points = player_stats.total_points + v_pts,
        wins         = player_stats.wins + 1,
        updated_at   = now();
    end if;

    -- Losers: add a loss (no point change)
    if v_l1 is not null then
      insert into public.player_stats (player_id, losses)
      values (v_l1, 1)
      on conflict (player_id) do update set
        losses     = player_stats.losses + 1,
        updated_at = now();
    end if;
    if v_l2 is not null then
      insert into public.player_stats (player_id, losses)
      values (v_l2, 1)
      on conflict (player_id) do update set
        losses     = player_stats.losses + 1,
        updated_at = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_match_completed on public.matches;
create trigger on_match_completed
  after update on public.matches
  for each row execute function public.update_stats_on_match();

-- ============================================================
-- TRIGGER: Increment tournaments_played when registration is approved
-- ============================================================

create or replace function public.on_registration_approved()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    if new.player1_id is not null then
      insert into public.player_stats (player_id, tournaments_played)
      values (new.player1_id, 1)
      on conflict (player_id) do update set
        tournaments_played = player_stats.tournaments_played + 1,
        updated_at         = now();
    end if;
    if new.player2_id is not null then
      insert into public.player_stats (player_id, tournaments_played)
      values (new.player2_id, 1)
      on conflict (player_id) do update set
        tournaments_played = player_stats.tournaments_played + 1,
        updated_at         = now();
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_reg_approved on public.registrations;
create trigger on_reg_approved
  after update on public.registrations
  for each row execute function public.on_registration_approved();

-- ============================================================
-- TRIGGER: Handle final match — award title, mark tournament complete
-- ============================================================

create or replace function public.handle_final_completion()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_title_pts  integer;
  v_ru_pts     integer;
  v_win_pts    integer;
  v_w1         uuid; v_w2 uuid;
  v_ru_id      uuid;
  v_r1         uuid; v_r2 uuid;
begin
  if new.status = 'completed'
     and new.winner_reg_id is not null
     and new.phase = 'final'
     and (old.status is distinct from 'completed' or old.winner_reg_id is distinct from new.winner_reg_id)
  then
    -- Resolve point values
    select
      coalesce(t.title_bonus_points, pc.title_bonus_points, 50),
      coalesce(t.runner_up_bonus_points, pc.runner_up_bonus_points, 25),
      pc.match_win_points
    into v_title_pts, v_ru_pts, v_win_pts
    from public.tournaments t
    cross join public.point_config pc
    where t.id = new.tournament_id and pc.id = 1;
    v_win_pts := coalesce(v_win_pts, 15);

    -- Mark tournament completed
    update public.tournaments
    set status = 'completed', updated_at = now()
    where id = new.tournament_id;

    -- Winner players
    select player1_id, player2_id into v_w1, v_w2
    from public.registrations where id = new.winner_reg_id;

    -- Runner-up registration
    v_ru_id := case
      when new.winner_reg_id = new.team1_reg_id then new.team2_reg_id
      else new.team1_reg_id
    end;

    if v_ru_id is not null then
      select player1_id, player2_id into v_r1, v_r2
      from public.registrations where id = v_ru_id;
    end if;

    -- Award champion: match win + title bonus + title count
    if v_w1 is not null then
      insert into public.player_stats (player_id, total_points, wins, titles)
      values (v_w1, v_win_pts + v_title_pts, 1, 1)
      on conflict (player_id) do update set
        total_points = player_stats.total_points + v_win_pts + v_title_pts,
        wins         = player_stats.wins + 1,
        titles       = player_stats.titles + 1,
        updated_at   = now();
    end if;
    if v_w2 is not null then
      insert into public.player_stats (player_id, total_points, wins, titles)
      values (v_w2, v_win_pts + v_title_pts, 1, 1)
      on conflict (player_id) do update set
        total_points = player_stats.total_points + v_win_pts + v_title_pts,
        wins         = player_stats.wins + 1,
        titles       = player_stats.titles + 1,
        updated_at   = now();
    end if;

    -- Award runner-up: loss + runner-up bonus
    if v_r1 is not null then
      insert into public.player_stats (player_id, total_points, losses)
      values (v_r1, v_ru_pts, 1)
      on conflict (player_id) do update set
        total_points = player_stats.total_points + v_ru_pts,
        losses       = player_stats.losses + 1,
        updated_at   = now();
    end if;
    if v_r2 is not null then
      insert into public.player_stats (player_id, total_points, losses)
      values (v_r2, v_ru_pts, 1)
      on conflict (player_id) do update set
        total_points = player_stats.total_points + v_ru_pts,
        losses       = player_stats.losses + 1,
        updated_at   = now();
    end if;

    -- Record 1st place champion
    insert into public.tournament_champions
      (tournament_id, registration_id, position, player1_name, player2_name)
    select new.tournament_id, new.winner_reg_id, 1, r.player1_name, r.player2_name
    from public.registrations r where r.id = new.winner_reg_id
    on conflict (tournament_id, position) do update set
      registration_id = excluded.registration_id,
      player1_name    = excluded.player1_name,
      player2_name    = excluded.player2_name;

    -- Record 2nd place
    if v_ru_id is not null then
      insert into public.tournament_champions
        (tournament_id, registration_id, position, player1_name, player2_name)
      select new.tournament_id, v_ru_id, 2, r.player1_name, r.player2_name
      from public.registrations r where r.id = v_ru_id
      on conflict (tournament_id, position) do update set
        registration_id = excluded.registration_id,
        player1_name    = excluded.player1_name,
        player2_name    = excluded.player2_name;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_final_completed on public.matches;
create trigger on_final_completed
  after update on public.matches
  for each row execute function public.handle_final_completion();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- profiles
create policy "profiles_read_all"     on public.profiles for select to public using (true);
create policy "profiles_insert_own"   on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own"   on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    (id = auth.uid() and coalesce((select role from public.profiles where id = auth.uid()), 'player') =
      case when id = auth.uid() then coalesce((select role from public.profiles where id = auth.uid()), 'player') else role end)
    or public.is_admin()
  );
create policy "profiles_delete_admin" on public.profiles for delete to authenticated using (public.is_admin());

-- point_config
create policy "pc_read_all"    on public.point_config for select to public using (true);
create policy "pc_update_admin" on public.point_config for update to authenticated using (public.is_admin());

-- sponsors
create policy "sponsors_read_all"    on public.sponsors for select to public using (true);
create policy "sponsors_insert_admin" on public.sponsors for insert to authenticated with check (public.is_admin());
create policy "sponsors_update_admin" on public.sponsors for update to authenticated using (public.is_admin());
create policy "sponsors_delete_admin" on public.sponsors for delete to authenticated using (public.is_admin());

-- contact_info
create policy "ci_read_all"        on public.contact_info for select to public using (true);
create policy "ci_update_org_l2"   on public.contact_info for update to authenticated using (public.is_organizer_l2_or_above());

-- contact_submissions
create policy "cs_insert_public"   on public.contact_submissions for insert to public with check (true);
create policy "cs_read_admin"      on public.contact_submissions for select to authenticated using (public.is_admin());
create policy "cs_update_admin"    on public.contact_submissions for update to authenticated using (public.is_admin());
create policy "cs_delete_admin"    on public.contact_submissions for delete to authenticated using (public.is_admin());

-- tournaments
create policy "t_read_all"         on public.tournaments for select to public using (true);
create policy "t_insert_org_l2"    on public.tournaments for insert to authenticated with check (public.is_organizer_l2_or_above());
create policy "t_update_org_l2"    on public.tournaments for update to authenticated using (public.is_organizer_l2_or_above());
create policy "t_delete_admin"     on public.tournaments for delete to authenticated using (public.is_admin());

-- rule_templates
create policy "rt_read_all"        on public.rule_templates for select to public using (true);
create policy "rt_insert_org_l2"   on public.rule_templates for insert to authenticated with check (public.is_organizer_l2_or_above());
create policy "rt_delete_admin"    on public.rule_templates for delete to authenticated using (public.is_admin());

-- tournament_rules
create policy "tr_read_all"        on public.tournament_rules for select to public using (true);
create policy "tr_insert_org_l2"   on public.tournament_rules for insert to authenticated with check (public.is_organizer_l2_or_above());
create policy "tr_update_org_l2"   on public.tournament_rules for update to authenticated using (public.is_organizer_l2_or_above());
create policy "tr_delete_org_l2"   on public.tournament_rules for delete to authenticated using (public.is_organizer_l2_or_above());

-- registrations
create policy "reg_read_public"    on public.registrations for select to public using (status = 'approved');
create policy "reg_read_own"       on public.registrations for select to authenticated
  using (player1_id = auth.uid() or player2_id = auth.uid() or public.is_organizer_or_above());
create policy "reg_insert_auth"    on public.registrations for insert to authenticated
  with check (
    player1_id = auth.uid()
    and not exists (select 1 from public.profiles where id = auth.uid() and is_restricted = true)
  );
create policy "reg_update_org"     on public.registrations for update to authenticated using (public.is_organizer_or_above());
-- Allow a player to claim the player2 slot on a registration using a join code
create policy "reg_update_join_code" on public.registrations for update to authenticated
  using (player2_id is null and join_code is not null)
  with check (player2_id = auth.uid());
create policy "reg_delete_org_l2"  on public.registrations for delete to authenticated using (public.is_organizer_l2_or_above());

-- player_stats
create policy "ps_read_all"        on public.player_stats for select to public using (true);
create policy "ps_insert_own"      on public.player_stats for insert to authenticated with check (player_id = auth.uid());
create policy "ps_update_org"      on public.player_stats for update to authenticated using (public.is_organizer_or_above());

-- matches
create policy "m_read_all"         on public.matches for select to public using (true);
create policy "m_insert_org"       on public.matches for insert to authenticated with check (public.is_organizer_or_above());
create policy "m_update_org"       on public.matches for update to authenticated using (public.is_organizer_or_above());
create policy "m_delete_org_l2"    on public.matches for delete to authenticated using (public.is_organizer_l2_or_above());

-- tournament_champions
create policy "tc_read_all"        on public.tournament_champions for select to public using (true);
create policy "tc_insert_org"      on public.tournament_champions for insert to authenticated with check (public.is_organizer_or_above());
create policy "tc_update_org"      on public.tournament_champions for update to authenticated using (public.is_organizer_or_above());
create policy "tc_delete_org_l2"   on public.tournament_champions for delete to authenticated using (public.is_organizer_l2_or_above());

-- announcements
create policy "a_read_published"   on public.announcements for select to public using (is_published = true);
create policy "a_read_org"         on public.announcements for select to authenticated using (public.is_organizer_or_above());
create policy "a_insert_org_l2"    on public.announcements for insert to authenticated with check (public.is_organizer_l2_or_above());
create policy "a_update_org_l2"    on public.announcements for update to authenticated using (public.is_organizer_l2_or_above());
create policy "a_delete_admin"     on public.announcements for delete to authenticated using (public.is_admin());

-- ============================================================
-- STORAGE BUCKET
-- ============================================================

insert into storage.buckets (id, name, public)
values ('padel-images', 'padel-images', true)
on conflict (id) do nothing;

-- Drop any existing storage policies to avoid conflicts
drop policy if exists "storage_read_public"      on storage.objects;
drop policy if exists "storage_insert_auth"      on storage.objects;
drop policy if exists "storage_insert_avatars"   on storage.objects;
drop policy if exists "storage_update_auth"      on storage.objects;
drop policy if exists "storage_delete_auth"      on storage.objects;

create policy "storage_read_public" on storage.objects
  for select to public using (bucket_id = 'padel-images');

create policy "storage_insert_auth" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'padel-images');

-- Allow unauthenticated to upload avatars during registration
create policy "storage_insert_avatars" on storage.objects
  for insert to public
  with check (bucket_id = 'padel-images' and (storage.foldername(name))[1] = 'avatars');

create policy "storage_update_auth" on storage.objects
  for update to authenticated using (bucket_id = 'padel-images');

create policy "storage_delete_auth" on storage.objects
  for delete to authenticated using (bucket_id = 'padel-images');
