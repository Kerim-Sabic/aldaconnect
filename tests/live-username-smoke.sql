begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('da000000-0000-4000-8000-000000000011','username-smoke@example.test','{"name":"Testni klijent"}'),
 ('da000000-0000-4000-8000-000000000012','admin-smoke@example.test','{"name":"Testni administrator"}');
update public.users set role='admin' where id='da000000-0000-4000-8000-000000000012';
insert into app_private.username_accounts(username,user_id,password_hash) values
 ('smoke-client','da000000-0000-4000-8000-000000000011',extensions.crypt(encode(extensions.digest('temporary-smoke-pass','sha256'),'hex'),extensions.gen_salt('bf',12))),
 ('smoke-admin','da000000-0000-4000-8000-000000000012',extensions.crypt(encode(extensions.digest('temporary-smoke-pass','sha256'),'hex'),extensions.gen_salt('bf',12)));
set local role anon;
do $smoke$
declare token text; result jsonb; denied boolean:=false;
begin
 token:=public.username_login('smoke-client','temporary-smoke-pass')->>'token';
 if length(token)<>64 then raise exception 'Login failed'; end if;
 result:=public.username_workspace(token);
 if result->'actor'->>'role'<>'client' then raise exception 'Client role failed'; end if;
 begin perform public.username_workspace(token,'snapshot','{}',null,'da000000-0000-4000-8000-000000000012');
 exception when others then if sqlerrm like 'APP:Pregledi%' then denied:=true; else raise; end if; end;
 if not denied then raise exception 'Preview isolation failed'; end if;
 perform public.username_workspace(token,'logout');
 token:=public.username_login('smoke-admin','temporary-smoke-pass')->>'token';
 result:=public.username_workspace(token);
 if result->'actor'->>'role'<>'admin' then raise exception 'Admin role failed'; end if;
 result:=public.username_workspace(token,'snapshot','{}',null,'da000000-0000-4000-8000-000000000011');
 if result->>'readOnly'<>'true' then raise exception 'Read-only preview failed'; end if;
end $smoke$;
reset role;
rollback;
select 'PASS: live bcrypt login, session logout, client isolation and admin preview; rollback complete' as result;
