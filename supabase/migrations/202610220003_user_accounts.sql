begin;
-- Remove the explicitly retired shared prototype identity and its data.
drop function public.mutate_test_inventory(text,jsonb,bigint);
drop function public.get_test_inventory();
drop table public.user_ingredients;
drop table public.inventory_users;
-- Any Supabase Auth account with this retired test address is removed as requested.
delete from auth.users where lower(email)='test@test.com';
create table public.inventory_versions(user_id uuid primary key references auth.users(id) on delete cascade,revision bigint not null default 0);
create table public.user_ingredients(
 user_id uuid not null references auth.users(id) on delete cascade,
 ingredient_id text not null references public.ingredients(id) on delete restrict,
 quantity numeric(15,3) not null check(quantity>0 and quantity<=1000000000),
 updated_at timestamptz not null default now(),primary key(user_id,ingredient_id)
);
create table public.user_preferences(user_id uuid primary key references auth.users(id) on delete cascade,data jsonb not null check(jsonb_typeof(data)='object'),updated_at timestamptz not null default now());
create table public.user_menus(user_id uuid primary key references auth.users(id) on delete cascade,data jsonb not null check(jsonb_typeof(data)='object'),updated_at timestamptz not null default now());
create table public.user_state_versions(user_id uuid primary key references auth.users(id) on delete cascade,revision bigint not null default 0);
alter table public.inventory_versions enable row level security;
alter table public.user_ingredients enable row level security;
alter table public.user_preferences enable row level security;
alter table public.user_menus enable row level security;
alter table public.user_state_versions enable row level security;
revoke all on public.inventory_versions,public.user_ingredients,public.user_preferences,public.user_menus,public.user_state_versions from public,anon,authenticated;
create policy own_stock on public.user_ingredients for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_preferences on public.user_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy own_menu on public.user_menus for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create function public.get_inventory() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='PT401'; end if;
 return jsonb_build_object('userEmail',auth.jwt()->>'email','revision',coalesce((select revision from public.inventory_versions where user_id=auth.uid()),0),'items',coalesce((
 select jsonb_agg(jsonb_build_object('ingredientId',s.ingredient_id,'name',i.name,'unit',i.unit,'quantity',s.quantity) order by i.name,s.ingredient_id)
 from public.user_ingredients s join public.ingredients i on i.id=s.ingredient_id where s.user_id=auth.uid()),'[]'::jsonb));
end $$;
create function public.mutate_inventory(p_action text,p_items jsonb,p_revision bigint) returns jsonb
 language plpgsql security definer set search_path = '' as $$
declare account public.inventory_versions%rowtype; item jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='PT401'; end if;
 insert into public.inventory_versions(user_id) values(auth.uid()) on conflict do nothing;
 select * into strict account from public.inventory_versions where user_id=auth.uid() for update;
 if p_revision is null or account.revision <> p_revision then
  raise exception 'Inventory version conflict' using errcode='PT409';
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
 if p_action='replace' then delete from public.user_ingredients where user_id=account.user_id; end if;
 if p_action='delete' then
  delete from public.user_ingredients where user_id=account.user_id and ingredient_id=p_items->0->>'ingredientId';
 else
  insert into public.user_ingredients(user_id,ingredient_id,quantity)
   select account.user_id,value->>'ingredientId',(value->>'quantity')::numeric from jsonb_array_elements(p_items)
   on conflict(user_id,ingredient_id) do update set quantity=excluded.quantity,updated_at=now();
 end if;
 update public.inventory_versions set revision=revision+1 where user_id=account.user_id;
 return public.get_inventory();
end;
$$;
create function public.get_user_state() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='PT401'; end if;
 return jsonb_build_object('revision',coalesce((select revision from public.user_state_versions where user_id=auth.uid()),0),
 'preferences',(select data from public.user_preferences where user_id=auth.uid()),'menu',(select data from public.user_menus where user_id=auth.uid()));
end $$;
create function public.save_user_state(p_preferences jsonb,p_menu jsonb,p_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare version bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='PT401'; end if;
 if p_preferences is null or jsonb_typeof(p_preferences)<>'object' or (p_menu is not null and jsonb_typeof(p_menu) not in ('object','null')) then raise exception 'Invalid user data' using errcode='22023'; end if;
 insert into public.user_state_versions(user_id) values(auth.uid()) on conflict do nothing;
 select revision into version from public.user_state_versions where user_id=auth.uid() for update;
 if p_revision is null or version<>p_revision then raise exception 'Version conflict' using errcode='PT409'; end if;
 insert into public.user_preferences(user_id,data) values(auth.uid(),p_preferences) on conflict(user_id) do update set data=excluded.data,updated_at=now();
 if p_menu is null or p_menu='null'::jsonb then delete from public.user_menus where user_id=auth.uid();
 else insert into public.user_menus(user_id,data) values(auth.uid(),p_menu) on conflict(user_id) do update set data=excluded.data,updated_at=now(); end if;
 update public.user_state_versions set revision=revision+1 where user_id=auth.uid();
 return public.get_user_state();
end $$;
revoke all on function public.get_inventory(),public.mutate_inventory(text,jsonb,bigint),public.get_user_state(),public.save_user_state(jsonb,jsonb,bigint) from public,anon;
grant execute on function public.get_inventory(),public.mutate_inventory(text,jsonb,bigint),public.get_user_state(),public.save_user_state(jsonb,jsonb,bigint) to authenticated;
commit;
