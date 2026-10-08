begin;
create table public.medication_access(client_id text references public.users(id), expert_id text references public.users(id), granted boolean not null default false, updated_at timestamptz not null default now(), primary key(client_id,expert_id));
create table public.medication_records(id uuid primary key,client_id text not null references public.users(id),content jsonb not null,version integer not null check(version>0),created_by text not null references public.users(id),created_name text not null,created_at timestamptz not null default now(),updated_by text not null references public.users(id),updated_name text not null,updated_at timestamptz not null default now(),removed_at timestamptz);
create table public.medication_versions(record_id uuid references public.medication_records(id),version integer not null,actor_id text not null references public.users(id),actor_name text not null,actor_role text not null,content jsonb not null,removed_at timestamptz,created_at timestamptz not null default now(),primary key(record_id,version));
alter table public.medication_access enable row level security;
alter table public.medication_records enable row level security;
alter table public.medication_versions enable row level security;
revoke all on public.medication_access,public.medication_records,public.medication_versions from anon,authenticated;

create function app_private.medications_dispatch(actor text,action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text; actor_name text; target text; allowed boolean; previous public.medication_records; saved public.medication_records; entry_id uuid; content jsonb; result jsonb;
begin
 select u.role,u.name into actor_role,actor_name from public.users u where u.id=actor;
 if actor_role is null or actor_role not in ('client','trainer','doctor') then raise exception 'APP:Pristup evidenciji nije dozvoljen.'; end if;
 if length(payload::text)>8000 then raise exception 'APP:Zahtjev je prevelik.'; end if;
 target:=case when actor_role='client' then actor else nullif(payload->>'clientId','') end;
 if actor_role='client' and nullif(payload->>'clientId','') is not null and payload->>'clientId'<>actor then raise exception 'APP:Pristup nije dozvoljen.'; end if;
 if actor_role<>'client' and target is not null and not exists(select 1 from public.relationships where client_id=target and expert_id=actor and status='active') then raise exception 'APP:Odaberite svog aktivnog klijenta.'; end if;
 if target is not null then perform id from public.users where id=target for update; end if;
 if action='grant' then
  if actor_role<>'client' or jsonb_typeof(payload->'granted') is distinct from 'boolean' or not exists(select 1 from public.relationships r join public.users u on u.id=r.expert_id where r.client_id=actor and r.expert_id=payload->>'expertId' and r.status='active' and u.role in ('trainer','doctor')) then raise exception 'APP:Odaberite povezanog doktora ili trenera.'; end if;
  insert into public.medication_access(client_id,expert_id,granted) values(actor,payload->>'expertId',(payload->>'granted')::boolean) on conflict(client_id,expert_id) do update set granted=excluded.granted,updated_at=now();
  insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'medication_access',actor);
 elsif action not in ('snapshot','save','remove','restore') then raise exception 'APP:Nepoznata radnja.';
 end if;

 allowed:=target=actor or exists(select 1 from public.medication_access a join public.relationships r on r.client_id=a.client_id and r.expert_id=a.expert_id where a.client_id=target and a.expert_id=actor and a.granted and r.status='active');
 if action in ('save','remove','restore') then
  if allowed is not true then raise exception 'APP:Klijent nije odobrio pristup ovoj evidenciji.'; end if;
  entry_id:=(payload->>'id')::uuid;
  if entry_id is null then raise exception 'APP:Provjerite unos.'; end if;
  select * into previous from public.medication_records where id=entry_id for update;
  if previous.id is not null and previous.client_id<>target then raise exception 'APP:Pristup nije dozvoljen.'; end if;
  if coalesce((payload->>'version')::integer,-1)<>coalesce(previous.version,0) then raise exception 'APP:Unos je u međuvremenu promijenjen. Osvježite evidenciju prije uređivanja.'; end if;
  if action='save' then
   content:=payload->'content';
   if jsonb_typeof(content) is distinct from 'object' or content->>'category' is null or content->>'category' not in ('medication','supplement','ped') or length(trim(coalesce(content->>'name',''))) not between 1 and 120 or length(coalesce(content->>'dose',''))>120 or length(coalesce(content->>'route',''))>80 or length(coalesce(content->>'frequency',''))>120 or length(coalesce(content->>'timing',''))>300 or length(coalesce(content->>'note',''))>1000 or content->>'status' is null or content->>'status' not in ('active','paused','stopped') then raise exception 'APP:Provjerite naziv, vrstu i ostala polja.'; end if;
   if nullif(content->>'start','')::date<'1900-01-01' or nullif(content->>'end','')::date<'1900-01-01' or nullif(content->>'end','')::date<nullif(content->>'start','')::date then raise exception 'APP:Provjerite datume.'; end if;
   -- Only the defined record fields are retained. No generated prescribing advice.
   content:=jsonb_build_object('category',content->>'category','name',trim(content->>'name'),'dose',coalesce(content->>'dose',''),'route',coalesce(content->>'route',''),'frequency',coalesce(content->>'frequency',''),'timing',coalesce(content->>'timing',''),'note',coalesce(content->>'note',''),'status',content->>'status','start',nullif(content->>'start',''),'end',nullif(content->>'end',''));
   insert into public.medication_records(id,client_id,content,version,created_by,created_name,updated_by,updated_name) values(entry_id,target,content,1,actor,actor_name,actor,actor_name) on conflict(id) do update set content=excluded.content,version=public.medication_records.version+1,updated_by=actor,updated_name=actor_name,updated_at=now(),removed_at=null returning * into saved;
  else
   if previous.id is null then raise exception 'APP:Unos nije pronađen.'; end if;
   update public.medication_records set removed_at=case when action='remove' then now() else null end,version=version+1,updated_by=actor,updated_name=actor_name,updated_at=now() where id=entry_id returning * into saved;
  end if;
  insert into public.medication_versions(record_id,version,actor_id,actor_name,actor_role,content,removed_at) values(saved.id,saved.version,actor,actor_name,actor_role,saved.content,saved.removed_at);
  insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'medication_'||action,saved.id::text);
 end if;
 select jsonb_build_object('actor',jsonb_build_object('id',actor,'name',actor_name,'role',actor_role),'clientId',target,'allowed',coalesce(allowed,false),
  'clients',case when actor_role in ('trainer','doctor') then coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name) order by u.name) from public.relationships r join public.users u on u.id=r.client_id where r.expert_id=actor and r.status='active'),'[]') else '[]'::jsonb end,
  'team',case when actor_role='client' then coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'role',u.role,'granted',coalesce(a.granted,false)) order by u.name) from public.relationships r join public.users u on u.id=r.expert_id left join public.medication_access a on a.client_id=r.client_id and a.expert_id=r.expert_id where r.client_id=actor and r.status='active' and u.role in ('trainer','doctor')),'[]') else '[]'::jsonb end,
  'entries',case when allowed then coalesce((select jsonb_agg(to_jsonb(m) order by m.updated_at desc) from public.medication_records m where m.client_id=target),'[]') else '[]'::jsonb end,
  'history',case when allowed then coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc,v.version desc) from public.medication_versions v join public.medication_records m on m.id=v.record_id where m.client_id=target),'[]') else '[]'::jsonb end) into result;
 return result;
end $$;
revoke all on function app_private.medications_dispatch(text,text,jsonb) from public,anon,authenticated;
create function public.medications_action(p_action text default 'snapshot',p_payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select app_private.medications_dispatch(auth.uid()::text,p_action,p_payload)$$;
revoke all on function public.medications_action(text,jsonb) from public,anon;
grant execute on function public.medications_action(text,jsonb) to authenticated;
create function public.username_medications(p_token text,p_action text default 'snapshot',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 if length(p_token)<>64 then raise exception 'APP:Prijavite se ponovo.'; end if;
 select user_id into actor from app_private.username_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 if actor is null then raise exception 'APP:Vaša sesija je istekla.'; end if;
 return app_private.medications_dispatch(actor,p_action,p_payload);
end $$;
revoke all on function public.username_medications(text,text,jsonb) from public;
grant execute on function public.username_medications(text,text,jsonb) to anon,authenticated;

create or replace function public.workspace_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=app_private.workspace_action_before_cycle(p_action,p_payload);
 if p_action='onboard' then
  update public.preferences set modules=(select coalesce(jsonb_agg(distinct value),'[]') from jsonb_array_elements_text(p_payload->'modules') where value in ('training','nutrition','progress','recovery','cycle','medications')) where user_id=auth.uid()::text;
 end if;
 return result;
end $$;
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
 if actor_role='doctor' and p_action<>'snapshot' then raise exception 'APP:Koristite stručnu evidenciju za ovu radnju.'; end if;
 target:=coalesce(p_preview,actor);
 if not exists(select 1 from public.users where id=target and role in ('client','trainer','doctor')) then raise exception 'APP:Ovaj stručni prostor još nije dostupan.'; end if;
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

commit;
