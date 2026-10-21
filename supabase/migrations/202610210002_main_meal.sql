begin;
-- The legacy catalogue uses 'm' for mains shared between lunch and dinner.
alter table public.dishes drop constraint dishes_meal_check;
alter table public.dishes add constraint dishes_meal_check check (meal in ('b','l','s','d','z','k','m'));
commit;
