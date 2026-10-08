-- Original fitness workspace foundation. No real people, clinical data or demo identities are seeded.
begin;
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.users (
 id text primary key, auth_id uuid unique not null references auth.users(id) on delete cascade,
 email text not null, name text not null check(length(name) between 2 and 80),
 role text not null default 'client' check(role in ('client','trainer','doctor','nutritionist','therapist')),
 onboarded boolean not null default false, created_at timestamptz not null default now()
);
create table public.preferences(user_id text primary key references public.users(id),modules jsonb not null default '["training","nutrition","progress","recovery"]',intake jsonb not null default '{}',version integer not null default 1,updated_at timestamptz default now());
create table public.relationships(id text primary key,expert_id text not null references public.users(id),client_id text not null references public.users(id),status text not null default 'active' check(status in ('active','paused','ended')),unique(expert_id,client_id));
create table public.invitations(id text primary key,token_hash text unique not null,expert_id text not null references public.users(id),email text not null,status text not null default 'pending' check(status in ('pending','accepted','revoked')),expires_at timestamptz not null);
create table public.plans(id text primary key,client_id text not null references public.users(id),author_id text not null references public.users(id),title text not null check(length(title) between 3 and 120),version integer not null,exercises jsonb not null,status text not null default 'published',reason text check(length(reason) between 3 and 500),created_at timestamptz default now(),unique(client_id,version));
create table public.workout_logs(id text primary key,client_id text not null references public.users(id),plan_id text not null references public.plans(id),exercise_id text not null,set_index integer not null check(set_index between 0 and 30),weight numeric not null check(weight between 0 and 1000),reps integer not null check(reps between 1 and 200),completed_at timestamptz default now(),unique(client_id,plan_id,exercise_id,set_index));
create table public.checkins(id text primary key,client_id text not null references public.users(id),energy integer not null check(energy between 1 and 5),sleep numeric not null check(sleep between 0 and 24),note text check(length(note)<=2000),status text default 'pending',review_note text,created_at timestamptz default now());
create table public.tasks(id text primary key,owner_id text not null references public.users(id),client_id text not null references public.users(id),checkin_id text references public.checkins(id),kind text not null,title text not null,status text default 'open',created_at timestamptz default now());
create table public.messages(id text primary key,sender_id text not null references public.users(id),recipient_id text not null references public.users(id),body text not null check(length(body) between 1 and 2000),created_at timestamptz default now());
create table public.diary(id text primary key,user_id text not null references public.users(id),kind text not null check(kind in ('meal','water','sleep','energy','measurement')),label text not null check(length(label) between 1 and 200),value numeric check(value between 0 and 10000),created_at timestamptz default now());
create table public.audit(id text primary key,actor_id text not null references public.users(id),action text not null,resource_id text,created_at timestamptz default now());
create index relationships_client on public.relationships(client_id,status);
create index tasks_owner on public.tasks(owner_id,status);
create index plans_client on public.plans(client_id,version desc);
create index messages_participants on public.messages(sender_id,recipient_id,created_at);

create function app_private.bootstrap_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.users(id,auth_id,email,name) values(new.id::text,new.id,new.email,left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'New member'),80));
 insert into public.preferences(user_id) values(new.id::text);
 return new;
end $$;
create trigger fitness_auth_user after insert on auth.users for each row execute function app_private.bootstrap_user();

create function app_private.is_trainer() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.users where id=auth.uid()::text and role='trainer');
$$;
create function app_private.can_access_client(target text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (target=auth.uid()::text or (app_private.is_trainer() and exists(select 1 from public.relationships where expert_id=auth.uid()::text and client_id=target and status='active')));
$$;
revoke all on all functions in schema app_private from public;
grant execute on function app_private.is_trainer(),app_private.can_access_client(text) to authenticated;

alter table public.users enable row level security;
alter table public.preferences enable row level security;
alter table public.relationships enable row level security;
alter table public.invitations enable row level security;
alter table public.plans enable row level security;
alter table public.workout_logs enable row level security;
alter table public.checkins enable row level security;
alter table public.tasks enable row level security;
alter table public.messages enable row level security;
alter table public.diary enable row level security;
alter table public.audit enable row level security;
revoke all on public.users,public.preferences,public.relationships,public.invitations,public.plans,public.workout_logs,public.checkins,public.tasks,public.messages,public.diary,public.audit from anon,authenticated;
grant select on public.users,public.preferences,public.relationships,public.plans,public.workout_logs,public.checkins,public.tasks,public.messages,public.diary,public.audit to authenticated;
create policy own_or_assigned_user on public.users for select to authenticated using(app_private.can_access_client(id) or exists(select 1 from public.relationships where expert_id=id and client_id=auth.uid()::text and status='active'));
create policy own_preferences on public.preferences for select to authenticated using(user_id=auth.uid()::text);
create policy own_relationships on public.relationships for select to authenticated using(expert_id=auth.uid()::text or client_id=auth.uid()::text);
create policy assigned_plans on public.plans for select to authenticated using(app_private.can_access_client(client_id));
create policy assigned_logs on public.workout_logs for select to authenticated using(app_private.can_access_client(client_id));
create policy assigned_checkins on public.checkins for select to authenticated using(app_private.can_access_client(client_id));
create policy owned_tasks on public.tasks for select to authenticated using(owner_id=auth.uid()::text and app_private.can_access_client(client_id));
create policy active_messages on public.messages for select to authenticated using((sender_id=auth.uid()::text or recipient_id=auth.uid()::text) and exists(select 1 from public.relationships where status='active' and ((expert_id=sender_id and client_id=recipient_id) or (expert_id=recipient_id and client_id=sender_id))));
create policy assigned_diary on public.diary for select to authenticated using(app_private.can_access_client(user_id));
create policy own_audit on public.audit for select to authenticated using(actor_id=auth.uid()::text);

create function public.workspace_snapshot(p_client_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text:=auth.uid()::text; target text; trainer boolean; result jsonb;
begin
 if actor is null then raise exception 'APP:Sign in to continue.'; end if;
 trainer:=app_private.is_trainer();
 target:=coalesce(p_client_id,case when trainer then (select client_id from public.relationships where expert_id=actor and status='active' order by client_id limit 1) else actor end,actor);
 if not app_private.can_access_client(target) then raise exception 'APP:Access denied.'; end if;
 select jsonb_build_object(
 'actor',(select to_jsonb(u) from public.users u where id=actor),
 'preferences',(select to_jsonb(p) from public.preferences p where user_id=actor),
 'clientId',target,
 'clients',case when trainer then coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'email',u.email,'onboarded',u.onboarded) order by u.name) from public.users u join public.relationships r on r.client_id=u.id where r.expert_id=actor and r.status='active'),'[]') else '[]'::jsonb end,
 'plans',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('author_name',u.name) order by p.version desc) from public.plans p join public.users u on u.id=p.author_id where p.client_id=target),'[]'),
 'logs',coalesce((select jsonb_agg(to_jsonb(l) order by completed_at) from public.workout_logs l where client_id=target),'[]'),
 'checkins',coalesce((select jsonb_agg(to_jsonb(c) order by created_at desc) from public.checkins c where client_id=target),'[]'),
 'tasks',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('client_name',u.name) order by t.created_at desc) from public.tasks t join public.users u on u.id=t.client_id where owner_id=actor and app_private.can_access_client(t.client_id)),'[]'),
 'team',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'role',u.role)) from public.users u join public.relationships r on r.expert_id=u.id where r.client_id=target and r.status='active'),'[]'),
 'messages',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('sender_name',u.name) order by m.created_at) from public.messages m join public.users u on u.id=m.sender_id where (sender_id=actor or recipient_id=actor) and (target=actor or sender_id=target or recipient_id=target) and exists(select 1 from public.relationships r where r.status='active' and ((r.expert_id=m.sender_id and r.client_id=m.recipient_id) or (r.expert_id=m.recipient_id and r.client_id=m.sender_id)))),'[]'),
 'diary',coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc) from public.diary d where user_id=target),'[]'),
 'environment','supabase-development') into result;
 return result;
end $$;

create function public.workspace_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text:=auth.uid()::text; target text:=coalesce(p_payload->>'clientId',auth.uid()::text); new_id text:=gen_random_uuid()::text; raw_token text; trainer boolean; item jsonb; previous integer; task_record public.tasks; invite_record public.invitations;
begin
 if actor is null then raise exception 'APP:Sign in to continue.'; end if;
 if length(p_payload::text)>16000 then raise exception 'APP:Request too large.'; end if;
 if not app_private.can_access_client(target) then raise exception 'APP:Access denied.'; end if;
 trainer:=app_private.is_trainer();
 case p_action
 when 'preferences' then
  if jsonb_typeof(p_payload->'modules')<>'array' or jsonb_array_length(p_payload->'modules')>10 then raise exception 'APP:Invalid modules.'; end if;
  update public.preferences set modules=(select coalesce(jsonb_agg(distinct value),'[]') from jsonb_array_elements_text(p_payload->'modules') where value in ('training','nutrition','progress','recovery','cycle','rehab','labs','medications','community','wearables')),version=version+1,updated_at=now() where user_id=actor;
 when 'onboard' then
  if (p_payload->'intake'->>'days')::integer not between 1 and 7 or length(p_payload->'intake'->>'goal')>100 or length(p_payload->'intake'->>'setting')>60 or jsonb_typeof(p_payload->'modules')<>'array' then raise exception 'APP:Check your preferences.'; end if;
  update public.preferences set modules=(select coalesce(jsonb_agg(distinct value),'[]') from jsonb_array_elements_text(p_payload->'modules') where value in ('training','nutrition','progress','recovery')),intake=p_payload->'intake',version=version+1 where user_id=actor;
  update public.users set onboarded=true where id=actor;
 when 'logSet' then
  if actor<>target then raise exception 'APP:Only the member can record performed sets.'; end if;
  select e into item from public.plans p cross join lateral jsonb_array_elements(p.exercises) e where p.id=p_payload->>'planId' and p.client_id=actor and e->>'id'=p_payload->>'exerciseId';
  if item is null or (p_payload->>'setIndex')::integer<0 or (p_payload->>'setIndex')::integer>=(item->>'sets')::integer then raise exception 'APP:Set is not in your plan.'; end if;
  insert into public.workout_logs(id,client_id,plan_id,exercise_id,set_index,weight,reps) values((p_payload->>'id')::uuid::text,actor,p_payload->>'planId',p_payload->>'exerciseId',(p_payload->>'setIndex')::integer,(p_payload->>'weight')::numeric,(p_payload->>'reps')::integer) on conflict(client_id,plan_id,exercise_id,set_index) do update set weight=excluded.weight,reps=excluded.reps;
 when 'checkin' then
  if actor<>target then raise exception 'APP:Only the member can submit a check-in.'; end if;
  insert into public.checkins(id,client_id,energy,sleep,note) values(new_id,actor,(p_payload->>'energy')::integer,(p_payload->>'sleep')::numeric,p_payload->>'note');
  insert into public.tasks(id,owner_id,client_id,checkin_id,kind,title) select gen_random_uuid()::text,expert_id,actor,new_id,'checkin','Weekly check-in ready to review' from public.relationships where client_id=actor and status='active';
 when 'review' then
  if not trainer then raise exception 'APP:Trainer access required.'; end if;
  select * into task_record from public.tasks where id=p_payload->>'taskId' and owner_id=actor and status='open' for update;
  if task_record.id is null or not app_private.can_access_client(task_record.client_id) or length(trim(p_payload->>'note')) not between 1 and 2000 then raise exception 'APP:Review is no longer available or response is invalid.'; end if;
  update public.tasks set status='resolved' where id=task_record.id;
  update public.checkins set status='reviewed',review_note=p_payload->>'note' where id=task_record.checkin_id;
 when 'publishPlan' then
  if not trainer or target=actor then raise exception 'APP:Select an assigned client.'; end if;
  if jsonb_typeof(p_payload->'exercises')<>'array' or jsonb_array_length(p_payload->'exercises') not between 1 and 20 then raise exception 'APP:Add 1 to 20 exercises.'; end if;
  for item in select value from jsonb_array_elements(p_payload->'exercises') loop
   if length(item->>'id') not between 1 and 40 or length(item->>'name') not between 2 and 80 or (item->>'sets')::integer not between 1 and 10 or length(item->>'reps') not between 1 and 30 or (item->>'weight')::numeric not between 0 and 1000 then raise exception 'APP:Check exercise details.'; end if;
  end loop;
  perform id from public.users where id=target for update;
  select coalesce(max(version),0)+1 into previous from public.plans where client_id=target;
  insert into public.plans(id,client_id,author_id,title,version,exercises,reason) values(new_id,target,actor,p_payload->>'title',previous,p_payload->'exercises',p_payload->>'reason');
 when 'message' then
  if not exists(select 1 from public.relationships where status='active' and ((expert_id=actor and client_id=p_payload->>'recipientId') or (client_id=actor and expert_id=p_payload->>'recipientId'))) then raise exception 'APP:An active relationship is required.'; end if;
  insert into public.messages(id,sender_id,recipient_id,body) values(new_id,actor,p_payload->>'recipientId',trim(p_payload->>'text'));
 when 'diary' then
  if actor<>target then raise exception 'APP:Only the member can record their diary.'; end if;
  insert into public.diary(id,user_id,kind,label,value) values(new_id,actor,p_payload->>'kind',trim(p_payload->>'label'),(p_payload->>'value')::numeric);
 when 'invite' then
  if not trainer or (p_payload->>'email')!~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'APP:Trainer access and a valid email are required.'; end if;
  raw_token:=gen_random_uuid()::text;
  insert into public.invitations(id,token_hash,expert_id,email,expires_at) values(new_id,encode(extensions.digest(raw_token,'sha256'),'hex'),actor,lower(p_payload->>'email'),now()+interval '7 days');
  insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,p_action,new_id);
  return jsonb_build_object('ok',true,'inviteToken',raw_token,'note','Invitation created. No email sent.');
 when 'acceptInvite' then
  if trainer then raise exception 'APP:Member account required.'; end if;
  select i.* into invite_record from public.invitations i join public.users u on u.id=actor and lower(u.email)=i.email where token_hash=encode(extensions.digest(p_payload->>'token','sha256'),'hex') and status='pending' and expires_at>now() for update of i;
  if invite_record.id is null then raise exception 'APP:Invitation is expired or belongs to another email.'; end if;
  insert into public.relationships(id,expert_id,client_id) values(new_id,invite_record.expert_id,actor) on conflict(expert_id,client_id) do update set status='active';
  update public.invitations set status='accepted' where id=invite_record.id;
 else raise exception 'APP:Unknown action.';
 end case;
 insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,p_action,target);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.workspace_snapshot(text),public.workspace_action(text,jsonb) from public,anon;
grant execute on function public.workspace_snapshot(text),public.workspace_action(text,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('private-records','private-records',false,10485760,array['image/jpeg','image/png','application/pdf']) on conflict(id) do nothing;
-- No object upload/read policy yet: quarantine/scan/release pipeline must exist before activation.
commit;
