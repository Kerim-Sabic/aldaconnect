import Image from "next/image";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  Barcode,
  Dumbbell,
  MessageCircle,
  Smartphone,
} from "lucide-react";
import Brand from "./brand";
import { programs } from "@/lib/programs";
export default function Landing() {
  return (
    <div className="marketing">
      <a className="landing-skip" href="#main">
        Preskočite na sadržaj
      </a>
      <header className="landing-header">
        <a href="/" aria-label="Alda Connect početna">
          <Brand />
        </a>
        <nav aria-label="Glavna navigacija">
          <a href="#prostor">Vaš prostor</a>
          <a href="#programi">Programi</a>
          <a href="#pocetak">Kako početi</a>
        </nav>
        <a className="landing-login" href="/app">
          Otvorite aplikaciju <ArrowUpRight size={16} />
        </a>
      </header>
      <main id="main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow">
              <i /> MALI KORACI. VAŠ VELIKI NAPREDAK.
            </span>
            <h1>
              Više prostora
              <br />
              za <em>bolje navike.</em>
            </h1>
            <p>
              Trening, ishrana i podrška vašeg trenera.
              <br className="landing-desktop-break" /> Sve što vam treba da
              pronađete svoj ritam.
            </p>
            <div className="landing-hero-actions">
              <a className="landing-primary" href="/app?auth=register">
                Kreirajte svoj prostor <ArrowUpRight size={19} />
              </a>
              <a className="landing-text-link" href="#prostor">
                Upoznajte Aldu <ArrowRight size={16} />
              </a>
            </div>
            <div className="landing-hero-note">
              <span>
                <Check size={14} /> Na telefonu i računaru
              </span>
              <span>
                <Check size={14} /> U vašem ritmu
              </span>
            </div>
          </div>
          <div className="landing-hero-art">
            <Image
              src="/landing/studio.webp"
              alt="Mirno mjesto za trening, prirodno svjetlo i oprema u toplom studiju"
              width={1120}
              height={1400}
              priority
              sizes="(max-width: 760px) 100vw, 50vw"
            />
            <div className="landing-art-caption">
              <span>VAŠ PROSTOR ZA NAPREDAK</span>
              <ArrowUpRight size={21} />
            </div>
          </div>
        </section>
        <div className="landing-intro-line">
          <span>JEDNOSTAVNO. POVEZANO. VAŠE.</span>
          <p>
            Manje razmišljanja o aplikaciji.
            <br />
            Više pažnje za sebe.
          </p>
        </div>
        <section className="landing-features" id="prostor">
          <div className="landing-section-heading">
            <span className="landing-eyebrow">SVAKI DAN, MALO BOLJE</span>
            <h2>
              Jedan prostor.
              <br />
              Sve vaše navike.
            </h2>
            <p>
              Otvorite plan. Zabilježite obrok. Javite se treneru.
              <br />
              Sve je upravo tamo gdje očekujete.
            </p>
          </div>
          <div className="landing-feature-grid">
            <article>
              <span className="landing-feature-icon">
                <Dumbbell size={22} />
              </span>
              <span className="landing-feature-index">01 / TRENING</span>
              <h3>Znajte svoj sljedeći korak.</h3>
              <p>
                Pregledajte programe i pratite plan koji vam trener dodijeli.
                Bilježite serije, opterećenje i svoj napredak.
              </p>
              <a href="/app?view=library">
                Istražite programe <ArrowUpRight size={17} />
              </a>
            </article>
            <article>
              <span className="landing-feature-icon">
                <Barcode size={22} />
              </span>
              <span className="landing-feature-index">02 / ISHRANA</span>
              <h3>Skenirajte. Odaberite porciju.</h3>
              <p>
                Pronađite proizvod barkodom i dodajte kalorije u dnevnik.
                Nedostaje deklaracija? Sačuvajte je za cijelu zajednicu.
              </p>
              <a href="/app?view=nutrition">
                Upoznajte dnevnik <ArrowUpRight size={17} />
              </a>
            </article>
            <article>
              <span className="landing-feature-icon">
                <MessageCircle size={22} />
              </span>
              <span className="landing-feature-index">03 / PODRŠKA</span>
              <h3>Vaš tim je blizu.</h3>
              <p>
                Razgovarajte s trenerom i pridružite se trening grupi. Poruke
                stižu automatski, dok vi ostajete u toku.
              </p>
              <a href="/app?view=groups">
                Povežite se s timom <ArrowUpRight size={17} />
              </a>
            </article>
          </div>
        </section>
        <section className="landing-programs" id="programi">
          <div className="landing-section-heading landing-section-row">
            <div>
              <span className="landing-eyebrow">STRUKTURA ZA VAŠ RITAM</span>
              <h2>Pronađite svoj početak.</h2>
            </div>
            <a className="landing-text-link" href="/app?view=library">
              Svi programi <ArrowUpRight size={17} />
            </a>
          </div>
          <div className="landing-program-grid">
            {[0, 10, 12].map((index) => (
              <a key={programs[index].id} href="/app?view=library">
                <div>
                  <Image
                    src={
                      "/programs/program-" +
                      String(index + 1).padStart(2, "0") +
                      ".webp"
                    }
                    alt=""
                    width={560}
                    height={420}
                    sizes="(max-width: 760px) 85vw, 30vw"
                  />
                  <span>
                    <ArrowUpRight size={21} />
                  </span>
                </div>
                <small>TRENING / {String(index + 1).padStart(2, "0")}</small>
                <h3>{programs[index].title}</h3>
                <p>{programs[index].summary}</p>
              </a>
            ))}
          </div>
        </section>
        <section className="landing-start" id="pocetak">
          <div>
            <span className="landing-eyebrow">POČNIMO JEDNOSTAVNO</span>
            <h2>
              Vaš ritam.
              <br />
              Od prvog dana.
            </h2>
            <p>
              Nekoliko kratkih koraka do prostora koji odgovara vama. Postavke
              uvijek možete promijeniti.
            </p>
            <a className="landing-primary" href="/app?auth=register">
              Krenite danas <ArrowUpRight size={18} />
            </a>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <h3>Kreirajte račun.</h3>
                <p>
                  Odaberite korisničko ime i sačuvajte svoj kod za oporavak
                  računa.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <h3>Recite nam šta vam je važno.</h3>
                <p>
                  Prilagodite ciljeve i sedmicu. Odaberite alate koje želite
                  koristiti.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <h3>Napravite prvi mali korak.</h3>
                <p>
                  Zabilježite obrok, istražite programe ili prihvatite poziv
                  svog trenera.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="landing-phone">
          <Smartphone size={24} />
          <div>
            <h3>Vaš prostor. Uvijek pri ruci.</h3>
            <p>
              Dodajte Aldu na početni ekran telefona i otvarajte je kao
              aplikaciju.
            </p>
          </div>
          <a className="landing-text-link" href="/app">
            Otvorite Aldu <ArrowUpRight size={18} />
          </a>
        </section>
        <section className="landing-final">
          <span className="landing-eyebrow">DOBRO DOŠLI U ALDA CONNECT</span>
          <h2>
            Prostor za ono
            <br />
            što vas pokreće.
          </h2>
          <a className="landing-primary" href="/app?auth=register">
            Kreirajte svoj prostor <ArrowUpRight size={19} />
          </a>
          <a className="landing-final-login" href="/app">
            Već imate račun? Prijavite se.
          </a>
        </section>
      </main>
      <footer className="landing-footer">
        <a href="/" aria-label="Alda Connect početna">
          <Brand />
        </a>
        <span>Trening. Ishrana. Podrška.</span>
        <a href="/app">
          Vaš prostor <ArrowUpRight size={15} />
        </a>
      </footer>
    </div>
  );
}
