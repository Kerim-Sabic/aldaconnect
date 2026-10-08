begin;
alter table public.workout_logs alter column reps drop not null;
alter table public.workout_logs add column duration_seconds integer check(duration_seconds between 1 and 3600);
alter table public.workout_logs add constraint one_set_measurement check((reps is not null)::integer+(duration_seconds is not null)::integer=1);
create or replace function public.workspace_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text:=auth.uid()::text; session_record public.workout_sessions; item jsonb; new_id text:=gen_random_uuid()::text; timed boolean; performed numeric;
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
  timed:=coalesce(item->>'metric'='seconds',false) or coalesce(item->>'reps'~* '\msec\M',false);
  performed:=case when timed then (p_payload->>'durationSeconds')::numeric else (p_payload->>'reps')::numeric end;
  if item is null or not coalesce((p_payload->>'setIndex')::numeric between 0 and (item->>'sets')::integer-1 and (p_payload->>'setIndex')::numeric=trunc((p_payload->>'setIndex')::numeric) and performed between 1 and case when timed then 3600 else 200 end and performed=trunc(performed) and (p_payload->>'weight')::numeric between 0 and 1000,false) then raise exception 'APP:Check the set details.'; end if;
  insert into public.workout_logs(id,client_id,plan_id,session_id,exercise_id,set_index,weight,reps,duration_seconds) values((p_payload->>'id')::uuid::text,actor,session_record.plan_id,session_record.id,p_payload->>'exerciseId',(p_payload->>'setIndex')::integer,(p_payload->>'weight')::numeric,case when timed then null else performed::integer end,case when timed then performed::integer else null end) on conflict(session_id,exercise_id,set_index) do update set weight=excluded.weight,reps=excluded.reps,duration_seconds=excluded.duration_seconds;
 end if;
 insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,p_action,session_record.id);
 return jsonb_build_object('ok',true);
end $$;
commit;
