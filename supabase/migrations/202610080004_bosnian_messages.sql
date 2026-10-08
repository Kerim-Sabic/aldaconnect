begin;
do $localization$
declare fn record; pair record; definition text;
begin
 for fn in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and p.proname in ('workspace_action','workspace_snapshot','bootstrap_user') loop
  definition:=pg_get_functiondef(fn.oid);
  for pair in select * from (values
('Weekly check-in ready to review','Sedmični izvještaj je spreman za pregled'),
('Sign in to continue.','Prijavite se da nastavite.'),
('Access denied.','Pristup nije dozvoljen.'),
('Request too large.','Zahtjev je prevelik.'),
('Choose your assigned plan.','Odaberite dodijeljeni plan.'),
('Only the member can record performed sets.','Samo korisnik može zabilježiti odrađene serije.'),
('Trainer access required.','Potreban je pristup trenera.'),
('Select an assigned client.','Odaberite dodijeljenog klijenta.'),
('An active relationship is required.','Potrebna je aktivna saradnja.'),
('Only the member can record their diary.','Samo korisnik može unositi podatke u svoj dnevnik.'),
('Member account required.','Potreban je korisnički račun.'),
('Unknown action.','Nepoznata radnja.'),
('Invalid modules.','Neispravan izbor modula.'),
('Check your preferences.','Provjerite postavke.'),
('Only the member can submit a check-in.','Samo korisnik može poslati izvještaj.'),
('Review is no longer available or response is invalid.','Pregled više nije dostupan ili odgovor nije ispravan.'),
('Add 1 to 20 exercises.','Dodajte od 1 do 20 vježbi.'),
('Check exercise details.','Provjerite podatke o vježbama.'),
('Trainer access and a valid email are required.','Potrebni su pristup trenera i ispravna adresa e-pošte.'),
('Invitation created. No email sent.','Poziv je kreiran. E-pošta nije poslana.'),
('Invitation is expired or belongs to another email.','Poziv je istekao ili pripada drugoj adresi e-pošte.'),
('This session is no longer active.','Ovaj trening više nije aktivan.'),
('Record at least one set first.','Prvo zabilježite barem jednu seriju.'),
('Session and plan do not match.','Trening i plan se ne podudaraju.'),
('Check the set details.','Provjerite podatke o seriji.'),
('New member','Novi korisnik')) as translations(original,translated) loop
   if pair.original in ('Weekly check-in ready to review','New member','Invitation created. No email sent.') then
    definition:=replace(definition,quote_literal(pair.original),quote_literal(pair.translated));
   end if;
   definition:=replace(definition,quote_literal('APP:'||pair.original),quote_literal('APP:'||pair.translated));
  end loop;
  execute definition;
 end loop;
end $localization$;
commit;
