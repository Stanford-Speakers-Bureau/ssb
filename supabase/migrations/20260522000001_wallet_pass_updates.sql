-- Apple Wallet remote pass updates (PassKit web service).
-- A wallet change marker on tickets, the device registration table the web
-- service writes to, and a tombstone table so cancelled (hard-deleted) tickets
-- can still serve a voided pass.

alter table tickets
  add column if not exists wallet_updated_at timestamptz;

create table if not exists wallet_registrations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  pass_type_id text not null,
  serial_number text not null,
  device_library_id text not null,
  push_token text not null
);

create unique index if not exists wallet_registrations_device_serial_unique
  on wallet_registrations (device_library_id, serial_number);
create index if not exists wallet_registrations_serial_idx
  on wallet_registrations (serial_number);
create index if not exists wallet_registrations_device_idx
  on wallet_registrations (device_library_id, pass_type_id);

create table if not exists wallet_voided_passes (
  id uuid primary key default gen_random_uuid(),
  voided_at timestamptz not null default now(),
  serial_number text not null,
  email text not null,
  name text,
  ticket_type text not null,
  event_id uuid
);

create unique index if not exists wallet_voided_passes_serial_unique
  on wallet_voided_passes (serial_number);
