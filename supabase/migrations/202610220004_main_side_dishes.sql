begin;
-- "Cook from what you have": standalone mains ('p') and side dishes ('g') combined in the client.
-- Side dishes carry a 'with:<phrase>' tag for combo names; mains list good sides as 'pair:<dish id>' tags.
alter table public.dishes drop constraint dishes_meal_check;
alter table public.dishes add constraint dishes_meal_check check (meal in ('b','l','s','d','z','k','m','p','g'));
commit;
