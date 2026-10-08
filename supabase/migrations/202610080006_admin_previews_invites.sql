begin;
create or replace function public.username_workspace(p_token text,p_action text default 'snapshot',p_payload jsonb default '{}',p_client_id text default null,p_preview text default null) returns jsonb
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
 if p_preview='role:trainer' then
  return jsonb_build_object('actor',jsonb_build_object('id','preview-trainer','name','Pregled trenera','role','trainer','email','','onboarded',true),
   'preferences',jsonb_build_object('modules','["training","nutrition","progress","recovery"]'::jsonb,'intake','{}'::jsonb,'version',1),
   'clientId','','clients','[]'::jsonb,'plans','[]'::jsonb,'logs','[]'::jsonb,'checkins','[]'::jsonb,'tasks','[]'::jsonb,
   'team','[]'::jsonb,'messages','[]'::jsonb,'diary','[]'::jsonb,'sessions','[]'::jsonb,'readOnly',true);
 end if;
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
alter function public.workspace_action(text,jsonb) rename to workspace_action_timed;
alter function public.workspace_action_timed(text,jsonb) set schema app_private;
revoke all on function app_private.workspace_action_timed(text,jsonb) from public,anon,authenticated;

create function public.workspace_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare resolved_email text;
begin
 if p_action='invite' and position('@' in coalesce(p_payload->>'email',''))=0 then
  if not app_private.is_trainer() then raise exception 'APP:Samo trener može kreirati poziv.'; end if;
  select u.email into resolved_email from app_private.username_accounts a join public.users u on u.id=a.user_id where a.username=lower(trim(p_payload->>'email')) and u.role='client';
  if resolved_email is null then raise exception 'APP:Korisničko ime nije pronađeno. Provjerite ime ili unesite e-poštu.'; end if;
  p_payload:=jsonb_set(p_payload,'{email}',to_jsonb(resolved_email));
 end if;
 return app_private.workspace_action_timed(p_action,p_payload);
end $$;
revoke all on function public.workspace_action(text,jsonb) from public,anon;
grant execute on function public.workspace_action(text,jsonb) to authenticated;
commit;
