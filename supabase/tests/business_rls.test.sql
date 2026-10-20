begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) values
  (
    '10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'shop-a@test.invalid', '', now(), now(), now(), '{}', '{"display_name":"Shop A"}'
  ),
  (
    '20000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'shop-b@test.invalid', '', now(), now(), now(), '{}',
    jsonb_build_object('display_name', repeat('B', 121))
  );

select is(
  (select display_name from public.profiles where id = '10000000-0000-4000-8000-000000000001'),
  'Shop A'::text,
  'auth trigger creates a profile from a valid display name'
);
select is(
  (select display_name from public.profiles where id = '20000000-0000-4000-8000-000000000002'),
  null::text,
  'overlong auth metadata does not block profile creation'
);

set local role authenticated;
set local "request.jwt.claim.sub" = '10000000-0000-4000-8000-000000000001';
select set_config(
  'test.shop_a',
  public.create_shop_for_current_user('Shop A Test Workspace')::text,
  true
);

insert into public.customers (shop_id, name)
values (current_setting('test.shop_a')::uuid, 'Customer A');
insert into public.expenses (shop_id, description, amount_mmk, category)
values (current_setting('test.shop_a')::uuid, 'Test expense', 1000, 'supplies');

-- Seed order rows as the migration owner so the read-isolation test does not
-- grant authenticated clients an incomplete, non-transactional write path.
reset role;
insert into public.orders (
  shop_id, order_status, subtotal_mmk, delivery_fee_mmk, discount_mmk, total_mmk
)
values (
  current_setting('test.shop_a')::uuid, 'draft', 25000, 3000, 0, 28000
);
insert into public.order_items (shop_id, order_id, product_name, quantity, unit_price_mmk)
select shop_id, id, 'Sample item', 1, 25000
from public.orders
where shop_id = current_setting('test.shop_a')::uuid;
set local role authenticated;

select is((select count(*) from public.shops), 1::bigint, 'owner can see their shop');
select is((select count(*) from public.customers), 1::bigint, 'member can create a customer');
select is((select count(*) from public.orders), 1::bigint, 'member can read an order in their shop');
select is((select count(*) from public.order_items), 1::bigint, 'member can read order items in their shop');
select is((select count(*) from public.expenses), 1::bigint, 'member can create an expense');
select ok(
  not has_column_privilege('authenticated', 'public.orders', 'payment_status', 'UPDATE'),
  'authenticated users cannot claim a payment was received'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.orders', 'INSERT')
    and not has_any_column_privilege('authenticated', 'public.orders', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.orders', 'DELETE'),
  'authenticated users cannot write orders outside the transactional persistence path'
);
select ok(
  not has_any_column_privilege('authenticated', 'public.order_items', 'INSERT')
    and not has_any_column_privilege('authenticated', 'public.order_items', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.order_items', 'DELETE'),
  'authenticated users cannot write order items outside the transactional persistence path'
);

set local "request.jwt.claim.sub" = '20000000-0000-4000-8000-000000000002';
select set_config(
  'test.shop_b',
  public.create_shop_for_current_user('Shop B Test Workspace')::text,
  true
);

select is((select count(*) from public.shops), 1::bigint, 'second seller sees only their shop');
select is((select count(*) from public.customers), 0::bigint, 'second seller cannot read first seller customers');
select is((select count(*) from public.orders), 0::bigint, 'second seller cannot read first seller orders');
select is((select count(*) from public.order_items), 0::bigint, 'second seller cannot read first seller order items');
select throws_ok(
  $$insert into public.customers (shop_id, name)
    values (current_setting('test.shop_a')::uuid, 'Unauthorized customer')$$,
  '42501',
  null,
  'second seller cannot write to first seller shop'
);
select is(
  (with changed as (
    update public.customers
    set name = 'Unauthorized edit'
    where shop_id = current_setting('test.shop_a')::uuid
    returning id
  ) select count(*) from changed),
  0::bigint,
  'second seller cannot update first seller customer'
);
select is(
  (with removed as (
    delete from public.expenses
    where shop_id = current_setting('test.shop_a')::uuid
    returning id
  ) select count(*) from removed),
  0::bigint,
  'second seller cannot delete first seller expense'
);
select is(
  (select count(*) from public.orders) +
    (select count(*) from public.order_items) +
    (select count(*) from public.expenses),
  0::bigint,
  'second seller cannot read first seller business records'
);

select * from finish();
rollback;
