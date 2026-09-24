-- ============================================================
-- APadel — ONE-TIME CLEAN RESET
-- Run this ONCE in the Supabase SQL Editor, then run schema.sql.
-- Safe in setup (no real data). It drops only APadel's own objects;
-- it never touches auth.users data, the auth schema, or extensions.
-- ============================================================

-- 1) Trigger on auth.users must be dropped explicitly (the table below
--    is NOT dropped, so cascade won't remove it).
drop trigger if exists on_auth_user_created on auth.users;

-- 2) Drop every app table. CASCADE also removes their policies, indexes,
--    foreign keys, and the triggers attached to them
--    (on_match_completed, on_reg_approved, on_final_completed).
drop table if exists
  public.tournament_champions,
  public.matches,
  public.player_stats,
  public.registrations,
  public.tournament_rules,
  public.rule_templates,
  public.tournaments,
  public.announcements,
  public.contact_submissions,
  public.contact_info,
  public.sponsors,
  public.point_config,
  public.profiles
cascade;

-- 3) Functions live independently of tables — drop them explicitly.
drop function if exists public.get_my_role()              cascade;
drop function if exists public.is_organizer_or_above()    cascade;
drop function if exists public.is_organizer_l2_or_above() cascade;
drop function if exists public.is_admin()                 cascade;
drop function if exists public.handle_new_user()          cascade;
drop function if exists public.update_stats_on_match()    cascade;
drop function if exists public.on_registration_approved() cascade;
drop function if exists public.handle_final_completion()  cascade;

-- Done. Now run schema.sql — it will build everything fresh and clean.
