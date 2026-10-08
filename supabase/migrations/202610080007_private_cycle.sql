begin;
create table public.cycle_entries (
 id uuid primary key, user_id text not null references public.users(id),
 date date not null check(date>='1900-01-01'),
 bleeding text not null check(bleeding in ('none','spotting','light','moderate','heavy')),
 pain integer check(pain between 0 and 10),
 symptoms jsonb not null default '[]' check(jsonb_typeof(symptoms)='array' and jsonb_array_length(symptoms)<=8),
 note text not null default '' check(length(note)<=1000),
 updated_at timestamptz not null default now(), removed_at timestamptz,
 unique(user_id,date)
);
alter table public.cycle_entries enable row level security;
revoke all on public.cycle_entries from anon,authenticated;
grant select on public.cycle_entries to authenticated;
create policy cycle_owner_read on public.cycle_entries for select to authenticated using(user_id=auth.uid()::text);
create function app_private.cycle_dispatch(actor text,action text,payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare entry_id uuid; day date; result jsonb;
begin
 if actor is null or not exists(select 1 from public.users where id=actor and role='client') then raise exception 'APP:Privatni dnevnik dostupan je samo vlasniku klijentskog računa.'; end if;
 if length(payload::text)>5000 then raise exception 'APP:Zahtjev je prevelik.'; end if;
 if action='save' then
  entry_id:=(payload->>'id')::uuid; day:=(payload->>'date')::date;
  if entry_id is null or day is null or day<'1900-01-01' or day>(now() at time zone 'Europe/Sarajevo')::date or payload->>'bleeding' is null or payload->>'bleeding' not in ('none','spotting','light','moderate','heavy') or jsonb_typeof(payload->'symptoms') is distinct from 'array' or jsonb_array_length(payload->'symptoms')>8 or length(coalesce(payload->>'note',''))>1000 then raise exception 'APP:Provjerite unos i datum.'; end if;
  if exists(select 1 from jsonb_array_elements_text(payload->'symptoms') s where s not in ('cramps','headache','fatigue','bloating','breastTenderness','sleepChange','moodChange','other')) then raise exception 'APP:Provjerite simptome.'; end if;
  if exists(select 1 from public.cycle_entries where id=entry_id and user_id<>actor) then raise exception 'APP:Pristup nije dozvoljen.'; end if;
  if exists(select 1 from public.cycle_entries where id=entry_id and user_id=actor and date<>day) then raise exception 'APP:Datum sačuvanog unosa se ne mijenja. Napravite unos za drugi datum.'; end if;
  insert into public.cycle_entries(id,user_id,date,bleeding,pain,symptoms,note) values(entry_id,actor,day,payload->>'bleeding',(payload->>'pain')::integer,payload->'symptoms',trim(coalesce(payload->>'note','')))
  on conflict(user_id,date) do update set bleeding=excluded.bleeding,pain=excluded.pain,symptoms=excluded.symptoms,note=excluded.note,removed_at=null,updated_at=now();
 elsif action in ('remove','restore') then
  update public.cycle_entries set removed_at=case when action='remove' then now() else null end,updated_at=now() where id=(payload->>'id')::uuid and user_id=actor;
  if not found then raise exception 'APP:Unos nije pronađen.'; end if;
 elsif action<>'snapshot' then raise exception 'APP:Nepoznata radnja.';
 end if;
 if action<>'snapshot' then insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'cycle_'||action,actor); end if;
 select jsonb_build_object('entries',coalesce(jsonb_agg(jsonb_build_object('id',id,'date',date,'bleeding',bleeding,'pain',pain,'symptoms',symptoms,'note',note,'updated_at',updated_at,'removed_at',removed_at) order by date desc),'[]'::jsonb)) into result from public.cycle_entries where user_id=actor;
 return result;
end $$;
revoke all on function app_private.cycle_dispatch(text,text,jsonb) from public,anon,authenticated;
create function public.cycle_action(p_action text default 'snapshot',p_payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select app_private.cycle_dispatch(auth.uid()::text,p_action,p_payload)$$;
revoke all on function public.cycle_action(text,jsonb) from public,anon;
grant execute on function public.cycle_action(text,jsonb) to authenticated;
create function public.username_cycle(p_token text,p_action text default 'snapshot',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 if length(p_token)<>64 then raise exception 'APP:Prijavite se ponovo.'; end if;
 select user_id into actor from app_private.username_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 if actor is null then raise exception 'APP:Vaša sesija je istekla.'; end if;
 return app_private.cycle_dispatch(actor,p_action,p_payload);
end $$;
revoke all on function public.username_cycle(text,text,jsonb) from public;
grant execute on function public.username_cycle(text,text,jsonb) to anon,authenticated;
commit;

-- Preserve newly available cycle selection through onboarding; other modules stay unchanged.
alter function public.workspace_action(text,jsonb) rename to workspace_action_before_cycle;
alter function public.workspace_action_before_cycle(text,jsonb) set schema app_private;
revoke all on function app_private.workspace_action_before_cycle(text,jsonb) from public,anon,authenticated;
create function public.workspace_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=app_private.workspace_action_before_cycle(p_action,p_payload);
 if p_action='onboard' then
  update public.preferences set modules=(select coalesce(jsonb_agg(distinct value),'[]') from jsonb_array_elements_text(p_payload->'modules') where value in ('training','nutrition','progress','recovery','cycle')) where user_id=auth.uid()::text;
 end if;
 return result;
end $$;
revoke all on function public.workspace_action(text,jsonb) from public,anon;
grant execute on function public.workspace_action(text,jsonb) to authenticated;

commit;
