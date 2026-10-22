begin;
alter table public.profiles
 add column login_application text,
 add column provider_user_id text,
 add column login text not null default '',
 add column display_name text not null default '';
create unique index profile_provider_identity on public.profiles(login_application,provider_user_id)
 where login_application is not null and provider_user_id is not null;
drop trigger sync_auth_profile on auth.users;
create or replace function public.sync_auth_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,login_application,provider_user_id,login,display_name)
 values(new.id,new.raw_app_meta_data->>'login_application',new.raw_app_meta_data->>'provider_user_id',
 coalesce(new.raw_app_meta_data->>'login',''),coalesce(new.raw_app_meta_data->>'display_name',''))
 on conflict(id) do update set login_application=excluded.login_application,provider_user_id=excluded.provider_user_id,
 login=excluded.login,display_name=excluded.display_name;
 return new;
end $$;
alter table public.profiles drop column email;
create trigger sync_auth_profile after insert or update of raw_app_meta_data on auth.users
 for each row execute function public.sync_auth_profile();
-- Older accounts and their personal data are retained, without linking by email or username.
create or replace function public.get_inventory() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='PT401'; end if;
 return jsonb_build_object('userLogin',coalesce((select login from public.profiles where id=auth.uid()),''),
 'userApplication',coalesce((select login_application from public.profiles where id=auth.uid()),''),
 'revision',coalesce((select revision from public.inventory_versions where user_id=auth.uid()),0),'items',coalesce((
 select jsonb_agg(jsonb_build_object('ingredientId',s.ingredient_id,'name',i.name,'unit',i.unit,'quantity',s.quantity) order by i.name,s.ingredient_id)
 from public.user_ingredients s join public.ingredients i on i.id=s.ingredient_id where s.user_id=auth.uid()),'[]'::jsonb));
end $$;
commit;
