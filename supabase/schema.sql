-- ==============================================================================
-- ZERO-KNOWLEDGE END-TO-END ENCRYPTED MESSAGING SCHEMA FOR SUPABASE
-- ==============================================================================
-- Security Guarantee:
-- The database ONLY receives and stores AES-256-GCM ciphertexts, IVs, AAD digests,
-- and routing metadata. No plaintext messages or URLs are EVER stored in Supabase.
-- ==============================================================================

-- 1. Create table for persistent wire messages
create table if not exists public.wire_messages (
  id text primary key,
  sender_id text not null,
  recipient_id text not null,
  encrypted_payload jsonb not null,
  timestamp bigint not null,
  status text not null default 'delivered',
  disappearing_duration integer,
  expires_at bigint,
  view_once boolean default false,
  is_burned boolean default false,
  is_pinned boolean default false,
  security_type text default 'standard',
  media_type text,
  media_url text,
  reactions jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

-- 2. Indexes for fast retrieval and query filtering
create index if not exists idx_wire_messages_recipient on public.wire_messages(recipient_id);
create index if not exists idx_wire_messages_sender on public.wire_messages(sender_id);
create index if not exists idx_wire_messages_timestamp on public.wire_messages(timestamp asc);
create index if not exists idx_wire_messages_expires_at on public.wire_messages(expires_at) where expires_at is not null;

-- 3. Create table for public key directory (ECDH P-256 Identity Key distribution)
create table if not exists public.public_keys (
  user_id text primary key,
  key_rotation_version integer default 1,
  fingerprint text not null,
  public_key_spki text,
  updated_at timestamp with time zone default now()
);

-- 4. Enable Row Level Security (RLS)
alter table public.wire_messages enable row level security;
alter table public.public_keys enable row level security;

-- 5. Policies allowing anonymous/authenticated messaging clients to read & write encrypted envelopes
-- (Wire envelopes are 100% end-to-end encrypted with AES-256-GCM; database cannot inspect contents)
drop policy if exists "Allow read wire messages" on public.wire_messages;
create policy "Allow read wire messages"
  on public.wire_messages for select
  using (true);

drop policy if exists "Allow insert wire messages" on public.wire_messages;
create policy "Allow insert wire messages"
  on public.wire_messages for insert
  with check (true);

drop policy if exists "Allow update wire messages" on public.wire_messages;
create policy "Allow update wire messages"
  on public.wire_messages for update
  using (true);

drop policy if exists "Allow delete wire messages" on public.wire_messages;
create policy "Allow delete wire messages"
  on public.wire_messages for delete
  using (true);

-- Public key directory policies
drop policy if exists "Allow read public keys" on public.public_keys;
create policy "Allow read public keys"
  on public.public_keys for select
  using (true);

drop policy if exists "Allow upsert public keys" on public.public_keys;
create policy "Allow upsert public keys"
  on public.public_keys for all
  using (true)
  with check (true);

-- 6. Create table for custom user accounts (PIN & Biometric status)
create table if not exists public.user_accounts (
  id text primary key,
  username text unique not null,
  name text,
  avatar text,
  has_pin boolean default false,
  biometric_enabled boolean default false,
  biometric_credential_id text,
  created_at timestamp with time zone default now()
);

alter table public.user_accounts enable row level security;

drop policy if exists "Allow all for user_accounts" on public.user_accounts;
create policy "Allow all for user_accounts"
  on public.user_accounts for all
  using (true)
  with check (true);

-- 7. Enable Realtime Replication for instant push notifications
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'wire_messages'
  ) then
    alter publication supabase_realtime add table public.wire_messages;
  end if;
end $$;

-- 8. Firebase Cloud Messaging device token registry
-- Push tokens are routing metadata only. Message bodies remain end-to-end encrypted
-- and are never stored or included in push payloads.
create table if not exists public.push_tokens (
  token text primary key,
  user_id text not null,
  platform text not null default 'web',
  last_seen_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

create index if not exists idx_push_tokens_user_id on public.push_tokens(lower(user_id));
create index if not exists idx_push_tokens_last_seen on public.push_tokens(last_seen_at desc);

alter table public.push_tokens enable row level security;

-- No anon/authenticated policies are intentionally created. The Next.js server
-- accesses this table through the Postgres pool or Supabase service role only.

-- 9. Durable push dispatch dedupe log (one row per message id, claimed once)
create table if not exists public.push_dispatch_log (
  message_id text primary key,
  sent_at timestamp with time zone not null default now()
);

alter table public.push_dispatch_log enable row level security;
