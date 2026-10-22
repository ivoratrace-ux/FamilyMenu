begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); identity text:=gen_random_uuid()::text;
begin
 insert into auth.users(id,raw_app_meta_data,raw_user_meta_data) values
 (a,jsonb_build_object('login_application','telegram','provider_user_id',identity,'login','@first','display_name','Alice'),'{}'),
 (b,'{}',jsonb_build_object('login_application','telegram','provider_user_id',identity,'login','@forged'));
 if (select login from public.profiles where id=a)<>'@first' then raise exception 'Trusted identity not synced'; end if;
 if (select login_application from public.profiles where id=b) is not null then raise exception 'User metadata forged identity'; end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform public.mutate_inventory('upsert','[{"ingredientId":"milk","quantity":200}]',0);
 update auth.users set raw_app_meta_data=raw_app_meta_data || '{"login":"Alice","display_name":"Alice"}' where id=a;
 if public.get_inventory()->>'userLogin'<>'Alice' then raise exception 'Changed login not reflected'; end if;
 if public.get_inventory()->'items'->0->>'ingredientId'<>'milk' then raise exception 'Username change lost stock'; end if;
 if public.get_inventory()->>'userEmail'<>'' then raise exception 'Email exposed by stock API'; end if;
 begin
  update auth.users set raw_app_meta_data=jsonb_build_object('login_application','telegram','provider_user_id',identity) where id=b;
  raise exception 'Duplicate provider identity accepted';
 exception when unique_violation then null;
 end;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='email') then raise exception 'Profile still stores email'; end if;
end $$;
rollback;
