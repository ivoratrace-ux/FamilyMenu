begin;
-- Older shipped clients require this JSON field. It never contains an email.
create or replace function public.get_inventory() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='PT401'; end if;
 return jsonb_build_object('userEmail','','userLogin',coalesce((select login from public.profiles where id=auth.uid()),''),
 'userApplication',coalesce((select login_application from public.profiles where id=auth.uid()),''),
 'revision',coalesce((select revision from public.inventory_versions where user_id=auth.uid()),0),'items',coalesce((
 select jsonb_agg(jsonb_build_object('ingredientId',s.ingredient_id,'name',i.name,'unit',i.unit,'quantity',s.quantity) order by i.name,s.ingredient_id)
 from public.user_ingredients s join public.ingredients i on i.id=s.ingredient_id where s.user_id=auth.uid()),'[]'::jsonb));
end $$;
commit;
