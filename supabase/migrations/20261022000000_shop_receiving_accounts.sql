create table public.shop_receiving_accounts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  provider text not null check (char_length(btrim(provider)) between 2 and 80),
  account_name text not null check (char_length(btrim(account_name)) between 2 and 160),
  account_number text not null check (char_length(btrim(account_number)) between 4 and 80),
  created_at timestamptz not null default now(),
  unique (shop_id, provider, account_number)
);

create index shop_receiving_accounts_shop_idx on public.shop_receiving_accounts(shop_id);
alter table public.shop_receiving_accounts enable row level security;
revoke all on public.shop_receiving_accounts from anon, authenticated;
grant select, insert, delete on public.shop_receiving_accounts to authenticated;

create policy "Members read shop receiving accounts"
on public.shop_receiving_accounts for select to authenticated
using (shop_id in (select private.current_user_shop_ids()));

create policy "Owners add shop receiving accounts"
on public.shop_receiving_accounts for insert to authenticated
with check (private.current_user_is_shop_owner(shop_id));

create policy "Owners remove shop receiving accounts"
on public.shop_receiving_accounts for delete to authenticated
using (private.current_user_is_shop_owner(shop_id));
