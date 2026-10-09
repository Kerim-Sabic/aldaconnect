-- Shared declarations contain product information only, never diary entries or account details.
begin;
create schema food_private;
revoke all on schema food_private from public;
grant usage on schema food_private to anon,authenticated;
create table food_private.products (
 code text primary key check(code ~ '^[0-9]{14}$'),
 details jsonb not null,
 created_by text references public.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 version integer not null default 1,
 hidden boolean not null default false
);
create index food_products_author on food_private.products(created_by,created_at);
create table food_private.reports (
 code text references food_private.products(code) on delete cascade,
 actor_id text references public.users(id) on delete cascade,
 reason text not null check(length(reason) between 3 and 300),
 created_at timestamptz not null default now(),
 primary key(code,actor_id)
);
alter table food_private.products enable row level security;
alter table food_private.reports enable row level security;
revoke all on all tables in schema food_private from public,anon,authenticated;
create function food_private.dispatch(p_token text,p_action text,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor text; actor_role text; c text; d jsonb; item food_private.products%rowtype;
 k text; val numeric; checksum integer:=0; i integer; q text; result jsonb;
begin
 if coalesce(p_token,'')<>'' then
  select user_id into actor from app_private.username_sessions
   where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
 else actor:=auth.uid()::text; end if;
 select role into actor_role from public.users where id=actor;
 if actor is null or actor_role is null then raise exception 'APP:Prijavite se da nastavite.' using errcode='28000'; end if;
 if p_action not in ('lookup','list','save','report','moderate') then raise exception 'APP:Nepoznata radnja.'; end if;
 if p_action<>'list' then
  c:=p_payload->>'code';
  if c is null or c !~ '^[0-9]+$' or length(c) not in (8,12,13,14) then raise exception 'APP:Unesite ispravan barkod.' using errcode='22023'; end if;
  for i in 1..length(c)-1 loop
   checksum:=checksum+substring(c from length(c)-i for 1)::integer*(case when i%2=1 then 3 else 1 end);
  end loop;
  if (10-checksum%10)%10<>right(c,1)::integer then raise exception 'APP:Barkod nije ispravan.' using errcode='22023'; end if;
  c:=lpad(c,14,'0');
 end if;
 if p_action='save' then
  if actor_role not in ('client','admin') then raise exception 'APP:Nemate dozvolu za ovu radnju.' using errcode='42501'; end if;
  d:=p_payload->'product';
  if jsonb_typeof(d)<>'object' or d is null or length(d::text)>6000 then raise exception 'APP:Provjerite deklaraciju.' using errcode='22023'; end if;
  if coalesce(length(btrim(d->>'name')),0) not between 2 and 160 or coalesce(length(d->>'brand'),0)>80
   or coalesce(d->>'unit','') not in ('g','ml') or coalesce(length(d->>'ingredients'),0)>1000
   or coalesce(length(d->>'allergens'),0)>300 or coalesce(length(d->>'description'),0)>500
   then raise exception 'APP:Provjerite naziv i podatke proizvoda.' using errcode='22023'; end if;
  foreach k in array array['caloriesPer100','protein','carbs','fat','sugars','fiber','saturated','salt','serving','packageQuantity'] loop
   if d->k is null or d->k='null'::jsonb then
    if k in ('caloriesPer100','protein','carbs','fat') then raise exception 'APP:Unesite kalorije, proteine, ugljikohidrate i masti.' using errcode='22023'; end if;
   else
    if jsonb_typeof(d->k)<>'number' then raise exception 'APP:Vrijednosti moraju biti brojevi.' using errcode='22023'; end if;
    val:=(d->>k)::numeric;
    if val<0 or val>(case when k='caloriesPer100' then 1000 when k='serving' then 5000 when k='packageQuantity' then 100000 else 100 end)
     or (k in ('serving','packageQuantity') and val=0) then raise exception 'APP:Provjerite količine na deklaraciji.' using errcode='22023'; end if;
   end if;
  end loop;
  if (d->>'sugars')::numeric>(d->>'carbs')::numeric+0.5 or (d->>'saturated')::numeric>(d->>'fat')::numeric+0.5
   then raise exception 'APP:Šećeri ne mogu biti veći od ugljikohidrata, niti zasićene masti od ukupnih masti.' using errcode='22023'; end if;
  -- Only label fields are persisted; caller-supplied provenance and ownership are discarded.
  d:=jsonb_build_object('name',btrim(d->>'name'),'brand',btrim(coalesce(d->>'brand','')),'unit',d->>'unit',
   'caloriesPer100',d->'caloriesPer100','protein',d->'protein','carbs',d->'carbs','fat',d->'fat',
   'sugars',d->'sugars','fiber',d->'fiber','saturated',d->'saturated','salt',d->'salt','serving',d->'serving',
   'packageQuantity',d->'packageQuantity','ingredients',coalesce(d->>'ingredients',''),
   'allergens',coalesce(d->>'allergens',''),'description',coalesce(d->>'description',''));
  select * into item from food_private.products where code=c for update;
  if found then
   if item.created_by is distinct from actor and actor_role<>'admin' then raise exception 'APP:Ovaj proizvod već postoji. Prijavite grešku ako deklaracija nije ispravna.' using errcode='42501'; end if;
   if coalesce((p_payload->>'version')::integer,0)<>item.version then raise exception 'APP:Proizvod je promijenjen. Učitajte ga ponovo prije izmjene.' using errcode='40001'; end if;
   update food_private.products set details=d,version=version+1,updated_at=now() where code=c;
  else
   -- Serialize per-account creation so concurrent requests cannot bypass the daily limit.
   perform pg_advisory_xact_lock(hashtextextended(actor,71));
   if (select count(*) from food_private.products where created_by=actor and created_at>now()-interval '24 hours')>=20
    then raise exception 'APP:Dnevni limit je 20 novih proizvoda. Nastavite sutra.' using errcode='54000'; end if;
   insert into food_private.products(code,details,created_by) values(c,d,actor) on conflict do nothing;
   if not found then raise exception 'APP:Proizvod je upravo dodan. Učitajte ga ponovo.' using errcode='40001'; end if;
  end if;
 elsif p_action='report' then
  if coalesce(length(btrim(p_payload->>'reason')),0) not between 3 and 300 then raise exception 'APP:Opišite grešku (3–300 znakova).' using errcode='22023'; end if;
  if not exists(select 1 from food_private.products where code=c and not hidden) then raise exception 'APP:Proizvod nije pronađen.' using errcode='22023'; end if;
  insert into food_private.reports values(c,actor,btrim(p_payload->>'reason'),now())
   on conflict(code,actor_id) do update set reason=excluded.reason,created_at=now();
  return jsonb_build_object('ok',true);
 elsif p_action='moderate' then
  if actor_role<>'admin' then raise exception 'APP:Samo administrator može upravljati katalogom.' using errcode='42501'; end if;
  update food_private.products set hidden=coalesce((p_payload->>'hidden')::boolean,true),version=version+1,updated_at=now() where code=c;
  if not found then raise exception 'APP:Proizvod nije pronađen.' using errcode='22023'; end if;
 end if;
 if p_action in ('lookup','save') then
  select details||jsonb_build_object('code',code,'source','community','version',version,'canEdit',created_by=actor or actor_role='admin')
   into result from food_private.products where code=c and (not hidden or actor_role='admin');
  return jsonb_build_object('actorId',actor,'product',result);
 end if;
 q:=left(btrim(coalesce(p_payload->>'q','')),80);
 select coalesce(jsonb_agg(x.product),'[]'::jsonb) into result from (
  select p.details||jsonb_build_object('code',p.code,'source','community','version',p.version,
   'canEdit',p.created_by=actor or actor_role='admin','hidden',p.hidden,
   'reports',case when actor_role='admin' then (select coalesce(jsonb_agg(jsonb_build_object('reason',r.reason,'createdAt',r.created_at)),'[]') from food_private.reports r where r.code=p.code) else '[]'::jsonb end) product
   from food_private.products p where (not p.hidden or actor_role='admin')
   and (coalesce((p_payload->>'mine')::boolean,false)=false or p.created_by=actor)
   and (q='' or position(lower(q) in lower(p.details->>'name'||' '||p.details->>'brand'||' '||p.code))>0)
   order by p.updated_at desc,p.code limit 30
 ) x;
 return jsonb_build_object('actorId',actor,'products',result);
end $$;
revoke all on function food_private.dispatch(text,text,jsonb) from public;
grant execute on function food_private.dispatch(text,text,jsonb) to anon,authenticated;
create function public.food_catalog(p_token text default '',p_action text default 'list',p_payload jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select food_private.dispatch(p_token,p_action,p_payload) $$;
revoke all on function public.food_catalog(text,text,jsonb) from public;
grant execute on function public.food_catalog(text,text,jsonb) to anon,authenticated;
commit;
