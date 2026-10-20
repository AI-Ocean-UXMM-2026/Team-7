-- SaleSayar AI business workspace foundation. Apply with the Supabase CLI.
create schema if not exists private authorization postgres;

create type public.shop_role as enum ('owner', 'admin', 'member');
create type public.order_status as enum ('draft', 'confirmed', 'cancelled');
create type public.payment_status as enum (
  'unpaid',
  'partially_paid',
  'paid',
  'refunded'
);
create type public.fulfillment_status as enum (
  'unfulfilled',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or char_length(display_name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  currency text not null default 'MMK' check (currency = 'MMK'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shop_memberships (
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.shop_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (shop_id, user_id)
);

create index shop_memberships_user_id_idx on public.shop_memberships (user_id);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  phone text check (phone is null or char_length(phone) <= 40),
  address text check (address is null or char_length(address) <= 500),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id)
);

create index customers_shop_id_idx on public.customers (shop_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid,
  order_status public.order_status not null default 'draft',
  payment_status public.payment_status not null default 'unpaid',
  fulfillment_status public.fulfillment_status not null default 'unfulfilled',
  subtotal_mmk bigint not null default 0 check (subtotal_mmk between 0 and 9007199254740991),
  delivery_fee_mmk bigint not null default 0 check (delivery_fee_mmk between 0 and 9007199254740991),
  discount_mmk bigint not null default 0 check (discount_mmk between 0 and 9007199254740991),
  total_mmk bigint not null default 0 check (total_mmk between 0 and 9007199254740991),
  delivery_address text check (delivery_address is null or char_length(delivery_address) <= 500),
  notes text check (notes is null or char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, id),
  foreign key (shop_id, customer_id)
    references public.customers (shop_id, id) on delete set null (customer_id),
  check (discount_mmk <= subtotal_mmk + delivery_fee_mmk),
  check (total_mmk = subtotal_mmk + delivery_fee_mmk - discount_mmk)
);

create index orders_shop_id_idx on public.orders (shop_id);
create index orders_customer_id_idx on public.orders (customer_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  order_id uuid not null,
  product_name text not null check (char_length(btrim(product_name)) between 1 and 200),
  quantity integer not null check (quantity between 1 and 1000000),
  unit_price_mmk bigint not null check (unit_price_mmk between 0 and 9007199254),
  line_total_mmk bigint generated always as (quantity::bigint * unit_price_mmk) stored,
  created_at timestamptz not null default now(),
  foreign key (shop_id, order_id)
    references public.orders (shop_id, id) on delete cascade,
  check (line_total_mmk <= 9007199254740991)
);

create index order_items_shop_order_idx on public.order_items (shop_id, order_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  amount_mmk bigint not null check (amount_mmk between 1 and 9007199254740991),
  category text not null check (char_length(btrim(category)) between 1 and 80),
  expense_date date not null default current_date,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_shop_date_idx on public.expenses (shop_id, expense_date desc);

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();
create trigger shops_set_updated_at
before update on public.shops
for each row execute function private.set_updated_at();
create trigger customers_set_updated_at
before update on public.customers
for each row execute function private.set_updated_at();
create trigger orders_set_updated_at
before update on public.orders
for each row execute function private.set_updated_at();
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    case
      when char_length(btrim(new.raw_user_meta_data ->> 'display_name')) between 1 and 120
        then btrim(new.raw_user_meta_data ->> 'display_name')
      else null
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.profiles (id, display_name)
select
  auth_user.id,
  case
    when char_length(btrim(auth_user.raw_user_meta_data ->> 'display_name')) between 1 and 120
      then btrim(auth_user.raw_user_meta_data ->> 'display_name')
    else null
  end
from auth.users as auth_user
on conflict (id) do nothing;

-- These SECURITY DEFINER helpers avoid recursive RLS checks on memberships.
create function private.current_user_shop_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select membership.shop_id
  from public.shop_memberships as membership
  where membership.user_id = (select auth.uid())
$$;

create function private.current_user_is_shop_owner(target_shop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shop_memberships as membership
    where membership.shop_id = target_shop_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'owner'
  )
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function private.current_user_shop_ids() from public, anon;
revoke all on function private.current_user_is_shop_owner(uuid) from public, anon;
grant execute on function private.current_user_shop_ids() to authenticated;
grant execute on function private.current_user_is_shop_owner(uuid) to authenticated;

create function public.create_shop_for_current_user(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_shop_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
    raise exception 'Shop name must contain between 2 and 120 characters' using errcode = '22023';
  end if;

  insert into public.shops (name)
  values (btrim(p_name))
  returning id into new_shop_id;

  insert into public.shop_memberships (shop_id, user_id, role)
  values (new_shop_id, auth.uid(), 'owner');

  return new_shop_id;
end;
$$;

revoke all on function public.create_shop_for_current_user(text) from public, anon;
grant execute on function public.create_shop_for_current_user(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.shop_memberships enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.expenses enable row level security;

revoke all on table public.profiles, public.shops, public.shop_memberships,
  public.customers, public.orders, public.order_items, public.expenses
  from anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant select on table public.shops, public.shop_memberships to authenticated;
grant update (name) on table public.shops to authenticated;
grant select, insert, update, delete on table public.customers to authenticated;
-- Order and item writes are withheld until an atomic persistence RPC can keep
-- the item lines and order totals consistent. Milestone 2A.2 adds that path.
grant select on table public.orders, public.order_items to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;

create policy "Users read their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy "Users create their own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy "Users update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Shop members read their shops"
on public.shops for select to authenticated
using (id in (select private.current_user_shop_ids()));
create policy "Shop owners update their shops"
on public.shops for update to authenticated
using (private.current_user_is_shop_owner(id))
with check (private.current_user_is_shop_owner(id));

create policy "Users read memberships for their shops"
on public.shop_memberships for select to authenticated
using (shop_id in (select private.current_user_shop_ids()));

create policy "Members read customers"
on public.customers for select to authenticated
using (shop_id in (select private.current_user_shop_ids()));
create policy "Members create customers"
on public.customers for insert to authenticated
with check (shop_id in (select private.current_user_shop_ids()));
create policy "Members update customers"
on public.customers for update to authenticated
using (shop_id in (select private.current_user_shop_ids()))
with check (shop_id in (select private.current_user_shop_ids()));
create policy "Members delete customers"
on public.customers for delete to authenticated
using (shop_id in (select private.current_user_shop_ids()));

create policy "Members read orders"
on public.orders for select to authenticated
using (shop_id in (select private.current_user_shop_ids()));
create policy "Members create orders"
on public.orders for insert to authenticated
with check (shop_id in (select private.current_user_shop_ids()));
create policy "Members update orders"
on public.orders for update to authenticated
using (shop_id in (select private.current_user_shop_ids()))
with check (shop_id in (select private.current_user_shop_ids()));
create policy "Members delete orders"
on public.orders for delete to authenticated
using (shop_id in (select private.current_user_shop_ids()));

create policy "Members read order items"
on public.order_items for select to authenticated
using (shop_id in (select private.current_user_shop_ids()));
create policy "Members create order items"
on public.order_items for insert to authenticated
with check (shop_id in (select private.current_user_shop_ids()));
create policy "Members update order items"
on public.order_items for update to authenticated
using (shop_id in (select private.current_user_shop_ids()))
with check (shop_id in (select private.current_user_shop_ids()));
create policy "Members delete order items"
on public.order_items for delete to authenticated
using (shop_id in (select private.current_user_shop_ids()));

create policy "Members read expenses"
on public.expenses for select to authenticated
using (shop_id in (select private.current_user_shop_ids()));
create policy "Members create expenses"
on public.expenses for insert to authenticated
with check (shop_id in (select private.current_user_shop_ids()));
create policy "Members update expenses"
on public.expenses for update to authenticated
using (shop_id in (select private.current_user_shop_ids()))
with check (shop_id in (select private.current_user_shop_ids()));
create policy "Members delete expenses"
on public.expenses for delete to authenticated
using (shop_id in (select private.current_user_shop_ids()));
