begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

select ok(to_regtype('public.payment_evidence_status') is not null, 'evidence status enum exists');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_evidence'::regclass), 'evidence table has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.payment_evidence_events'::regclass), 'evidence events have RLS');
select ok(not has_table_privilege('authenticated', 'public.payment_evidence', 'INSERT'), 'authenticated clients cannot directly insert evidence');
select ok(not has_table_privilege('authenticated', 'public.payment_evidence', 'UPDATE'), 'authenticated clients cannot directly update evidence');
select ok(not has_table_privilege('authenticated', 'public.payment_evidence_events', 'INSERT'), 'authenticated clients cannot directly append events');
select ok(has_function_privilege('authenticated', 'public.save_payment_evidence_review(jsonb)', 'EXECUTE'), 'authenticated clients have only the narrow review RPC');
select is((select public from storage.buckets where id = 'payment-evidence'), false, 'evidence bucket is private');
select ok((select allowed_mime_types @> array['image/jpeg', 'image/png', 'image/webp']::text[] from storage.buckets where id = 'payment-evidence'), 'bucket allows only the reviewed image formats');

insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values
  ('a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'evidence-a@test.invalid', '{}', '{}'),
  ('b0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'evidence-b@test.invalid', '{}', '{}');
set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-4000-8000-000000000001';
select set_config('test.evidence_shop', public.create_shop_for_current_user('Evidence test shop')::text, true);
reset role;
insert into public.payment_evidence (id, shop_id, storage_object_path, sha256, extracted, seller_reviewed, status, created_by)
values (
  'c0000000-0000-4000-8000-000000000003', current_setting('test.evidence_shop')::uuid,
  current_setting('test.evidence_shop') || '/c0000000-0000-4000-8000-000000000003/' || repeat('a', 64) || '.png',
  repeat('a', 64),
  '{"amount_mmk":52000,"transaction_reference":"TX-1","provider":"KBZPay","transaction_date":"2026-10-21","transaction_time":"10:20:00","transaction_time_uncertain":false,"payer_name":"Thiri Mon","payee_name":null,"missing_fields":[],"uncertain_fields":[]}',
  '{"amount_mmk":52000,"transaction_reference":"TX-1","provider":"KBZPay","transaction_date":"2026-10-21","transaction_time":"10:20:00","transaction_time_uncertain":false,"payer_name":"Thiri Mon","payee_name":null,"missing_fields":[],"uncertain_fields":[]}',
  'pending_review', 'a0000000-0000-4000-8000-000000000001'
);
insert into public.payment_evidence_events(shop_id, evidence_id, actor_id, action, after_status, after_revision, after_reviewed)
select shop_id, id, created_by, 'created', status, revision, seller_reviewed from public.payment_evidence;
select set_config('test.evidence_extraction', (select extracted::text from public.payment_evidence limit 1), true);
set local role authenticated;
select is((select count(*) from public.payment_evidence), 1::bigint, 'member reads evidence in the same shop');
select is((select count(*) from public.payment_evidence_events), 1::bigint, 'member reads evidence events in the same shop');
select is((select after_status::text from public.payment_evidence_events limit 1), 'pending_review', 'create audit records the after status');
select is((select after_revision from public.payment_evidence_events limit 1), 0, 'create audit records the initial revision');
select ok(not has_column_privilege('authenticated', 'public.payment_evidence', 'sha256', 'UPDATE'), 'evidence identity cannot be updated by the renderer');

select set_config('test.order_id', public.save_shop_order(jsonb_build_object(
  'shop_id', current_setting('test.evidence_shop'), 'id', 'd0000000-0000-4000-8000-000000000005',
  'expected_updated_at', null, 'customer_name', 'Evidence order', 'customer_phone', null,
  'delivery_address', null, 'notes', null, 'order_status', 'confirmed', 'fulfillment_status', 'unfulfilled',
  'delivery_fee_mmk', 0, 'discount_mmk', 0,
  'items', jsonb_build_array(jsonb_build_object('product_name', 'Evidence item', 'quantity', 1, 'unit_price_mmk', 52000))
)::text, true);
select set_config('test.rpc_evidence_id', 'e0000000-0000-4000-8000-000000000006', true);
select set_config('test.rpc_path', current_setting('test.evidence_shop') || '/e0000000-0000-4000-8000-000000000006/' || repeat('c', 64) || '.png', true);
insert into storage.objects (bucket_id, name)
values ('payment-evidence', current_setting('test.rpc_path'));
select set_config('test.rpc_original', jsonb_build_object(
  'amount_mmk', 52000, 'transaction_reference', 'ORIGINAL-1', 'provider', 'KBZPay',
  'transaction_date', '2026-10-21', 'transaction_time', '10:20:00', 'transaction_time_uncertain', false,
  'payer_name', 'Thiri Mon', 'payee_name', 'SaleSayar', 'missing_fields', '[]'::jsonb, 'uncertain_fields', '[]'::jsonb
)::text, true);
select set_config('test.rpc_corrected', (current_setting('test.rpc_original')::jsonb || jsonb_build_object(
  'transaction_reference', 'CORRECTED-1', 'provider', 'WavePay'
))::text, true);
select is(public.save_payment_evidence_review(jsonb_build_object(
  'shop_id', current_setting('test.evidence_shop'), 'evidence_id', current_setting('test.rpc_evidence_id'), 'order_id', null,
  'status', 'pending_review', 'expected_revision', 0, 'storage_object_path', current_setting('test.rpc_path'), 'sha256', repeat('c', 64),
  'extraction', current_setting('test.rpc_original')::jsonb, 'seller_reviewed', current_setting('test.rpc_original')::jsonb
)), current_setting('test.rpc_evidence_id')::uuid, 'review RPC creates a stable evidence record');
select is(public.save_payment_evidence_review(jsonb_build_object(
  'shop_id', current_setting('test.evidence_shop'), 'evidence_id', current_setting('test.rpc_evidence_id'), 'order_id', null,
  'status', 'pending_review', 'expected_revision', 0, 'storage_object_path', current_setting('test.rpc_path'), 'sha256', repeat('c', 64),
  'extraction', current_setting('test.rpc_original')::jsonb, 'seller_reviewed', current_setting('test.rpc_original')::jsonb
)), current_setting('test.rpc_evidence_id')::uuid, 'unchanged review retry returns the same evidence without another event');
select is((select count(*) from public.payment_evidence_events where evidence_id = current_setting('test.rpc_evidence_id')::uuid), 1::bigint, 'unchanged retry does not append an audit event');
select is(public.save_payment_evidence_review(jsonb_build_object(
  'shop_id', current_setting('test.evidence_shop'), 'evidence_id', current_setting('test.rpc_evidence_id'), 'order_id', current_setting('test.order_id'),
  'status', 'rejected', 'expected_revision', 0, 'storage_object_path', current_setting('test.rpc_path'), 'sha256', repeat('c', 64),
  'extraction', current_setting('test.rpc_original')::jsonb, 'seller_reviewed', current_setting('test.rpc_corrected')::jsonb
)), current_setting('test.rpc_evidence_id')::uuid, 'review update records seller corrections and association changes');
select is((select extracted->>'provider' from public.payment_evidence where id = current_setting('test.rpc_evidence_id')::uuid), 'KBZPay', 'original provider extraction remains immutable');
select is((select seller_reviewed->>'provider' from public.payment_evidence where id = current_setting('test.rpc_evidence_id')::uuid), 'WavePay', 'corrected provider is stored as seller reviewed');
select is((select order_id from public.payment_evidence where id = current_setting('test.rpc_evidence_id')::uuid), current_setting('test.order_id')::uuid, 'review association persists in the evidence row');
select is((select revision from public.payment_evidence where id = current_setting('test.rpc_evidence_id')::uuid), 1, 'review update advances the revision');
select is((select count(*) from public.payment_evidence_events where evidence_id = current_setting('test.rpc_evidence_id')::uuid), 2::bigint, 'status and association update append an audit event');
select is((select before_order_id from public.payment_evidence_events where evidence_id = current_setting('test.rpc_evidence_id')::uuid and after_revision = 1), null::uuid, 'audit keeps the previous order association');
select is((select after_order_id from public.payment_evidence_events where evidence_id = current_setting('test.rpc_evidence_id')::uuid and after_revision = 1), current_setting('test.order_id')::uuid, 'audit keeps the new order association');
select is((select before_status::text from public.payment_evidence_events where evidence_id = current_setting('test.rpc_evidence_id')::uuid and after_revision = 1), 'pending_review', 'audit keeps the previous status');
select is((select after_status::text from public.payment_evidence_events where evidence_id = current_setting('test.rpc_evidence_id')::uuid and after_revision = 1), 'rejected', 'audit keeps the new status');
select is((select before_revision from public.payment_evidence_events where evidence_id = current_setting('test.rpc_evidence_id')::uuid and after_revision = 1), 0, 'audit links the previous revision');
select is((select after_revision from public.payment_evidence_events where evidence_id = current_setting('test.rpc_evidence_id')::uuid and after_revision = 1), 1, 'audit links the new revision');
select throws_ok($$select public.save_payment_evidence_review(jsonb_build_object(
  'shop_id', current_setting('test.evidence_shop'), 'evidence_id', current_setting('test.rpc_evidence_id'), 'order_id', current_setting('test.order_id'),
  'status', 'rejected', 'expected_revision', 1, 'storage_object_path', current_setting('test.rpc_path'), 'sha256', repeat('c', 64),
  'extraction', current_setting('test.rpc_original')::jsonb || '{"amount_mmk":53000}'::jsonb, 'seller_reviewed', current_setting('test.rpc_corrected')::jsonb
))$$, '42501', null, 'review RPC rejects replacement of the original extraction');

set local "request.jwt.claim.sub" = 'b0000000-0000-4000-8000-000000000002';
select set_config('test.other_shop', public.create_shop_for_current_user('Other evidence shop')::text, true);
select is((select count(*) from public.payment_evidence), 0::bigint, 'other sellers cannot read evidence from another shop');
select throws_ok($$select public.save_payment_evidence_review(jsonb_build_object(
  'shop_id', current_setting('test.evidence_shop'), 'evidence_id', 'd0000000-0000-4000-8000-000000000004', 'order_id', null,
  'status', 'pending_review', 'expected_revision', 0, 'storage_object_path', current_setting('test.evidence_shop') || '/d0000000-0000-4000-8000-000000000004/' || repeat('b',64) || '.png', 'sha256', repeat('b',64),
  'extraction', current_setting('test.evidence_extraction')::jsonb, 'seller_reviewed', current_setting('test.evidence_extraction')::jsonb
))$$, '42501', null, 'other seller cannot call review RPC for another shop');

set local "request.jwt.claim.sub" = '';
set local role anon;
select throws_ok($$select public.save_payment_evidence_review('{}'::jsonb)$$, '42501', null, 'anonymous caller cannot call review RPC');
select * from finish();
rollback;
