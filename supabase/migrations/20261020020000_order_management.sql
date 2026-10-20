-- Atomic order persistence. No direct order/item grants or payment writes.
-- Versions must change even for two saves in the same transaction.
create function private.set_order_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function private.set_order_updated_at() from public, anon, authenticated;
create or replace trigger orders_set_updated_at before update on public.orders
for each row execute function private.set_order_updated_at();

create table public.order_revisions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id),
  order_id uuid not null,
  actor_id uuid not null references auth.users(id),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (shop_id, order_id) references public.orders(shop_id, id)
);
alter table public.order_revisions enable row level security;
revoke all on public.order_revisions from anon, authenticated;
grant select on public.order_revisions to authenticated;
create policy "Members read order revisions" on public.order_revisions
for select to authenticated using (shop_id in (select private.current_user_shop_ids()));
create index order_revisions_order_idx on public.order_revisions(shop_id, order_id, created_at);

create function public.save_shop_order(p_input jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_shop uuid := (p_input->>'shop_id')::uuid;
  v_id uuid := (p_input->>'id')::uuid;
  v_old public.orders;
  v_customer uuid;
  v_item jsonb;
  v_subtotal numeric := 0;
  v_delivery numeric := (p_input->>'delivery_fee_mmk')::numeric;
  v_discount numeric := (p_input->>'discount_mmk')::numeric;
  v_total numeric;
begin
  if p_input is null then raise exception 'Order input required' using errcode = '22023'; end if;
  if auth.uid() is null or not exists (
    select 1 from public.shop_memberships where shop_id = v_shop and user_id = auth.uid()
  ) then raise exception 'Shop access denied' using errcode = '42501'; end if;
  if jsonb_typeof(p_input) <> 'object' or v_id is null or
     not (p_input ?& array['shop_id','id','expected_updated_at','customer_name','customer_phone','delivery_address','notes','order_status','fulfillment_status','delivery_fee_mmk','discount_mmk','items']) or
     (p_input - array['shop_id','id','expected_updated_at','customer_name','customer_phone','delivery_address','notes','order_status','fulfillment_status','delivery_fee_mmk','discount_mmk','items']) <> '{}'::jsonb then
    raise exception 'Invalid order fields' using errcode = '22023';
  end if;
  if jsonb_typeof(p_input->'customer_name') <> 'string' or char_length(btrim(p_input->>'customer_name')) not between 1 and 160 or
     jsonb_typeof(p_input->'customer_phone') not in ('string','null') or
     jsonb_typeof(p_input->'delivery_address') not in ('string','null') or
     jsonb_typeof(p_input->'notes') not in ('string','null') or
     jsonb_typeof(p_input->'order_status') <> 'string' or
     jsonb_typeof(p_input->'fulfillment_status') <> 'string' or
     char_length(p_input->>'customer_phone') > 40 or char_length(p_input->>'delivery_address') > 500 or char_length(p_input->>'notes') > 4000 or
     jsonb_typeof(p_input->'items') <> 'array' or jsonb_array_length(p_input->'items') not between 1 and 100 or
     jsonb_typeof(p_input->'delivery_fee_mmk') <> 'number' or jsonb_typeof(p_input->'discount_mmk') <> 'number' or
     v_delivery is null or v_discount is null or v_delivery < 0 or v_discount < 0 or v_delivery <> trunc(v_delivery) or v_discount <> trunc(v_discount) then
    raise exception 'Invalid order values' using errcode = '22023';
  end if;
  for v_item in select value from jsonb_array_elements(p_input->'items') loop
    if jsonb_typeof(v_item) <> 'object' or not (v_item ?& array['product_name','quantity','unit_price_mmk']) or
       (v_item - array['product_name','quantity','unit_price_mmk']) <> '{}'::jsonb or
       jsonb_typeof(v_item->'product_name') <> 'string' or char_length(btrim(v_item->>'product_name')) not between 1 and 200 or
       jsonb_typeof(v_item->'quantity') <> 'number' or jsonb_typeof(v_item->'unit_price_mmk') <> 'number' or
       (v_item->>'quantity')::numeric not between 1 and 1000000 or
       (v_item->>'quantity')::numeric <> trunc((v_item->>'quantity')::numeric) or
       (v_item->>'unit_price_mmk')::numeric not between 0 and 9007199254 or
       (v_item->>'unit_price_mmk')::numeric <> trunc((v_item->>'unit_price_mmk')::numeric) then
      raise exception 'Invalid order item' using errcode = '22023';
    end if;
    v_subtotal := v_subtotal + (v_item->>'quantity')::numeric * (v_item->>'unit_price_mmk')::numeric;
  end loop;
  v_total := v_subtotal + v_delivery - v_discount;
  if v_total < 0 or greatest(v_subtotal + v_delivery, v_discount, v_total) > 9007199254740991 then
    raise exception 'Invalid order total' using errcode = '22023';
  end if;
  -- Serialize same-ID creates and updates, including retries after a lost response.
  perform pg_advisory_xact_lock(hashtextextended(v_id::text, 0));
  select * into v_old from public.orders where id = v_id for update;
  if found then
    if v_old.shop_id <> v_shop then raise exception 'Shop access denied' using errcode = '42501'; end if;
    if p_input->>'expected_updated_at' is null or v_old.updated_at <> (p_input->>'expected_updated_at')::timestamptz then
      raise exception 'Order changed. Reload before saving.' using errcode = '40001';
    end if;
    -- Financial changes to paid orders require the future payment adjustment workflow.
    if v_old.payment_status <> 'unpaid' then
      raise exception 'Orders with payment records require payment adjustment review.' using errcode = '22023';
    end if;
    insert into public.order_revisions(shop_id, order_id, actor_id, snapshot)
    select v_shop, v_id, auth.uid(), jsonb_build_object('order', to_jsonb(v_old), 'customer',
      (select to_jsonb(c) from public.customers c where c.id = v_old.customer_id and c.shop_id = v_shop),
      'items', (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from public.order_items i where i.order_id = v_id and i.shop_id = v_shop));
  elsif p_input->>'expected_updated_at' is not null then
    raise exception 'Order unavailable. Reload.' using errcode = '40001';
  end if;
  -- Preserve existing customer records rather than changing other orders' contacts.
  select id into v_customer from public.customers where id = v_old.customer_id and shop_id = v_shop
    and name = btrim(p_input->>'customer_name') and phone is not distinct from (p_input->>'customer_phone');
  if v_customer is null then
    insert into public.customers(shop_id, name, phone) values(v_shop, btrim(p_input->>'customer_name'), p_input->>'customer_phone') returning id into v_customer;
  end if;
  if v_old.id is null then
    insert into public.orders(id, shop_id, customer_id, order_status, fulfillment_status, subtotal_mmk, delivery_fee_mmk, discount_mmk, total_mmk, delivery_address, notes)
    values(v_id, v_shop, v_customer, (p_input->>'order_status')::public.order_status, (p_input->>'fulfillment_status')::public.fulfillment_status,
      v_subtotal, v_delivery, v_discount, v_total, p_input->>'delivery_address', p_input->>'notes');
  else
    update public.orders set customer_id = v_customer, order_status = (p_input->>'order_status')::public.order_status,
      fulfillment_status = (p_input->>'fulfillment_status')::public.fulfillment_status,
      subtotal_mmk = v_subtotal, delivery_fee_mmk = v_delivery, discount_mmk = v_discount, total_mmk = v_total,
      delivery_address = p_input->>'delivery_address', notes = p_input->>'notes'
    where id = v_id and shop_id = v_shop;
    delete from public.order_items where order_id = v_id and shop_id = v_shop;
  end if;
  insert into public.order_items(shop_id, order_id, product_name, quantity, unit_price_mmk)
  select v_shop, v_id, btrim(value->>'product_name'), (value->>'quantity')::integer, (value->>'unit_price_mmk')::bigint
  from jsonb_array_elements(p_input->'items');
  return v_id;
end;
$$;
revoke all on function public.save_shop_order(jsonb) from public, anon;
grant execute on function public.save_shop_order(jsonb) to authenticated;
