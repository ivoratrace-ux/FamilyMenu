begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); result jsonb;
begin
 insert into auth.users(id,email) values(a,'ownership-a@example.test'),(b,'ownership-b@example.test');
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'email','ownership-a@example.test','role','authenticated')::text,true);
 result:=public.mutate_inventory('replace','[{"ingredientId":"milk","quantity":125}]',0);
 if jsonb_array_length(result->'items')<>1 then raise exception 'Owner A stock not saved'; end if;
 perform public.save_user_state('{"profile":{"members":[{"name":"Owner A"}]}}','{"days":[]}',0);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'email','ownership-b@example.test','role','authenticated')::text,true);
 if jsonb_array_length(public.get_inventory()->'items')<>0 then raise exception 'Stock leaked to B'; end if;
 if public.get_user_state()->'preferences'<>'null'::jsonb then raise exception 'Preferences leaked to B'; end if;
 perform public.mutate_inventory('upsert','[{"ingredientId":"eggs","quantity":6}]',0);
 perform public.save_user_state('{"profile":{"members":[{"name":"Owner B"}]}}',null,0);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'email','ownership-a@example.test','role','authenticated')::text,true);
 if public.get_inventory()->'items'->0->>'ingredientId'<>'milk' then raise exception 'B changed A stock'; end if;
 if public.get_user_state()->'preferences'->'profile'->'members'->0->>'name'<>'Owner A' then raise exception 'B changed A preferences'; end if;
 begin perform public.save_user_state('{"profile":{}}',null,0);raise exception 'Stale save accepted';exception when sqlstate 'PT409' then null;end;
 if to_regprocedure('public.get_test_inventory()') is not null then raise exception 'Shared RPC remains'; end if;
 if exists(select 1 from auth.users where lower(email)='test@test.com') then raise exception 'Retired account remains'; end if;
 if has_function_privilege('anon','public.get_inventory()','execute') or has_function_privilege('anon','public.get_user_state()','execute') then raise exception 'Anonymous data access'; end if;
 if has_table_privilege('authenticated','public.user_ingredients','SELECT') then raise exception 'Direct stock read allowed'; end if;
end $$;
rollback;
