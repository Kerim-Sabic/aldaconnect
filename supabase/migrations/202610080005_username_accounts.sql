-- Persistent username sessions. Credentials and bearer tokens never have table API access.
begin;
alter table public.users drop constraint users_role_check;
alter table public.users add constraint users_role_check check(role in ('admin','client','trainer','doctor','nutritionist','therapist'));
create table app_private.username_accounts(
 username text primary key check(username=lower(username)), user_id text unique not null references public.users(id),
 password_hash text not null, failures integer not null default 0, locked_until timestamptz,
 must_change_password boolean not null default true
);
create table app_private.username_sessions(
 token_hash text primary key,user_id text not null references public.users(id),
 expires_at timestamptz not null default now()+interval '12 hours',created_at timestamptz not null default now()
);
alter table app_private.username_accounts enable row level security;
alter table app_private.username_sessions enable row level security;
revoke all on app_private.username_accounts,app_private.username_sessions from public,anon,authenticated;

create function public.username_login(p_username text,p_password text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare account app_private.username_accounts; token text;
begin
 if length(p_username)>80 or length(p_password)>128 then return jsonb_build_object('error','Korisničko ime ili lozinka nisu ispravni.'); end if;
 select * into account from app_private.username_accounts where username=lower(trim(p_username)) for update;
 if account.user_id is null or account.locked_until>now() then
  return jsonb_build_object('error','Korisničko ime ili lozinka nisu ispravni. Pokušajte kasnije.');
 end if;
 if extensions.crypt(encode(extensions.digest(p_password,'sha256'),'hex'),account.password_hash) is distinct from account.password_hash then
  update app_private.username_accounts set failures=case when failures>=4 then 0 else failures+1 end,
   locked_until=case when failures>=4 then now()+interval '15 minutes' else null end where username=account.username;
  return jsonb_build_object('error','Korisničko ime ili lozinka nisu ispravni.');
 end if;
 update app_private.username_accounts set failures=0,locked_until=null where username=account.username;
 delete from app_private.username_sessions where expires_at<now();
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into app_private.username_sessions(token_hash,user_id) values(encode(extensions.digest(token,'sha256'),'hex'),account.user_id);
 return jsonb_build_object('ok',true,'token',token);
end $$;

create function public.username_workspace(p_token text,p_action text default 'snapshot',p_payload jsonb default '{}',p_client_id text default null,p_preview text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text; actor_role text; target text; result jsonb; previous_sub text:=current_setting('request.jwt.claim.sub',true);
begin
 if length(p_token)<>64 then raise exception 'APP:Prijavite se da nastavite.'; end if;
 select user_id into actor from app_private.username_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 if actor is null then raise exception 'APP:Vaša sesija je istekla. Prijavite se ponovo.'; end if;
 select role into actor_role from public.users where id=actor;
 if p_action='logout' then
  delete from app_private.username_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
  return jsonb_build_object('ok',true);
 end if;
 if p_action='changePassword' then
  if length(coalesce(p_payload->>'password','')) not between 12 and 128 or not exists(select 1 from app_private.username_accounts where user_id=actor and extensions.crypt(encode(extensions.digest(p_payload->>'currentPassword','sha256'),'hex'),password_hash)=password_hash) then raise exception 'APP:Provjerite trenutnu lozinku. Nova lozinka mora imati najmanje 12 znakova.'; end if;
  update app_private.username_accounts set password_hash=extensions.crypt(encode(extensions.digest(p_payload->>'password','sha256'),'hex'),extensions.gen_salt('bf',12)),must_change_password=false where user_id=actor;
  delete from app_private.username_sessions where user_id=actor and token_hash<>encode(extensions.digest(p_token,'sha256'),'hex');
  return jsonb_build_object('ok',true);
 end if;
 if p_preview is not null and (actor_role<>'admin' or p_action<>'snapshot') then raise exception 'APP:Pregledi su dostupni samo administratoru, bez izmjena.'; end if;
 if actor_role='admin' and p_preview is null then
  if p_action<>'snapshot' then raise exception 'APP:Odaberite odgovarajući stručni račun za ovu radnju.'; end if;
  return jsonb_build_object('actor',(select to_jsonb(u) from public.users u where id=actor),
   'adminUsers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role,'onboarded',onboarded) order by name) from public.users),'[]'),
   'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select action,created_at,actor_id from public.audit order by created_at desc limit 30) a),'[]'));
 end if;
 target:=coalesce(p_preview,actor);
 if not exists(select 1 from public.users where id=target and role in ('client','trainer')) then raise exception 'APP:Ovaj stručni prostor još nije dostupan.'; end if;
 perform set_config('request.jwt.claim.sub',target,true);
 if p_action='snapshot' then
  result:=public.workspace_snapshot(p_client_id)||jsonb_build_object('readOnly',p_preview is not null,
   'usernameAccount',true,'mustChangePassword',(select must_change_password from app_private.username_accounts where user_id=actor));
 else result:=public.workspace_action(p_action,p_payload); end if;
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 raise;
end $$;
revoke all on function public.username_login(text,text),public.username_workspace(text,text,jsonb,text,text) from public;
grant execute on function public.username_login(text,text),public.username_workspace(text,text,jsonb,text,text) to anon,authenticated;
commit;
