-- Drop all old OptiMow tables if present
drop table if exists
  epos_session_events, epos_area_completions, epos_mowing_sessions,
  epos_data_snapshots, data_collection_gaps, area_completion_cycles,
  auto_resume_attempts, auto_resume_tracking, mower_profiles, auth_sessions
  cascade;

-- New schema
create table husqvarna_accounts (
  user_id       text primary key,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table mowers (
  id          text primary key,
  user_id     text not null references husqvarna_accounts(user_id) on delete cascade,
  name        text not null,
  auto_retry  boolean not null default true,
  created_at  timestamptz not null default now()
);
create index mowers_user_id_idx on mowers(user_id);

create table retry_state (
  mower_id            text primary key references mowers(id) on delete cascade,
  attempts_this_error int not null default 0,
  last_error_code     int,
  last_attempt_at     timestamptz,
  needs_manual_help   boolean not null default false,
  resolved_at         timestamptz
);

create table retry_log (
  id          bigint generated always as identity primary key,
  mower_id    text not null references mowers(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  error_code  int,
  outcome     text not null
);
create index retry_log_mower_idx on retry_log(mower_id, occurred_at desc);

-- Lock everything down: only service_role (used by Edge Functions) may touch these.
alter table husqvarna_accounts enable row level security;
alter table mowers            enable row level security;
alter table retry_state       enable row level security;
alter table retry_log         enable row level security;
-- No policies created => anon/authenticated get zero access; service_role bypasses RLS.
