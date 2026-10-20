-- Milestone 2B.3: private screenshot evidence prepared for seller review.
-- This file is intentionally unapplied by the implementation task.

create type public.payment_evidence_status as enum ('pending_review', 'rejected');

create table public.payment_evidence (
  id uuid primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_id uuid,
  storage_object_path text not null,
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  extracted jsonb not null,
  seller_reviewed jsonb not null,
  status public.payment_evidence_status not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision integer not null default 0 check (revision >= 0),
  unique (shop_id, id),
  foreign key (shop_id, order_id) references public.orders(shop_id, id) on delete set null (order_id),
  check (storage_object_path ~ ('^' || shop_id::text || '/' || id::text || '/[a-f0-9]{64}\.(jpg|png|webp)$'))
);

create index payment_evidence_shop_idx on public.payment_evidence(shop_id, updated_at desc);
create index payment_evidence_hash_idx on public.payment_evidence(shop_id, sha256);
create index payment_evidence_reference_idx on public.payment_evidence(
  shop_id,
  lower(nullif(btrim(seller_reviewed ->> 'provider'), '')),
  lower(nullif(btrim(seller_reviewed ->> 'transaction_reference'), ''))
);

create table public.payment_evidence_events (
  id bigint generated always as identity primary key,
  shop_id uuid not null,
  evidence_id uuid not null,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('created', 'updated', 'rejected')),
  before_order_id uuid,
  after_order_id uuid,
  before_status public.payment_evidence_status,
  after_status public.payment_evidence_status not null,
  before_revision integer check (before_revision is null or before_revision >= 0),
  after_revision integer not null check (after_revision >= 0),
  before_reviewed jsonb,
  after_reviewed jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (shop_id, evidence_id) references public.payment_evidence(shop_id, id) on delete cascade
);

create index payment_evidence_events_lookup_idx on public.payment_evidence_events(shop_id, evidence_id, after_revision, created_at);

create function private.payment_evidence_json_valid(value jsonb)
returns boolean
language sql
immutable
security definer
set search_path = ''
as $$
  select jsonb_typeof(value) = 'object'
    and (value ?& array[
      'amount_mmk', 'transaction_reference', 'provider', 'transaction_date',
      'transaction_time', 'transaction_time_uncertain', 'payer_name', 'payee_name',
      'missing_fields', 'uncertain_fields'
    ])
    and (value - array[
      'amount_mmk', 'transaction_reference', 'provider', 'transaction_date',
      'transaction_time', 'transaction_time_uncertain', 'payer_name', 'payee_name',
      'missing_fields', 'uncertain_fields'
    ]) = '{}'::jsonb
    and jsonb_typeof(value->'amount_mmk') in ('number', 'null')
    and (value->'amount_mmk' is null or value->'amount_mmk' = 'null'::jsonb or (
      (value->>'amount_mmk')::numeric between 0 and 9007199254740991
      and (value->>'amount_mmk')::numeric = trunc((value->>'amount_mmk')::numeric)
    ))
    and jsonb_typeof(value->'transaction_reference') in ('string', 'null')
    and jsonb_typeof(value->'provider') in ('string', 'null')
    and jsonb_typeof(value->'transaction_date') in ('string', 'null')
    and (value->'transaction_date' = 'null'::jsonb or (value->>'transaction_date' ~ '^\d{4}-\d{2}-\d{2}$' and to_char(to_date(value->>'transaction_date', 'YYYY-MM-DD'), 'YYYY-MM-DD') = value->>'transaction_date'))
    and jsonb_typeof(value->'transaction_time') in ('string', 'null')
    and (value->'transaction_time' = 'null'::jsonb or value->>'transaction_time' ~ '^\d{2}:\d{2}(:\d{2})?$')
    and jsonb_typeof(value->'transaction_time_uncertain') = 'boolean'
    and jsonb_typeof(value->'payer_name') in ('string', 'null')
    and jsonb_typeof(value->'payee_name') in ('string', 'null')
    and jsonb_typeof(value->'missing_fields') = 'array'
    and jsonb_array_length(value->'missing_fields') <= 24
    and jsonb_typeof(value->'uncertain_fields') = 'array'
    and jsonb_array_length(value->'uncertain_fields') <= 24
    and not exists (select 1 from jsonb_array_elements(value->'missing_fields') as field where jsonb_typeof(field) <> 'string' or char_length(btrim(field #>> '{}')) not between 1 and 80)
    and not exists (select 1 from jsonb_array_elements(value->'uncertain_fields') as field where jsonb_typeof(field) <> 'string' or char_length(btrim(field #>> '{}')) not between 1 and 80)
    and (value->'transaction_reference' = 'null'::jsonb or char_length(btrim(value->>'transaction_reference')) between 1 and 160)
    and (value->'provider' = 'null'::jsonb or char_length(btrim(value->>'provider')) between 1 and 80)
    and (value->'payer_name' = 'null'::jsonb or char_length(btrim(value->>'payer_name')) between 1 and 160)
    and (value->'payee_name' = 'null'::jsonb or char_length(btrim(value->>'payee_name')) between 1 and 160)
$$;
revoke all on function private.payment_evidence_json_valid(jsonb) from public, anon, authenticated;

create function private.prevent_payment_evidence_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Evidence events are append-only' using errcode = '42501';
end;
$$;
revoke all on function private.prevent_payment_evidence_event_mutation() from public, anon, authenticated;
create trigger payment_evidence_events_immutable
before update or delete on public.payment_evidence_events
for each row execute function private.prevent_payment_evidence_event_mutation();

alter table public.payment_evidence enable row level security;
alter table public.payment_evidence_events enable row level security;
revoke all on table public.payment_evidence, public.payment_evidence_events from anon, authenticated;
grant select on table public.payment_evidence, public.payment_evidence_events to authenticated;

create policy "Members read payment evidence"
on public.payment_evidence for select to authenticated
using (shop_id in (select private.current_user_shop_ids()));

create policy "Members read payment evidence events"
on public.payment_evidence_events for select to authenticated
using (shop_id in (select private.current_user_shop_ids()));

-- This explicit reconciliation is security-sensitive: if a bucket with this id already exists,
-- applying the migration intentionally changes its privacy, size limit, and MIME allowlist.
-- Review that existing bucket before deployment; this task does not apply the migration remotely.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-evidence', 'payment-evidence', false, 8388608, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = excluded.allowed_mime_types;

create policy "Members upload shop evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-evidence'
  and (storage.foldername(name))[1] in (select private.current_user_shop_ids()::text)
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[a-f0-9]{64}\.(jpg|png|webp)$'
);

create policy "Members read shop evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-evidence'
  and (storage.foldername(name))[1] in (select private.current_user_shop_ids()::text)
);

create function public.save_payment_evidence_review(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
  v_id uuid;
  v_order uuid;
  v_status public.payment_evidence_status;
  v_expected_revision integer;
  v_path text;
  v_hash text;
  v_existing public.payment_evidence;
  v_action text;
  v_after_revision integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' then raise exception 'Evidence input required' using errcode = '22023'; end if;
  if not (p_input ?& array[
    'shop_id', 'evidence_id', 'order_id', 'status', 'expected_revision',
    'extraction', 'seller_reviewed', 'storage_object_path', 'sha256'
  ]) or (p_input - array[
    'shop_id', 'evidence_id', 'order_id', 'status', 'expected_revision',
    'extraction', 'seller_reviewed', 'storage_object_path', 'sha256'
  ]) <> '{}'::jsonb then raise exception 'Invalid evidence fields' using errcode = '22023'; end if;

  begin
    v_shop := (p_input->>'shop_id')::uuid;
    v_id := (p_input->>'evidence_id')::uuid;
    v_order := nullif(p_input->>'order_id', '')::uuid;
    v_status := (p_input->>'status')::public.payment_evidence_status;
    v_expected_revision := (p_input->>'expected_revision')::integer;
  exception when others then
    raise exception 'Invalid evidence identity or status' using errcode = '22023';
  end;
  v_path := p_input->>'storage_object_path';
  v_hash := p_input->>'sha256';
  if v_shop is null or v_id is null or v_status is null or v_expected_revision is null or v_expected_revision < 0 or v_expected_revision > 1000000 or
     v_path is null or v_hash is null or v_hash !~ '^[a-f0-9]{64}$' or
     v_path !~ ('^' || v_shop::text || '/' || v_id::text || '/[a-f0-9]{64}\.(jpg|png|webp)$') or
     coalesce(not private.payment_evidence_json_valid(p_input->'extraction'), true) or
     coalesce(not private.payment_evidence_json_valid(p_input->'seller_reviewed'), true) then
    raise exception 'Invalid evidence values' using errcode = '22023';
  end if;
  if not exists (select 1 from public.shop_memberships where shop_id = v_shop and user_id = auth.uid()) then
    raise exception 'Shop access denied' using errcode = '42501';
  end if;
  if v_order is not null and not exists (
    select 1 from public.orders
    where shop_id = v_shop and id = v_order and order_status = 'confirmed' and payment_status in ('unpaid', 'partially_paid')
  ) then
    raise exception 'Order is not eligible for pending evidence review' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'payment-evidence' and name = v_path) then
    raise exception 'Private evidence object is missing' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into v_existing from public.payment_evidence where id = v_id for update;
  if found then
    if v_existing.shop_id <> v_shop or v_existing.storage_object_path <> v_path or v_existing.sha256 <> v_hash then
      raise exception 'Evidence identity is immutable' using errcode = '42501';
    end if;
    if v_existing.extracted <> p_input->'extraction' then
      raise exception 'Original extraction is immutable' using errcode = '42501';
    end if;
    if v_expected_revision = 0 and
       v_existing.order_id is not distinct from v_order and v_existing.status = v_status and
       v_existing.seller_reviewed = p_input->'seller_reviewed' then
      return v_id;
    end if;
    if v_existing.revision <> v_expected_revision then raise exception 'Evidence changed. Reload before saving.' using errcode = '40001'; end if;
    v_after_revision := v_existing.revision + 1;
    update public.payment_evidence
    set order_id = v_order, status = v_status, seller_reviewed = p_input->'seller_reviewed', revision = v_after_revision, updated_at = clock_timestamp()
    where id = v_id and shop_id = v_shop;
    v_action := case when v_status = 'rejected' then 'rejected' else 'updated' end;
    insert into public.payment_evidence_events(
      shop_id, evidence_id, actor_id, action, before_order_id, after_order_id,
      before_status, after_status, before_revision, after_revision, before_reviewed, after_reviewed
    )
    values (
      v_shop, v_id, auth.uid(), v_action, v_existing.order_id, v_order,
      v_existing.status, v_status, v_existing.revision, v_after_revision,
      v_existing.seller_reviewed, p_input->'seller_reviewed'
    );
  else
    if v_expected_revision <> 0 then raise exception 'Evidence unavailable. Reload before saving.' using errcode = '40001'; end if;
    insert into public.payment_evidence(id, shop_id, order_id, storage_object_path, sha256, extracted, seller_reviewed, status, created_by)
    values (v_id, v_shop, v_order, v_path, v_hash, p_input->'extraction', p_input->'seller_reviewed', v_status, auth.uid());
    insert into public.payment_evidence_events(
      shop_id, evidence_id, actor_id, action, before_order_id, after_order_id,
      before_status, after_status, before_revision, after_revision, before_reviewed, after_reviewed
    )
    values (
      v_shop, v_id, auth.uid(), case when v_status = 'rejected' then 'rejected' else 'created' end,
      null, v_order, null, v_status, null, 0, null, p_input->'seller_reviewed'
    );
  end if;
  return v_id;
end;
$$;
revoke all on function public.save_payment_evidence_review(jsonb) from public, anon;
grant execute on function public.save_payment_evidence_review(jsonb) to authenticated;
