-- Run via Management API in normal SQL mode. All test rows are rolled back.
begin;
select set_config('familymenu.test_user',gen_random_uuid()::text,true);
select set_config('familymenu.other_user',gen_random_uuid()::text,true);
insert into auth.users(id,email) values
 (current_setting('familymenu.test_user')::uuid,'familymenu-schema-test@example.invalid'),
 (current_setting('familymenu.other_user')::uuid,'familymenu-other-test@example.invalid');
insert into public.cooking_history(user_id,dish_id,rating) values
 (current_setting('familymenu.other_user')::uuid,'b1',5);
do $$ begin
 if (select count(*) from public.dishes)<>175 then raise exception 'Wrong dish count'; end if;
 if (select count(*) from public.dish_steps)<>700 then raise exception 'Wrong step count'; end if;
 if (select count(*) from public.dish_ingredients)<>930 then raise exception 'Wrong ingredient relation count'; end if;
 if exists(select 1 from public.dishes d where not exists(select 1 from public.dish_steps s where s.dish_id=d.id)) then raise exception 'Dish without steps'; end if;
 begin
  insert into public.dishes(id,name,cooking_minutes,meal) values('schema-test-empty','Test',1,'b');
  set constraints all immediate;
  raise exception 'Missing steps should be rejected';
 exception when check_violation then null; end;
end $$;
set local role anon;
do $$ begin
 if jsonb_array_length(public.get_catalog()->'recipes')<>175 then raise exception 'Public catalog unavailable'; end if;
 begin
  insert into public.ingredients(id,name,category,unit,price,nutrition) values('forbidden','Test','Test','g',1,array[1,1,1,1]);
  raise exception 'Anonymous catalog write permitted';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.profiles;
  raise exception 'Anonymous profile read permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('familymenu.test_user'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.cooking_history(user_id,dish_id,rating) values
 (current_setting('familymenu.test_user')::uuid,'b1',null),
 (current_setting('familymenu.test_user')::uuid,'b1',1),
 (current_setting('familymenu.test_user')::uuid,'b1',5);
do $$ begin
 if (select count(*) from public.profiles)<>1 then raise exception 'Profile isolation failed'; end if;
 if (select count(*) from public.cooking_history)<>3 then raise exception 'History isolation or duplicate cooking failed'; end if;
 begin
  insert into public.cooking_history(user_id,dish_id,rating) values(current_setting('familymenu.test_user')::uuid,'b1',6);
  raise exception 'Rating 6 permitted';
 exception when check_violation then null; end;
 begin
  insert into public.cooking_history(user_id,dish_id,rating) values(current_setting('familymenu.test_user')::uuid,'b1',0);
  raise exception 'Rating 0 permitted';
 exception when check_violation then null; end;
 begin
  insert into public.cooking_history(user_id,dish_id) values(current_setting('familymenu.other_user')::uuid,'b1');
  raise exception 'Cross-user write permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'catalog integrity, permissions, RLS, profiles, ratings and repeated cooking: OK' as result;
rollback;
