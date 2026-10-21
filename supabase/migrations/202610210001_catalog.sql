begin;
create table public.dishes (
 id text primary key,
 name text not null check (length(trim(name)) > 0),
 description text not null default '',
 cooking_minutes integer not null check (cooking_minutes > 0),
 image_url text check (image_url is null or image_url like 'https://%'),
 meal text not null check (meal in ('b','l','s','d','z','k')),
 tags text[] not null default '{}',
 spices text[] not null default '{}',
 servings integer not null default 4 check (servings > 0)
);
create table public.dish_steps (
 dish_id text not null references public.dishes(id) on delete cascade,
 position integer not null check (position > 0),
 description text not null check (length(trim(description)) > 0),
 duration_seconds integer not null default 0 check (duration_seconds >= 0),
 tip text not null default '',
 image_url text check (image_url is null or image_url like 'https://%'),
 primary key (dish_id, position)
);
create table public.ingredients (
 id text primary key,
 name text not null check (length(trim(name)) > 0),
 description text not null default '',
 category text not null,
 unit text not null,
 price numeric not null check (price >= 0),
 allergens text[] not null default '{}',
 flags text[] not null default '{}',
 nutrition numeric[] not null check (cardinality(nutrition) = 4 and 0 <= all(nutrition)),
 lavka_price numeric check (lavka_price >= 0),
 lavka_path text
);
create table public.dish_ingredients (
 dish_id text not null references public.dishes(id) on delete cascade,
 ingredient_id text not null references public.ingredients(id) on delete restrict,
 position integer not null check (position > 0),
 quantity numeric not null check (quantity > 0),
 unit text not null,
 primary key (dish_id, ingredient_id),
 unique (dish_id, position)
);
create index dish_ingredients_ingredient_idx on public.dish_ingredients(ingredient_id);
-- Non-recipe UI data, retained without hardcoding a second client catalogue.
create table public.catalog_settings (
 key text primary key check (key in ('promos','foods')),
 value jsonb not null check (jsonb_typeof(value) = 'array')
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 email text not null
);
create table public.cooking_history (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 dish_id text not null references public.dishes(id) on delete restrict,
 cooked_at timestamptz not null default now(),
 rating smallint check (rating between 1 and 5)
);
create index cooking_history_user_date_idx on public.cooking_history(user_id, cooked_at desc);
create index cooking_history_dish_idx on public.cooking_history(dish_id);

-- Profile email is managed by Auth, never by an arbitrary client-supplied user ID.
create function public.sync_auth_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,email) values(new.id,coalesce(new.email,''))
 on conflict(id) do update set email=excluded.email;
 return new;
end $$;
revoke all on function public.sync_auth_profile() from public, anon, authenticated;
create trigger sync_auth_profile after insert or update of email on auth.users
 for each row execute function public.sync_auth_profile();
insert into public.profiles(id,email) select id,coalesce(email,'') from auth.users;

-- Enforce one or more steps at transaction commit; imports can insert parent first.
create function public.require_dish_steps() returns trigger language plpgsql set search_path = '' as $$
declare target text;
begin
 if TG_TABLE_NAME='dishes' then target := new.id; else target := old.dish_id; end if;
 if exists(select 1 from public.dishes where id=target)
 and not exists(select 1 from public.dish_steps where dish_id=target) then
  raise exception 'A dish requires at least one preparation step' using errcode='23514';
 end if;
 return null;
end $$;
revoke all on function public.require_dish_steps() from public, anon, authenticated;
create constraint trigger dish_requires_steps after insert or update on public.dishes
 deferrable initially deferred for each row execute function public.require_dish_steps();
create constraint trigger retain_dish_steps after delete or update on public.dish_steps
 deferrable initially deferred for each row execute function public.require_dish_steps();

alter table public.dishes enable row level security;
alter table public.dish_steps enable row level security;
alter table public.ingredients enable row level security;
alter table public.dish_ingredients enable row level security;
alter table public.catalog_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.cooking_history enable row level security;
create policy catalog_read on public.dishes for select to anon,authenticated using(true);
create policy catalog_read on public.dish_steps for select to anon,authenticated using(true);
create policy catalog_read on public.ingredients for select to anon,authenticated using(true);
create policy catalog_read on public.dish_ingredients for select to anon,authenticated using(true);
create policy catalog_read on public.catalog_settings for select to anon,authenticated using(true);
create policy own_profile on public.profiles for select to authenticated using(id=(select auth.uid()));
create policy own_history on public.cooking_history for all to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.dishes,public.dish_steps,public.ingredients,public.dish_ingredients,public.catalog_settings,public.profiles,public.cooking_history from anon,authenticated;
grant select on public.dishes,public.dish_steps,public.ingredients,public.dish_ingredients,public.catalog_settings to anon,authenticated;
grant select on public.profiles to authenticated;
grant select,insert,update,delete on public.cooking_history to authenticated;

-- One snapshot and one response: nested steps/ingredients bypass PostgREST's row limit.
create function public.get_catalog() returns jsonb language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'ingredients', coalesce((select jsonb_agg(jsonb_build_object(
  'id',id,'name',name,'description',description,'category',category,'unit',unit,'price',price,
  'allergens',allergens,'flags',flags,'nutrition',nutrition,'lavkaPrice',lavka_price,'lavkaPath',lavka_path
 ) order by id) from public.ingredients),'[]'::jsonb),
 'recipes', coalesce((select jsonb_agg(jsonb_build_object(
  'id',d.id,'name',d.name,'description',d.description,'minutes',d.cooking_minutes,'imageUrl',d.image_url,
  'meal',d.meal,'tags',d.tags,'spices',d.spices,'servings',d.servings,
  'ingredients',coalesce((select jsonb_agg(jsonb_build_object('id',ingredient_id,'quantity',quantity) order by position) from public.dish_ingredients where dish_id=d.id),'[]'::jsonb),
  'steps',(select jsonb_agg(description order by position) from public.dish_steps where dish_id=d.id),
  'stepSeconds',(select jsonb_agg(duration_seconds order by position) from public.dish_steps where dish_id=d.id),
  'stepTips',(select jsonb_agg(tip order by position) from public.dish_steps where dish_id=d.id),
  'stepImageUrls',(select jsonb_agg(image_url order by position) from public.dish_steps where dish_id=d.id)
 ) order by d.id) from public.dishes d),'[]'::jsonb),
 'promos',coalesce((select value from public.catalog_settings where key='promos'),'[]'::jsonb),
 'foods',coalesce((select value from public.catalog_settings where key='foods'),'[]'::jsonb));
$$;
revoke all on function public.get_catalog() from public;
grant execute on function public.get_catalog() to anon,authenticated,service_role;
commit;
