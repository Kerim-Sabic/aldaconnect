-- Dedicated development project only. Every fixture is rolled back.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('dc000000-0000-4000-8000-000000000001','cycle-one@example.test','{"name":"Testni klijent ciklusa"}'),
 ('dc000000-0000-4000-8000-000000000002','cycle-two@example.test','{"name":"Drugi testni klijent"}');
select set_config('request.jwt.claim.sub','dc000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $smoke$
declare result jsonb;
begin
 result:=public.cycle_action('save','{"id":"dc100000-0000-4000-8000-000000000001","date":"2026-01-01","bleeding":"none","pain":null,"symptoms":[],"note":"Synthetic rollback fixture"}');
 if jsonb_array_length(result->'entries')<>1 then raise exception 'Save failed'; end if;
 perform public.cycle_action('remove','{"id":"dc100000-0000-4000-8000-000000000001"}');
 perform public.cycle_action('restore','{"id":"dc100000-0000-4000-8000-000000000001"}');
 perform public.workspace_action('onboard','{"modules":["training","cycle"],"intake":{}}');
 if not exists(select 1 from public.preferences where modules ? 'cycle') then raise exception 'Cycle preference failed'; end if;
end $smoke$;
reset role;
select set_config('request.jwt.claim.sub','dc000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $smoke$
declare denied boolean:=false;
begin
 if (select count(*) from public.cycle_entries)<>0 then raise exception 'RLS leaked cycle entries'; end if;
 if jsonb_array_length(public.cycle_action()->'entries')<>0 then raise exception 'RPC leaked cycle entries'; end if;
 begin perform public.cycle_action('remove','{"id":"dc100000-0000-4000-8000-000000000001"}');
 exception when others then if sqlerrm like 'APP:Unos%' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Cross-client mutation allowed'; end if;
end $smoke$;
reset role;
rollback;
select 'PASS: cycle save, remove, restore, preferences and owner isolation; all fixtures rolled back' as result;
