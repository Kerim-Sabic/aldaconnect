begin;
do $$
declare c text:=gen_random_uuid()::text; d text:=gen_random_uuid()::text; file_id uuid:=gen_random_uuid(); v jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data) values(c::uuid,c||'@example.invalid','{"name":"Lab smoke client"}'),(d::uuid,d||'@example.invalid','{"name":"Lab smoke doctor"}');
 update public.users set role='doctor' where id=d;
 insert into public.relationships(id,client_id,expert_id,status) values(gen_random_uuid()::text,c,d,'active');
 v:=app_private.labs_dispatch(c,'upload',jsonb_build_object('id',file_id,'title','Synthetic smoke','provider','Test fixture','date','2026-10-08','fileBase64',encode(convert_to('%PDF-1.4 TEST %%EOF','UTF8'),'base64')));
 begin perform app_private.labs_dispatch(d,'file',jsonb_build_object('id',file_id,'clientId',c)); raise exception 'FAILED: missing consent accepted'; exception when others then if sqlerrm not like 'APP:%odobrio%' then raise; end if; end;
 perform app_private.labs_dispatch(c,'grant',jsonb_build_object('doctorId',d,'granted',true));
 v:=app_private.labs_dispatch(d,'review',jsonb_build_object('id',file_id,'clientId',c,'reviewId',gen_random_uuid(),'note','Fictional workflow smoke, no medical assessment','decision','reviewed','doctor_name','Forged'));
 if v#>>'{reviews,0,doctor_name}'<>'Lab smoke doctor' then raise exception 'FAILED: attribution'; end if;
 if v::text like '%fileBase64%' then raise exception 'FAILED: bytes leaked into snapshot'; end if;
 perform app_private.labs_dispatch(c,'grant',jsonb_build_object('doctorId',d,'granted',false));
 begin perform app_private.labs_dispatch(d,'file',jsonb_build_object('id',file_id,'clientId',c)); raise exception 'FAILED: revoked access accepted'; exception when others then if sqlerrm not like 'APP:%odobrio%' then raise; end if; end;
end $$;
set local role authenticated;
do $$begin
 begin perform 1 from public.lab_documents; raise exception 'FAILED: direct metadata access'; exception when insufficient_privilege then null; end;
 begin perform 1 from app_private.lab_files; raise exception 'FAILED: direct PDF access'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'PASS: synthetic upload, consent, named review, revocation and direct-table denial; all fixtures rolled back' as result;
rollback;
