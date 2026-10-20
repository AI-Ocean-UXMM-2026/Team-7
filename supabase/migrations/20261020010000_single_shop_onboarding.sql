-- MVP: one shop per seller. Preserve existing shops and memberships.
-- Repeated/concurrent onboarding returns the existing shop, never a duplicate.
create or replace function public.create_shop_for_current_user(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  existing_shop_id uuid;
  new_shop_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 2 and 120 then
    raise exception 'Shop name must contain between 2 and 120 characters' using errcode = '22023';
  end if;

  -- Serialize first-shop creation for this user, including repeat submissions.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );
  select membership.shop_id into existing_shop_id
  from public.shop_memberships as membership
  where membership.user_id = current_user_id
  order by membership.created_at, membership.shop_id
  limit 1;

  if existing_shop_id is not null then
    return existing_shop_id;
  end if;

  insert into public.shops (name)
  values (btrim(p_name)) returning id into new_shop_id;
  insert into public.shop_memberships (shop_id, user_id, role)
  values (new_shop_id, current_user_id, 'owner');
  return new_shop_id;
end;
$$;

revoke all on function public.create_shop_for_current_user(text) from public, anon;
grant execute on function public.create_shop_for_current_user(text) to authenticated;
