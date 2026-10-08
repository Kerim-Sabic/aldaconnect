-- Dedicated development database; no fixture survives this transaction.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('dd000000-0000-4000-8000-000000000001','records-client@example.test','{"name":"Testni klijent"}'),
 ('dd000000-0000-4000-8000-000000000002','records-trainer@example.test','{"name":"Testni trener"}'),
 ('dd000000-0000-4000-8000-000000000003','records-doctor@example.test','{"name":"Testni doktor"}');
update public.users set role='trainer' where id='dd000000-0000-4000-8000-000000000002';
update public.users set role='doctor' where id='dd000000-0000-4000-8000-000000000003';
insert into public.relationships(id,client_id,expert_id) values
 ('records-trainer-test','dd000000-0000-4000-8000-000000000001','dd000000-0000-4000-8000-000000000002'),
 ('records-doctor-test','dd000000-0000-4000-8000-000000000001','dd000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.medications_action('grant','{"expertId":"dd000000-0000-4000-8000-000000000002","granted":true}');
select public.medications_action('grant','{"expertId":"dd000000-0000-4000-8000-000000000003","granted":true}');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000002',true);
do $smoke$
begin
 perform public.medications_action('save','{"clientId":"dd000000-0000-4000-8000-000000000001","id":"dd100000-0000-4000-8000-000000000001","version":0,"content":{"category":"ped","name":"Synthetic disclosure only","dose":"","route":"","frequency":"","timing":"","note":"Rollback fixture, no treatment","status":"active","start":"","end":""}}');
end $smoke$;
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000003',true);
do $smoke$
declare result jsonb; denied boolean:=false;
begin
 result:=public.medications_action('save','{"clientId":"dd000000-0000-4000-8000-000000000001","id":"dd100000-0000-4000-8000-000000000001","version":1,"content":{"category":"ped","name":"Synthetic disclosure only","dose":"","route":"","frequency":"","timing":"","note":"Doctor test edit","status":"active","start":"","end":""}}');
 if jsonb_array_length(result->'history')<>2 or result->'history'->0->>'actor_role'<>'doctor' or result->'history'->1->>'actor_role'<>'trainer' then raise exception 'Attributed history failed'; end if;
 begin perform public.medications_action('remove','{"clientId":"dd000000-0000-4000-8000-000000000001","id":"dd100000-0000-4000-8000-000000000001","version":1}');
 exception when others then if sqlerrm like 'APP:Unos je%' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Stale edit allowed'; end if;
end $smoke$;
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000001',true);
select public.medications_action('grant','{"expertId":"dd000000-0000-4000-8000-000000000003","granted":false}');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000003',true);
do $smoke$
begin
 if jsonb_array_length(public.medications_action('snapshot','{"clientId":"dd000000-0000-4000-8000-000000000001"}')->'entries')<>0 then raise exception 'Revoked access leaked records'; end if;
end $smoke$;
reset role;
rollback;
select 'PASS: doctor and trainer editing, author history, stale-edit rejection and consent revocation; fixtures rolled back' as result;
