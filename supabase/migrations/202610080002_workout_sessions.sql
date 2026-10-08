begin;
create table public.workout_sessions(id text primary key,client_id text not null references public.users(id),plan_id text not null references public.plans(id),started_at timestamptz not null default now(),completed_at timestamptz);
create unique index one_active_workout on public.workout_sessions(client_id) where completed_at is null;
alter table public.workout_logs add column session_id text references public.workout_sessions(id);
insert into public.workout_sessions(id,client_id,plan_id,completed_at) select 'legacy-'||plan_id,client_id,plan_id,max(completed_at) from public.workout_logs group by client_id,plan_id;
update public.workout_logs set session_id='legacy-'||plan_id;
alter table public.workout_logs alter column session_id set not null;
alter table public.workout_logs drop constraint workout_logs_client_id_plan_id_exercise_id_set_index_key;
alter table public.workout_logs add unique(session_id,exercise_id,set_index);
alter table public.workout_sessions enable row level security;
revoke all on public.workout_sessions from public,anon,authenticated;
grant select on public.workout_sessions to authenticated;
create policy sessions_read on public.workout_sessions for select to authenticated using(app_private.can_access_client(client_id));
alter function public.workspace_snapshot(text) set schema app_private;
alter function public.workspace_action(text,jsonb) set schema app_private;
revoke all on function app_private.workspace_snapshot(text),app_private.workspace_action(text,jsonb) from public,anon,authenticated;

create function public.workspace_snapshot(p_client_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=app_private.workspace_snapshot(p_client_id);
 return result||jsonb_build_object('sessions',coalesce((select jsonb_agg(to_jsonb(s) order by started_at desc) from public.workout_sessions s where client_id=result->>'clientId'),'[]'));
end $$;

create function public.workspace_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text:=auth.uid()::text; session_record public.workout_sessions; item jsonb; new_id text:=gen_random_uuid()::text;
begin
 if p_action not in ('startSession','completeSession','logSet') then return app_private.workspace_action(p_action,p_payload); end if;
 if actor is null then raise exception 'APP:Sign in to continue.'; end if;
 if coalesce(p_payload->>'clientId',actor)<>actor then raise exception 'APP:Only the member can record performed sets.'; end if;
 perform id from public.users where id=actor for update;
 if p_action='startSession' then
  if not exists(select 1 from public.plans where id=p_payload->>'planId' and client_id=actor) then raise exception 'APP:Choose your assigned plan.'; end if;
  select * into session_record from public.workout_sessions where client_id=actor and completed_at is null;
  if session_record.id is not null then return jsonb_build_object('ok',true,'sessionId',session_record.id); end if;
  insert into public.workout_sessions(id,client_id,plan_id) values(new_id,actor,p_payload->>'planId');
  insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,p_action,new_id);
  return jsonb_build_object('ok',true,'sessionId',new_id);
 end if;
 select * into session_record from public.workout_sessions where id=p_payload->>'sessionId' and client_id=actor and completed_at is null for update;
 if session_record.id is null then raise exception 'APP:This session is no longer active.'; end if;
 if p_action='completeSession' then
  if not exists(select 1 from public.workout_logs where session_id=session_record.id) then raise exception 'APP:Record at least one set first.'; end if;
  update public.workout_sessions set completed_at=now() where id=session_record.id;
 else
  if session_record.plan_id is distinct from p_payload->>'planId' then raise exception 'APP:Session and plan do not match.'; end if;
  select e into item from public.plans p cross join lateral jsonb_array_elements(p.exercises) e where p.id=session_record.plan_id and e->>'id'=p_payload->>'exerciseId';
  if item is null or not coalesce((p_payload->>'setIndex')::numeric between 0 and (item->>'sets')::integer-1 and (p_payload->>'setIndex')::numeric=trunc((p_payload->>'setIndex')::numeric) and (p_payload->>'reps')::numeric between 1 and 200 and (p_payload->>'reps')::numeric=trunc((p_payload->>'reps')::numeric) and (p_payload->>'weight')::numeric between 0 and 1000,false) then raise exception 'APP:Check the set details.'; end if;
  insert into public.workout_logs(id,client_id,plan_id,session_id,exercise_id,set_index,weight,reps) values((p_payload->>'id')::uuid::text,actor,session_record.plan_id,session_record.id,p_payload->>'exerciseId',(p_payload->>'setIndex')::integer,(p_payload->>'weight')::numeric,(p_payload->>'reps')::integer) on conflict(session_id,exercise_id,set_index) do update set weight=excluded.weight,reps=excluded.reps;
 end if;
 insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,p_action,session_record.id);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.workspace_snapshot(text),public.workspace_action(text,jsonb) from public,anon;
grant execute on function public.workspace_snapshot(text),public.workspace_action(text,jsonb) to authenticated;
commit;
