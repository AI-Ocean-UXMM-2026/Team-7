begin;
create extension if not exists pgtap with schema extensions;
select plan(17);
insert into auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
values ('a0000000-0000-4000-8000-000000000001','authenticated','authenticated','order-a@test.invalid','{}','{}'),
('b0000000-0000-4000-8000-000000000002','authenticated','authenticated','order-b@test.invalid','{}','{}');
set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-4000-8000-000000000001';
select set_config('test.order_shop', public.create_shop_for_current_user('Order test shop')::text, true);
select set_config('test.payload', jsonb_build_object(
  'shop_id', current_setting('test.order_shop'), 'id', 'c0000000-0000-4000-8000-000000000003',
  'expected_updated_at', null, 'customer_name', 'Test customer', 'customer_phone', null,
  'delivery_address', null, 'notes', null, 'order_status', 'confirmed', 'fulfillment_status', 'unfulfilled',
  'delivery_fee_mmk', 3000, 'discount_mmk', 1000,
  'items', jsonb_build_array(jsonb_build_object('product_name','Test bag','quantity',2,'unit_price_mmk',25000))
)::text, true);
select is(public.save_shop_order(current_setting('test.payload')::jsonb), 'c0000000-0000-4000-8000-000000000003'::uuid, 'creates an order atomically');
select is((select total_mmk from public.orders where id = 'c0000000-0000-4000-8000-000000000003'), 52000::bigint, 'database calculates total');
select is((select payment_status::text from public.orders where id = 'c0000000-0000-4000-8000-000000000003'), 'unpaid', 'confirmation does not imply payment');
select is((select quantity from public.order_items where order_id = 'c0000000-0000-4000-8000-000000000003'), 2, 'item quantity persists');
select throws_ok($$select public.save_shop_order(current_setting('test.payload')::jsonb || '{"payment_status":"paid"}'::jsonb)$$, '22023', null, 'rejects payment override');
select throws_ok($$select public.save_shop_order(current_setting('test.payload')::jsonb)$$, '40001', null, 'same ID retry does not duplicate');
select set_config('test.updated', (select updated_at::text from public.orders where id = 'c0000000-0000-4000-8000-000000000003'), true);
select set_config('test.edit', (current_setting('test.payload')::jsonb || jsonb_build_object('expected_updated_at',current_setting('test.updated'), 'items',jsonb_build_array(jsonb_build_object('product_name','Test bag','quantity',3,'unit_price_mmk',25000))))::text, true);
select is(public.save_shop_order(current_setting('test.edit')::jsonb), 'c0000000-0000-4000-8000-000000000003'::uuid, 'edit succeeds');
select is((select total_mmk from public.orders where id = 'c0000000-0000-4000-8000-000000000003'), 77000::bigint, 'edited total persists');
select ok((select updated_at > current_setting('test.updated')::timestamptz from public.orders where id = 'c0000000-0000-4000-8000-000000000003'), 'edit advances the version even in the same transaction');
select is((select count(*) from public.order_revisions), 1::bigint, 'previous revision preserved');
select throws_ok($$select public.save_shop_order(current_setting('test.edit')::jsonb || '{"expected_updated_at":"2000-01-01T00:00:00Z"}'::jsonb)$$, '40001', null, 'rejects stale edits');
select throws_ok($$select public.save_shop_order(current_setting('test.edit')::jsonb || '{"discount_mmk":999999}'::jsonb)$$, '22023', null, 'rejects invalid total before any changes');
select is((select count(*) from public.order_revisions), 1::bigint, 'failed save leaves revisions unchanged');
set local "request.jwt.claim.sub" = 'b0000000-0000-4000-8000-000000000002';
select is((select count(*) from public.orders), 0::bigint, 'other seller cannot read orders');
select is((select count(*) from public.order_revisions), 0::bigint, 'other seller cannot read revisions');
select throws_ok($$select public.save_shop_order(current_setting('test.edit')::jsonb)$$, '42501', null, 'other seller cannot edit shop orders');
set local "request.jwt.claim.sub" = '';
set local role anon;
select throws_ok($$select public.save_shop_order(current_setting('test.payload')::jsonb)$$, '42501', null, 'anonymous caller cannot save');
select * from finish();
rollback;
