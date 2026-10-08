-- One-time owner-authorized separation of the existing Alda profile from administration.
-- Password is supplied at execution through the authenticated application, never in a migration.
begin;
create function public.admin_split_accounts(p_token text,p_password text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text; new_id uuid:=gen_random_uuid(); alda text:='ad000000-0000-4000-8000-000000000001'; amrudin text:='ad000000-0000-4000-8000-000000000002';
begin
 select s.user_id into actor from app_private.username_sessions s join public.users u on u.id=s.user_id
 where s.token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and s.expires_at>now() and u.role='admin' and u.id=alda for update of u;
 if actor is null or length(p_token)<>64 then raise exception 'APP:Ova priprema zahtijeva postojeći Alda administratorski račun.'; end if;
 if p_password is null or length(p_password) not between 5 and 128 then raise exception 'APP:Provjerite lozinku.'; end if;
 if exists(select 1 from app_private.username_accounts where username='admin') then raise exception 'APP:Admin račun već postoji. Postojeći račun nije promijenjen.'; end if;
 if not exists(select 1 from public.users where id=amrudin and role='client') then raise exception 'APP:Klijentski profil nije pronađen.'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(new_id,'admin.test@accounts.aldaconnect.invalid','{"name":"Admin"}');
 update public.users set role='admin',onboarded=true,is_test_profile=true where id=new_id::text;
 insert into app_private.username_accounts(username,user_id,password_hash) values('admin',new_id::text,extensions.crypt(encode(extensions.digest(p_password,'sha256'),'hex'),extensions.gen_salt('bf',12)));
 update public.users set role='trainer',onboarded=true where id=alda;
 update public.preferences set modules='["training","nutrition","progress","recovery","medications"]',version=version+1 where user_id=alda;
 insert into public.relationships(id,expert_id,client_id,status) values(gen_random_uuid()::text,alda,amrudin,'active') on conflict(expert_id,client_id) do update set status='active';
 -- Private record grants remain client-controlled and are not widened by this role change.
 insert into public.audit(id,actor_id,action,resource_id) values(gen_random_uuid()::text,actor,'admin_trainer_split',new_id::text);
 delete from app_private.username_sessions where user_id=alda;
 return jsonb_build_object('ok',true,'adminId',new_id,'trainerId',alda);
end $$;
revoke all on function public.admin_split_accounts(text,text) from public;
grant execute on function public.admin_split_accounts(text,text) to anon,authenticated;
commit;
