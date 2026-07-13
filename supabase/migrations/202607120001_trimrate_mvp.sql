-- TrimRate backend MVP. Review this schema and retention policy before production launch.
create extension if not exists pgcrypto;

create table if not exists public.market_rates (
  id uuid primary key default gen_random_uuid(),
  bank_name text not null,
  fixed_term integer not null check (fixed_term >= 0),
  rate numeric(5,3) not null check (rate >= 0 and rate <= 30),
  rate_type text not null default 'special',
  source_url text not null default '',
  source_date date,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists market_rates_fetched_at_idx on public.market_rates (fetched_at desc);

create table if not exists public.market_rate_snapshots (
  id uuid primary key default gen_random_uuid(),
  fixed_term integer not null check (fixed_term >= 0),
  average_rate numeric(5,3) not null check (average_rate >= 0 and average_rate <= 30),
  bank_count integer not null check (bank_count >= 0),
  included_banks jsonb not null default '[]'::jsonb,
  snapshot_date date not null,
  created_at timestamptz not null default now()
);
create index if not exists market_rate_snapshots_latest_idx on public.market_rate_snapshots (snapshot_date desc, fixed_term);

create table if not exists public.ocr_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_url text not null,
  source_date date not null,
  current_ocr numeric(5,3) not null check (current_ocr >= 0 and current_ocr <= 30),
  forecast_points jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists ocr_snapshots_latest_idx on public.ocr_snapshots (source_date desc, fetched_at desc);

create table if not exists public.adviser_review_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  phone text not null,
  preferred_contact_method text not null default '',
  consent_given boolean not null check (consent_given),
  loan_details jsonb not null default '{}'::jsonb,
  calculated_summary jsonb not null default '{}'::jsonb,
  market_comparison jsonb not null default '{}'::jsonb,
  ocr_forecast_summary jsonb not null default '{}'::jsonb,
  user_notes text not null default '',
  referral_status text not null default 'new'
);
create index if not exists adviser_review_requests_created_idx on public.adviser_review_requests (created_at desc);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id text not null,
  event_name text not null,
  page_path text not null,
  step_number integer check (step_number between 1 and 6),
  step_name text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  device_type text not null default '',
  referrer text not null default ''
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);
create index if not exists analytics_events_session_idx on public.analytics_events (session_id);

alter table public.market_rates enable row level security;
alter table public.market_rate_snapshots enable row level security;
alter table public.ocr_snapshots enable row level security;
alter table public.adviser_review_requests enable row level security;
alter table public.analytics_events enable row level security;

-- No browser role policies: all data access is through Vercel Functions using the service role.
