begin;
-- Shared prototype identity, deliberately separate from Supabase Auth until real login exists.
create table public.inventory_users (
 id uuid primary key default gen_random_uuid(),
 email text not null unique,
 revision bigint not null default 0 check (revision >= 0)
);
insert into public.inventory_users(email) values ('test@test.com');
create table public.user_ingredients (
 user_id uuid not null references public.inventory_users(id) on delete cascade,
 ingredient_id text not null references public.ingredients(id) on delete restrict,
 quantity numeric(15,3) not null check (quantity > 0 and quantity <= 1000000000),
 updated_at timestamptz not null default now(),
 primary key (user_id, ingredient_id)
);
alter table public.inventory_users enable row level security;
alter table public.user_ingredients enable row level security;
revoke all on public.inventory_users,public.user_ingredients from public,anon,authenticated;

-- These prototype RPCs never accept user IDs: every call is scoped to the one test account.
create function public.get_test_inventory() returns jsonb
 language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('userEmail',u.email,'revision',u.revision,'items',coalesce((
  select jsonb_agg(jsonb_build_object('ingredientId',s.ingredient_id,'name',i.name,'unit',i.unit,'quantity',s.quantity) order by i.name,s.ingredient_id)
  from public.user_ingredients s join public.ingredients i on i.id=s.ingredient_id where s.user_id=u.id
 ),'[]'::jsonb)) from public.inventory_users u where u.email='test@test.com';
$$;
create function public.mutate_test_inventory(p_action text,p_items jsonb,p_revision bigint) returns jsonb
 language plpgsql security definer set search_path = '' as $$
declare account public.inventory_users%rowtype; item jsonb;
begin
 select * into strict account from public.inventory_users where email='test@test.com' for update;
 if p_revision is null or account.revision <> p_revision then
  raise exception 'Inventory version conflict' using errcode='40001';
 end if;
 if p_action is null or p_action not in ('replace','upsert','delete') or p_items is null or jsonb_typeof(p_items)<>'array' then
  raise exception 'Invalid inventory request' using errcode='22023';
 end if;
 if jsonb_array_length(p_items)>1000 or (p_action<>'replace' and jsonb_array_length(p_items)<>1) then
  raise exception 'Invalid inventory size' using errcode='22023';
 end if;
 if (select count(*) from jsonb_array_elements(p_items)) <> (select count(distinct value->>'ingredientId') from jsonb_array_elements(p_items)) then
  raise exception 'Duplicate ingredients' using errcode='22023';
 end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'ingredientId') is distinct from 'string'
   or not exists(select 1 from public.ingredients where id=item->>'ingredientId') then
   raise exception 'Unknown ingredient' using errcode='22023';
  end if;
  if p_action<>'delete' then
   if jsonb_typeof(item->'quantity') is distinct from 'number' then
    raise exception 'Invalid quantity' using errcode='22023';
   end if;
   if (item->>'quantity')::numeric <= 0 or (item->>'quantity')::numeric > 1000000000
    or (item->>'quantity')::numeric <> round((item->>'quantity')::numeric,3) then
    raise exception 'Invalid quantity' using errcode='22023';
   end if;
  end if;
 end loop;
 if p_action='replace' then delete from public.user_ingredients where user_id=account.id; end if;
 if p_action='delete' then
  delete from public.user_ingredients where user_id=account.id and ingredient_id=p_items->0->>'ingredientId';
 else
  insert into public.user_ingredients(user_id,ingredient_id,quantity)
   select account.id,value->>'ingredientId',(value->>'quantity')::numeric from jsonb_array_elements(p_items)
   on conflict(user_id,ingredient_id) do update set quantity=excluded.quantity,updated_at=now();
 end if;
 update public.inventory_users set revision=revision+1 where id=account.id;
 return public.get_test_inventory();
end;
$$;
revoke all on function public.get_test_inventory(),public.mutate_test_inventory(text,jsonb,bigint) from public;
-- Intentionally shared test inventory; replace these grants with authenticated user-scoped RPCs at login rollout.
grant execute on function public.get_test_inventory(),public.mutate_test_inventory(text,jsonb,bigint) to anon,authenticated,service_role;
commit;
