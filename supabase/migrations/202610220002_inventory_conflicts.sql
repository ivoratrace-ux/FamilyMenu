begin;
-- A stale client version is an application conflict, not a retryable database serialization failure.
-- PT409 is PostgREST's supported custom HTTP status code.
create or replace function public.mutate_test_inventory(p_action text,p_items jsonb,p_revision bigint) returns jsonb
 language plpgsql security definer set search_path = '' as $$
declare account public.inventory_users%rowtype; item jsonb;
begin
 select * into strict account from public.inventory_users where email='test@test.com' for update;
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
commit;
