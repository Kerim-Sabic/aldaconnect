-- Run only against the dedicated development project. Always rolls back.
-- No email is sent and no account, permission, or record remains afterward.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('da000000-0000-4000-8000-000000000001','smoke-one@example.test','{"name":"Testni korisnik","role":"trainer"}'),
 ('da000000-0000-4000-8000-000000000002','smoke-two@example.test','{"name":"Drugi testni korisnik"}');
select set_config('request.jwt.claim.sub','da000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $smoke$
declare snapshot jsonb; denied boolean:=false;
begin
 if (select count(*) from public.users)<>1 then raise exception 'RLS smoke failed: visible profiles'; end if;
 snapshot:=public.workspace_snapshot(null);
 if snapshot->'actor'->>'role'<>'client' then raise exception 'Role escalation smoke failed'; end if;
 begin
  perform public.workspace_snapshot('da000000-0000-4000-8000-000000000002');
 exception when others then
  if sqlerrm='APP:Pristup nije dozvoljen.' then denied:=true; else raise; end if;
 end;
 if not denied then raise exception 'Cross-account access smoke failed'; end if;
 perform public.workspace_action('onboard','{"modules":["training","progress"],"intake":{"goal":"Testni cilj","days":3,"setting":"Teretana"}}');
 snapshot:=public.workspace_snapshot(null);
 if (snapshot->'actor'->>'onboarded')::boolean is not true then raise exception 'Onboarding smoke failed'; end if;
end $smoke$;
reset role;
rollback;
select 'PASS: auth trigger, RLS, role isolation, RPC and onboarding; transaction rolled back' as result,
 (select count(*) from public.users) as persistent_accounts,
 (select bool_and(rowsecurity) from pg_tables where schemaname='public') as all_rls_enabled;
