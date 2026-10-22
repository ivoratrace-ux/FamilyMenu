begin;
do $$
declare initial jsonb; result jsonb; version bigint;
begin
 initial:=public.get_test_inventory();version:=(initial->>'revision')::bigint;
 if initial->>'userEmail'<>'test@test.com' then raise exception 'Wrong test identity'; end if;
 if has_table_privilege('anon','public.user_ingredients','SELECT') or has_table_privilege('anon','public.user_ingredients','INSERT') then raise exception 'Direct table access granted'; end if;
 if not (select relrowsecurity from pg_class where oid='public.user_ingredients'::regclass) then raise exception 'RLS disabled'; end if;
 result:=public.mutate_test_inventory('replace','[{"ingredientId":"milk","quantity":125.5}]'::jsonb,version);
 if jsonb_array_length(result->'items')<>1 or (result->'items'->0->>'quantity')::numeric<>125.5 then raise exception 'Replace failed'; end if;
 version:=(result->>'revision')::bigint;
 result:=public.mutate_test_inventory('upsert','[{"ingredientId":"eggs","quantity":6}]'::jsonb,version);
 version:=(result->>'revision')::bigint;
 if jsonb_array_length(result->'items')<>2 then raise exception 'Upsert failed'; end if;
 begin
  perform public.mutate_test_inventory('replace','[{"ingredientId":"not_in_catalog","quantity":1}]'::jsonb,version);
  raise exception 'Unknown ID accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.mutate_test_inventory('replace','[{"ingredientId":"milk","quantity":0}]'::jsonb,version);
  raise exception 'Zero quantity accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.mutate_test_inventory('replace','[{"ingredientId":"milk","quantity":1},{"ingredientId":"milk","quantity":2}]'::jsonb,version);
  raise exception 'Duplicate accepted';
 exception when invalid_parameter_value then null; end;
 begin
  perform public.mutate_test_inventory('replace','[]'::jsonb,version-1);
  raise exception 'Stale version accepted';
 exception when sqlstate 'PT409' then null; end;
 if public.get_test_inventory()<>result then raise exception 'Failed operation mutated inventory'; end if;
 result:=public.mutate_test_inventory('delete','[{"ingredientId":"milk"}]'::jsonb,version);
 if jsonb_array_length(result->'items')<>1 or result->'items'->0->>'ingredientId'<>'eggs' then raise exception 'Delete failed'; end if;
 version:=(result->>'revision')::bigint;
 result:=public.mutate_test_inventory('replace','[]'::jsonb,version);
 if jsonb_array_length(result->'items')<>0 then raise exception 'Empty replacement failed'; end if;
end $$;
set local role anon;
-- The server's existing publishable/anon key can use only the fixed-account RPCs.
select public.mutate_test_inventory('replace','[]'::jsonb,(public.get_test_inventory()->>'revision')::bigint)->>'userEmail' as test_user;
reset role;
rollback;
