begin;
alter table public.users add column is_test_profile boolean not null default false;
create table public.lab_access(client_id text references public.users(id),doctor_id text references public.users(id),granted boolean not null default false,updated_at timestamptz default now(),primary key(client_id,doctor_id));
create table public.lab_documents(id uuid primary key,client_id text not null references public.users(id),title text not null,provider text not null,report_date date not null,is_test boolean not null default true check(is_test),uploaded_by text not null references public.users(id),uploaded_name text not null,file_size integer not null check(file_size between 5 and 2097152),content_digest text not null,created_at timestamptz not null default now(),removed_at timestamptz);
create table app_private.lab_files(document_id uuid primary key references public.lab_documents(id),pdf bytea not null check(octet_length(pdf) between 5 and 2097152));
create table public.lab_reviews(id uuid primary key,document_id uuid not null references public.lab_documents(id),doctor_id text not null references public.users(id),doctor_name text not null,note text not null check(length(note) between 1 and 2000),decision text not null check(decision in ('reviewed','followUp')),created_at timestamptz not null default now());
alter table public.lab_access enable row level security;
alter table public.lab_documents enable row level security;
alter table public.lab_reviews enable row level security;
alter table app_private.lab_files enable row level security;
revoke all on public.lab_access,public.lab_documents,public.lab_reviews,app_private.lab_files from public,anon,authenticated;

create function app_private.labs_dispatch(actor text,action text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_role text; actor_name text; target text; allowed boolean; entry public.lab_documents; entry_id uuid; file_bytes bytea; result jsonb;
begin
 select role,name into actor_role,actor_name from public.users where id=actor;
 if actor_role is null or actor_role not in ('client','doctor') then raise exception 'APP:Nalazi su dostupni klijentu i ovlaštenom doktoru.'; end if;
 if length(payload::text)>2900000 then raise exception 'APP:Datoteka je prevelika. Najviše 2 MB.'; end if;
 target:=case when actor_role='client' then actor else nullif(payload->>'clientId','') end;
 if actor_role='client' and nullif(payload->>'clientId','') is not null and payload->>'clientId'<>actor then raise exception 'APP:Pristup nije dozvoljen.'; end if;
 if actor_role='doctor' and target is not null and not exists(select 1 from public.relationships where client_id=target and expert_id=actor and status='active') then raise exception 'APP:Odaberite svog aktivnog klijenta.'; end if;
 if target is not null then perform id from public.users where id=target for update; end if;
 if action='grant' then
  if actor_role<>'client' or jsonb_typeof(payload->'granted') is distinct from 'boolean' or not exists(select 1 from public.relationships r join public.users u on u.id=r.expert_id where r.client_id=actor and r.expert_id=payload->>'doctorId' and r.status='active' and u.role='doctor') then raise exception 'APP:Odaberite povezanog doktora.'; end if;
  insert into public.lab_access(client_id,doctor_id,granted) values(actor,payload->>'doctorId',(payload->>'granted')::boolean) on conflict(client_id,doctor_id) do update set granted=excluded.granted,updated_at=now();
  insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'lab_access',actor);
 end if;
 allowed:=target=actor or exists(select 1 from public.lab_access a join public.relationships r on r.client_id=a.client_id and r.expert_id=a.doctor_id where a.client_id=target and a.doctor_id=actor and a.granted and r.status='active');
 if action in ('upload','file','review','remove','restore') then
  if allowed is not true then raise exception 'APP:Klijent nije odobrio pristup testnim nalazima.'; end if;
  entry_id:=(payload->>'id')::uuid;
  if entry_id is null then raise exception 'APP:Provjerite unos.'; end if;
  select * into entry from public.lab_documents where id=entry_id for update;
  if entry.id is not null and entry.client_id<>target then raise exception 'APP:Pristup nije dozvoljen.'; end if;
  if action='upload' then
   file_bytes:=decode(payload->>'fileBase64','base64');
   if file_bytes is null or octet_length(file_bytes) not between 5 and 2097152 or substring(file_bytes from 1 for 5)<>decode('255044462d','hex') or length(trim(coalesce(payload->>'title',''))) not between 1 and 120 or length(trim(coalesce(payload->>'provider',''))) not between 1 and 120 or nullif(payload->>'date','')::date is null or (payload->>'date')::date<'1900-01-01' or (payload->>'date')::date>(now() at time zone 'Europe/Sarajevo')::date then raise exception 'APP:Provjerite PDF, datum i naziv nalaza.'; end if;
   if entry.id is null then
    insert into public.lab_documents(id,client_id,title,provider,report_date,uploaded_by,uploaded_name,file_size,content_digest) values(entry_id,target,trim(payload->>'title'),trim(payload->>'provider'),(payload->>'date')::date,actor,actor_name,octet_length(file_bytes),encode(extensions.digest(payload->>'fileBase64','sha256'),'hex'));
    insert into app_private.lab_files(document_id,pdf) values(entry_id,file_bytes);
    insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'lab_upload',entry_id::text);
   elsif (select pdf from app_private.lab_files where document_id=entry_id) is distinct from file_bytes then raise exception 'APP:Ovaj unos već postoji s drugom datotekom.'; end if;
  else
   if entry.id is null then raise exception 'APP:Nalaz nije pronađen.'; end if;
   if action='file' then return jsonb_build_object('fileBase64',(select encode(pdf,'base64') from app_private.lab_files where document_id=entry_id),'filename','TESTNI-NALAZ-'||entry_id::text||'.pdf'); end if;
   if action='review' then
    if actor_role<>'doctor' or entry.removed_at is not null or length(trim(coalesce(payload->>'note',''))) not between 1 and 2000 or payload->>'decision' is null or payload->>'decision' not in ('reviewed','followUp') then raise exception 'APP:Pregled može zabilježiti samo ovlašteni doktor.'; end if;
    if exists(select 1 from public.lab_reviews where id=(payload->>'reviewId')::uuid and (document_id<>entry_id or doctor_id<>actor or note<>trim(payload->>'note') or decision<>payload->>'decision')) then raise exception 'APP:Ovaj pregled već postoji s drugim sadržajem.'; end if;
    insert into public.lab_reviews(id,document_id,doctor_id,doctor_name,note,decision) values((payload->>'reviewId')::uuid,entry_id,actor,actor_name,trim(payload->>'note'),payload->>'decision') on conflict(id) do nothing;
   else
    if actor_role<>'client' then raise exception 'APP:Samo klijent može ukloniti ili vratiti nalaz.'; end if;
    update public.lab_documents set removed_at=case when action='remove' then now() else null end where id=entry_id;
   end if;
   insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'lab_'||action,entry_id::text);
  end if;
 elsif action not in ('snapshot','grant') then raise exception 'APP:Nepoznata radnja.';
 end if;
 select jsonb_build_object('actor',jsonb_build_object('id',actor,'name',actor_name,'role',actor_role),'clientId',target,'allowed',coalesce(allowed,false),
 'clients',case when actor_role='doctor' then coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name) order by u.name) from public.relationships r join public.users u on u.id=r.client_id where r.expert_id=actor and r.status='active'),'[]') else '[]'::jsonb end,
 'team',case when actor_role='client' then coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.name,'granted',coalesce(a.granted,false)) order by u.name) from public.relationships r join public.users u on u.id=r.expert_id left join public.lab_access a on a.client_id=r.client_id and a.doctor_id=r.expert_id where r.client_id=actor and r.status='active' and u.role='doctor'),'[]') else '[]'::jsonb end,
 'documents',case when allowed then coalesce((select jsonb_agg(to_jsonb(d) order by created_at desc) from public.lab_documents d where d.client_id=target),'[]') else '[]'::jsonb end,
 'reviews',case when allowed then coalesce((select jsonb_agg(to_jsonb(v) order by v.created_at desc) from public.lab_reviews v join public.lab_documents d on d.id=v.document_id where d.client_id=target),'[]') else '[]'::jsonb end) into result;
 return result;
end $$;
revoke all on function app_private.labs_dispatch(text,text,jsonb) from public,anon,authenticated;
create function public.labs_action(p_action text default 'snapshot',p_payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$select app_private.labs_dispatch(auth.uid()::text,p_action,p_payload)$$;
revoke all on function public.labs_action(text,jsonb) from public,anon;
grant execute on function public.labs_action(text,jsonb) to authenticated;
create function public.username_labs(p_token text,p_action text default 'snapshot',p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;
begin
 select user_id into actor from app_private.username_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 if actor is null or length(p_token)<>64 then raise exception 'APP:Vaša sesija je istekla.'; end if;
 return app_private.labs_dispatch(actor,p_action,p_payload);
end $$;
revoke all on function public.username_labs(text,text,jsonb) from public;
grant execute on function public.username_labs(text,text,jsonb) to anon,authenticated;

-- Administrator provisioning is restricted to visibly marked test doctors and synthetic lab access.
create function public.admin_test_doctor(p_token text,p_username text,p_password text,p_name text,p_client_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text; new_id uuid:=gen_random_uuid(); email text; new_username text:=lower(trim(p_username));
begin
 select s.user_id into actor from app_private.username_sessions s join public.users u on u.id=s.user_id where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expires_at>now() and u.role='admin';
 if actor is null or length(p_token)<>64 then raise exception 'APP:Administratorski pristup je obavezan.'; end if;
 if new_username !~ '^[a-z0-9][a-z0-9_-]{2,39}$' or length(p_password) not between 4 and 128 or length(trim(p_name)) not between 2 and 70 or not exists(select 1 from public.users where id=p_client_id and role='client') then raise exception 'APP:Provjerite korisničko ime, lozinku i klijenta.'; end if;
 if exists(select 1 from app_private.username_accounts a where a.username=new_username) then raise exception 'APP:Korisničko ime je zauzeto. Postojeći račun nije promijenjen.'; end if;
 email:=new_username||'.test@accounts.aldaconnect.invalid';
 insert into auth.users(id,email,raw_user_meta_data) values(new_id,email,jsonb_build_object('name',trim(p_name)||' (test)'));
 update public.users set role='doctor',onboarded=true,is_test_profile=true where id=new_id::text;
 update public.preferences set modules='["labs","medications"]' where user_id=new_id::text;
 insert into app_private.username_accounts(username,user_id,password_hash) values(new_username,new_id::text,extensions.crypt(encode(extensions.digest(p_password,'sha256'),'hex'),extensions.gen_salt('bf',12)));
 insert into public.relationships(id,expert_id,client_id,status) values(gen_random_uuid()::text,new_id::text,p_client_id,'active');
 insert into public.lab_access(client_id,doctor_id,granted) values(p_client_id,new_id::text,true);
 update public.preferences set modules=modules||'"labs"'::jsonb,version=version+1 where user_id=p_client_id and not modules ? 'labs';
 insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'test_doctor_created',new_id::text);
 return jsonb_build_object('id',new_id,'name',trim(p_name)||' (test)','username',new_username,'role','doctor','clientId',p_client_id);
end $$;
revoke all on function public.admin_test_doctor(text,text,text,text,text) from public;
grant execute on function public.admin_test_doctor(text,text,text,text,text) to anon,authenticated;

create or replace function public.workspace_action(p_action text,p_payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=app_private.workspace_action_before_cycle(p_action,p_payload);
 if p_action='onboard' then update public.preferences set modules=(select coalesce(jsonb_agg(distinct value),'[]') from jsonb_array_elements_text(p_payload->'modules') where value in ('training','nutrition','progress','recovery','cycle','medications','labs')) where user_id=auth.uid()::text; end if;
 return result;
end $$;
commit;
