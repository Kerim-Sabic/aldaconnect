begin;
alter table app_private.username_accounts add column recovery_hash text;
create function public.username_register(p_name text,p_username text,p_password text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=gen_random_uuid(); uname text:=lower(trim(p_username)); recovery text:=encode(extensions.gen_random_bytes(32),'hex');
begin
 if length(trim(p_name)) not between 2 and 80 or uname!~'^[a-z0-9][a-z0-9_.-]{2,39}$' or length(p_password) not between 12 and 128 then raise exception 'APP:Unesite ime, korisničko ime od 3 do 40 znakova i lozinku od najmanje 12 znakova.'; end if;
 if uname in ('alda','admin','administrator','owner','support','root') or exists(select 1 from app_private.username_accounts where username=uname) then raise exception 'APP:Korisničko ime nije dostupno. Odaberite drugo.'; end if;
 if (select count(*) from public.users where created_at>now()-interval '1 hour')>=300 then raise exception 'APP:Kreiranje računa je privremeno ograničeno. Pokušajte kasnije.'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(uid,uname||'@accounts.aldaconnect.invalid',jsonb_build_object('name',trim(p_name)));
 insert into app_private.username_accounts(username,user_id,password_hash,must_change_password,recovery_hash) values(uname,uid::text,extensions.crypt(encode(extensions.digest(p_password,'sha256'),'hex'),extensions.gen_salt('bf',12)),false,encode(extensions.digest(recovery,'sha256'),'hex'));
 return public.username_login(uname,p_password)||jsonb_build_object('recoveryCode',recovery);
end $$;
revoke all on function public.username_register(text,text,text) from public;
grant execute on function public.username_register(text,text,text) to anon,authenticated;
create function public.username_recover(p_username text,p_recovery text,p_password text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare account app_private.username_accounts; recovery text;
begin
 if p_password is null or p_username is null or p_recovery is null or length(p_password) not between 12 and 128 or length(p_username)>40 or length(p_recovery)<>64 then return jsonb_build_object('error','Provjerite korisničko ime, kod za oporavak i novu lozinku od najmanje 12 znakova.'); end if;
 select * into account from app_private.username_accounts where username=lower(trim(p_username)) for update;
 if account.user_id is null or account.locked_until>now() then return jsonb_build_object('error','Podaci za oporavak nisu ispravni. Pokušajte kasnije.'); end if;
 if account.recovery_hash is null or account.recovery_hash is distinct from encode(extensions.digest(lower(trim(p_recovery)),'sha256'),'hex') then
  update app_private.username_accounts set failures=case when failures>=4 then 0 else failures+1 end,locked_until=case when failures>=4 then now()+interval '15 minutes' else null end where user_id=account.user_id;
  return jsonb_build_object('error','Podaci za oporavak nisu ispravni.');
 end if;
 recovery:=encode(extensions.gen_random_bytes(32),'hex');
 update app_private.username_accounts set password_hash=extensions.crypt(encode(extensions.digest(p_password,'sha256'),'hex'),extensions.gen_salt('bf',12)),recovery_hash=encode(extensions.digest(recovery,'sha256'),'hex'),failures=0,locked_until=null,must_change_password=false where user_id=account.user_id;
 delete from app_private.username_sessions where user_id=account.user_id;
 insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,account.user_id,'account_recovery',account.user_id);
 return jsonb_build_object('ok',true,'recoveryCode',recovery);
end $$;
revoke all on function public.username_recover(text,text,text) from public;
grant execute on function public.username_recover(text,text,text) to anon,authenticated;
create table public.training_groups (
 id text primary key default gen_random_uuid()::text,
 owner_id text not null references public.users(id),
 name text not null check(length(trim(name)) between 2 and 80),
 created_at timestamptz not null default now()
);
create table public.group_members (
 group_id text not null references public.training_groups(id),
 user_id text not null references public.users(id),
 status text not null default 'invited' check(status in ('invited','active','declined','left')),
 invited_at timestamptz not null default now(),responded_at timestamptz,
 primary key(group_id,user_id)
);
create table public.group_messages (
 id text primary key default gen_random_uuid()::text,
 group_id text not null references public.training_groups(id),
 sender_id text not null references public.users(id),
 body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index group_members_user on public.group_members(user_id,status);
create index group_messages_feed on public.group_messages(group_id,created_at desc);
create index messages_recipient_time on public.messages(recipient_id,created_at desc);
create index checkins_client_status on public.checkins(client_id,status);
create index logs_client_time on public.workout_logs(client_id,completed_at desc);
alter table public.training_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
revoke all on public.training_groups,public.group_members,public.group_messages from public,anon,authenticated;

-- Owners can coach only clients who accepted a group invitation or a direct relationship.
create or replace function app_private.is_trainer() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid()::text and role in ('trainer','admin'));
$$;

create function app_private.portal_action(actor text,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare owner boolean; gid text:=p_payload->>'groupId'; new_id text; result jsonb; changed integer;
begin
 select role='admin' into owner from public.users where id=actor;
 if owner is null then raise exception 'APP:Prijavite se ponovo.'; end if;
 if length(p_payload::text)>16000 then raise exception 'APP:Zahtjev je prevelik.'; end if;
 if p_action='messages' then
  return jsonb_build_object('directMessages',coalesce((select jsonb_agg(to_jsonb(msg) order by msg.created_at) from (
   select m.*,u.name as sender_name from public.messages m join public.users u on u.id=m.sender_id
   where (m.sender_id=actor or m.recipient_id=actor) and exists(select 1 from public.relationships r where r.status='active' and ((r.expert_id=m.sender_id and r.client_id=m.recipient_id) or (r.expert_id=m.recipient_id and r.client_id=m.sender_id))) order by m.created_at desc limit 500
  ) msg),'[]'));
 end if;
 if p_action='createGroup' then
  if not owner then raise exception 'APP:Samo vlasnik može kreirati grupu.'; end if;
  if (select count(*) from public.training_groups where owner_id=actor)>=30 then raise exception 'APP:Dostigli ste ograničenje od 30 grupa.'; end if;
  insert into public.training_groups(owner_id,name) values(actor,trim(p_payload->>'name')) returning id into gid;
 elsif p_action='inviteGroup' then
  if not owner or not exists(select 1 from public.training_groups where id=gid and owner_id=actor) then raise exception 'APP:Grupa nije dostupna.'; end if;
  if coalesce(p_payload->>'scope','') not in ('all','single') then raise exception 'APP:Odaberite korisnika ili sve klijente.'; end if;
  if p_payload->>'scope'='single' and not exists(select 1 from public.users where id=p_payload->>'userId' and role='client') then raise exception 'APP:Klijent nije pronađen.'; end if;
  insert into public.group_members(group_id,user_id)
   select gid,id from public.users where role='client' and (p_payload->>'scope'='all' or id=p_payload->>'userId')
   on conflict(group_id,user_id) do update set status='invited',invited_at=now(),responded_at=null where public.group_members.status in ('declined','left');
  get diagnostics changed=row_count;
  insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'group_invitation',gid);
  return jsonb_build_object('ok',true,'invited',changed);
 elsif p_action='respondInvite' then
  if p_payload->>'response' not in ('active','declined') then raise exception 'APP:Provjerite odgovor na poziv.'; end if;
  update public.group_members set status=p_payload->>'response',responded_at=now() where group_id=gid and user_id=actor and status='invited';
  get diagnostics changed=row_count;
  if changed=0 then raise exception 'APP:Poziv više nije dostupan.'; end if;
  if p_payload->>'response'='active' then
   insert into public.relationships(id,expert_id,client_id,status) select gen_random_uuid()::text,owner_id,actor,'active' from public.training_groups where id=gid
   on conflict(expert_id,client_id) do update set status='active';
  end if;
 elsif p_action='leaveGroup' then
  update public.group_members set status='left',responded_at=now() where group_id=gid and user_id=actor and status='active';
  get diagnostics changed=row_count;
  if changed=0 then raise exception 'APP:Grupa nije dostupna.'; end if;
 elsif p_action='groupMessage' then
  if not exists(select 1 from public.training_groups g where g.id=gid and (g.owner_id=actor or exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=actor and m.status='active'))) then raise exception 'APP:Prvo prihvatite poziv u grupu.'; end if;
  if (select count(*) from public.group_messages where sender_id=actor and created_at>now()-interval '1 minute')>=30 then raise exception 'APP:Sačekajte trenutak prije nove poruke.'; end if;
  insert into public.group_messages(group_id,sender_id,body) values(gid,actor,trim(p_payload->>'text'));
 elsif p_action='ownerMessage' then
  if not owner then raise exception 'APP:Pristup nije dozvoljen.'; end if;
  return public.workspace_action('message',p_payload);
 elsif p_action='ownerPlan' then
  if not owner then raise exception 'APP:Pristup nije dozvoljen.'; end if;
  return public.workspace_action('publishPlan',p_payload);
 elsif p_action='ownerReview' then
  if not owner then raise exception 'APP:Pristup nije dozvoljen.'; end if;
  return public.workspace_action('review',p_payload);
 elsif p_action<>'snapshot' then raise exception 'APP:Nepoznata radnja.';
 end if;
 if p_action<>'snapshot' then
  insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,p_action,gid);
  return jsonb_build_object('ok',true,'groupId',gid);
 end if;
 if gid is not null and not exists(select 1 from public.training_groups g where g.id=gid and (g.owner_id=actor or exists(select 1 from public.group_members m where m.group_id=g.id and m.user_id=actor and m.status='active'))) then raise exception 'APP:Ova grupa nije dostupna.'; end if;
 return jsonb_build_object(
  'groups',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'ownerId',g.owner_id,'ownerName',u.name,'status',case when g.owner_id=actor then 'owner' else m.status end,'members',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'status',gm.status)) from public.group_members gm join public.users v on v.id=gm.user_id where gm.group_id=g.id and (g.owner_id=actor or gm.status='active' and m.status='active')),'[]'::jsonb)) order by g.created_at) from public.training_groups g join public.users u on u.id=g.owner_id left join public.group_members m on m.group_id=g.id and m.user_id=actor where g.owner_id=actor or m.status in ('invited','active')),'[]'),
  'messages',coalesce((select jsonb_agg(to_jsonb(msg) order by msg.created_at) from (select m.id,m.sender_id,m.body,m.created_at,u.name as sender_name from public.group_messages m join public.users u on u.id=m.sender_id where m.group_id=gid order by m.created_at desc limit 100) msg),'[]'),
  'directMessages',case when owner then coalesce((select jsonb_agg(to_jsonb(msg) order by msg.created_at) from (select m.*,u.name as sender_name from public.messages m join public.users u on u.id=m.sender_id where (m.sender_id=actor or m.recipient_id=actor) and exists(select 1 from public.relationships r where r.expert_id=actor and r.status='active' and (r.client_id=m.sender_id or r.client_id=m.recipient_id)) order by m.created_at desc limit 500) msg),'[]') else '[]'::jsonb end,
  'coachingClients',case when owner then coalesce((select jsonb_agg(client_id) from public.relationships where expert_id=actor and status='active'),'[]') else '[]'::jsonb end,
  'clients',case when owner then coalesce((select jsonb_agg(jsonb_build_object(
    'id',u.id,'name',u.name,'onboarded',u.onboarded,'created_at',u.created_at,
    'plan_title',(select title from public.plans where client_id=u.id order by version desc limit 1),
    'last_workout',(select max(completed_at) from public.workout_sessions where client_id=u.id),
    'workouts_week',(select count(*) from public.workout_sessions where client_id=u.id and completed_at>now()-interval '7 days'),
    'pending_checkins',(select count(*) from public.checkins where client_id=u.id and status='pending')
   ) order by u.name) from public.users u where role='client'),'[]') else '[]'::jsonb end,
  'tasks',case when owner then coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'clientId',t.client_id,'note',c.note,'energy',c.energy,'sleep',c.sleep,'created_at',c.created_at) order by t.created_at desc) from public.tasks t join public.checkins c on c.id=t.checkin_id where t.owner_id=actor and t.status='open' and app_private.can_access_client(t.client_id)),'[]') else '[]'::jsonb end,
  'audit',case when owner then coalesce((select jsonb_agg(to_jsonb(a)) from (select action,created_at,actor_id from public.audit where actor_id=actor order by created_at desc limit 30) a),'[]') else '[]'::jsonb end
 );
end $$;
revoke all on function app_private.portal_action(text,text,jsonb) from public,anon,authenticated;

create function public.portal_workspace(p_token text default null,p_action text default 'snapshot',p_payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text; previous_sub text:=current_setting('request.jwt.claim.sub',true); result jsonb;
begin
 if p_token is not null then
  if length(p_token)<>64 then raise exception 'APP:Prijavite se ponovo.'; end if;
  select user_id into actor from app_private.username_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 else actor:=auth.uid()::text; end if;
 if actor is null then raise exception 'APP:Vaša sesija je istekla.'; end if;
 perform set_config('request.jwt.claim.sub',actor,true);
 result:=app_private.portal_action(actor,p_action,p_payload);
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);
 return result;
exception when others then
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);raise;
end $$;
revoke all on function public.portal_workspace(text,text,jsonb) from public;
grant execute on function public.portal_workspace(text,text,jsonb) to anon,authenticated;

-- Email-authenticated administrators get the same read-only previews as username administrators.
create function public.owner_snapshot(p_preview text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text:=auth.uid()::text; previous_sub text:=current_setting('request.jwt.claim.sub',true); result jsonb;
begin
 if not exists(select 1 from public.users where id=actor and role='admin') then raise exception 'APP:Administratorski pristup je potreban.'; end if;
 if p_preview is null then return jsonb_build_object('actor',(select to_jsonb(u) from public.users u where id=actor),'adminUsers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'role',role,'onboarded',onboarded) order by name) from public.users),'[]'),'audit',coalesce((select jsonb_agg(to_jsonb(a)) from (select action,created_at,actor_id from public.audit order by created_at desc limit 30) a),'[]')); end if;
 if not exists(select 1 from public.users where id=p_preview and role in ('client','trainer')) then raise exception 'APP:Profil nije dostupan.'; end if;
 perform set_config('request.jwt.claim.sub',p_preview,true);
 result:=public.workspace_snapshot(null)||jsonb_build_object('readOnly',true);
 perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);return result;
exception when others then perform set_config('request.jwt.claim.sub',coalesce(previous_sub,''),true);raise;
end $$;
revoke all on function public.owner_snapshot(text) from public,anon;
grant execute on function public.owner_snapshot(text) to authenticated;
commit;
