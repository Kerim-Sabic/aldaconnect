"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Search,
  Dumbbell,
  Utensils,
  Pill,
  Clock3,
  Bookmark,
  Check,
} from "lucide-react";
import {
  programs,
  programCategories,
  programExercises,
  type Program,
} from "@/lib/programs";
const icons = { training: Dumbbell, nutrition: Utensils, supplements: Pill };
export default function ProgramLibrary({
  accountId,
  onPrepare,
}: {
  accountId: string;
  onPrepare?: (
    title: string,
    exercises: NonNullable<ReturnType<typeof programExercises>>,
  ) => void;
}) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Program | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("alda-programs:" + accountId) || "[]",
      );
      setSaved(
        Array.isArray(value)
          ? value.filter((id) => programs.some((p) => p.id === id))
          : [],
      );
    } catch {
      setSaved([]);
    }
  }, [accountId]);
  const toggleSaved = (id: string) => {
    const next = saved.includes(id)
      ? saved.filter((value) => value !== id)
      : [...saved, id];
    setSaved(next);
    try {
      localStorage.setItem("alda-programs:" + accountId, JSON.stringify(next));
    } catch {}
  };
  const [onlySaved, setOnlySaved] = useState(false);
  if (selected)
    return (
      <ProgramDetail
        program={selected}
        back={() => setSelected(null)}
        onPrepare={onPrepare}
      />
    );
  const filtered = programs.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      (!onlySaved || saved.includes(p.id)) &&
      (p.title + " " + p.summary)
        .toLocaleLowerCase("bs")
        .includes(query.toLocaleLowerCase("bs")),
  );
  return (
    <div className="program-library">
      <section className="program-editorial">
        <div>
          <span className="sheet-kicker">ALDA KOLEKCIJA · 18 PROGRAMA</span>
          <h2>
            Pronađite svoj
            <br />
            <span>sljedeći korak.</span>
          </h2>
          <p>Trening, svakodnevna ishrana i više prostora za sebe.</p>
        </div>
        <img
          src="/programs/training.webp"
          alt="Kettlebell i prostirka u mirnom prostoru za trening"
        />
      </section>
      <div className="program-tools">
        <label className="crm-search">
          <Search size={17} />
          <input
            aria-label="Pretražite programe"
            placeholder="Pronađite program…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <button
          className={"secondary " + (onlySaved ? "selected" : "")}
          onClick={() => setOnlySaved(!onlySaved)}
          aria-pressed={onlySaved}
        >
          <Bookmark size={16} /> Sačuvano
          {saved.length > 0 ? " · " + saved.length : ""}
        </button>
      </div>
      <div className="collection-tabs" aria-label="Kategorija programa">
        {Object.entries(programCategories).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            {label}
            <small>
              {id === "all"
                ? programs.length
                : programs.filter((p) => p.category === id).length}
            </small>
          </button>
        ))}
      </div>
      <div className="program-grid">
        {filtered.map((p) => {
          const Icon = icons[p.category as keyof typeof icons];
          return (
            <article
              className={"program-card program-" + p.category}
              key={p.id}
            >
              <button className="program-open" onClick={() => setSelected(p)}>
                <div className="program-art">
                  <img
                    src={p.image}
                    alt=""
                    loading="lazy"
                    width={900}
                    height={600}
                  />
                </div>
                <div className="program-card-body">
                  <span className="program-category">
                    <Icon size={12} />
                    {programCategories[p.category]}
                  </span>
                  <h3>{p.title}</h3>
                  <p>{p.summary}</p>
                  <div className="program-meta">
                    {p.minutes ? (
                      <span>
                        <Clock3 size={13} />
                        {p.minutes} min
                      </span>
                    ) : null}
                    <span>
                      {p.category === "supplements"
                        ? p.supplements.length +
                          (p.supplements.length === 1
                            ? " stavka"
                            : p.supplements.length < 5
                              ? " stavke"
                              : " stavki")
                        : p.days.length
                          ? p.days.length +
                            " " +
                            (p.category === "training"
                              ? p.days.length === 1
                                ? "trening"
                                : "treninga"
                              : p.days.length === 1
                                ? "dan"
                                : "dana")
                          : "Opis programa"}
                    </span>
                  </div>
                </div>
              </button>
              <button
                className="program-save icon-button"
                aria-label={
                  (saved.includes(p.id)
                    ? "Uklonite iz sačuvanih: "
                    : "Sačuvajte: ") + p.title
                }
                aria-pressed={saved.includes(p.id)}
                onClick={() => toggleSaved(p.id)}
              >
                {saved.includes(p.id) ? (
                  <Check size={16} />
                ) : (
                  <Bookmark size={16} />
                )}
              </button>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty-state">
          <Search size={28} />
          <h3>Nema programa za ovaj izbor.</h3>
          <button
            className="text-link"
            onClick={() => {
              setQuery("");
              setOnlySaved(false);
              setCategory("all");
            }}
          >
            Prikažite sve programe
          </button>
        </div>
      )}
      <p className="food-footnote">
        Kolekcija prema programima autora Aldina Rastodera. Sadržaj programa
        možete pregledati prije dogovora s trenerom.
      </p>
    </div>
  );
}
function ProgramDetail({
  program: p,
  back,
  onPrepare,
}: {
  program: Program;
  back: () => void;
  onPrepare?: (
    title: string,
    exercises: NonNullable<ReturnType<typeof programExercises>>,
  ) => void;
}) {
  const [day, setDay] = useState(0);
  const current = p.days[day];
  const exercises = programExercises(p, day);
  return (
    <div className="program-detail">
      <button className="text-link" onClick={back}>
        <ArrowLeft size={17} /> Svi programi
      </button>
      <img
        className="program-detail-cover"
        src={p.image}
        alt={p.title}
        width={900}
        height={600}
      />
      <div className={"program-detail-head program-" + p.category}>
        <span className="sheet-kicker">
          {programCategories[p.category]} · ALDA KOLEKCIJA
        </span>
        <h2>{p.title}</h2>
        <p>{p.summary}</p>
        <span className="program-author">Autor · {p.author}</span>
      </div>
      {p.days.length > 1 && (
        <div className="collection-tabs">
          {p.days.map((d, i) => (
            <button
              key={d.number}
              aria-pressed={day === i}
              onClick={() => setDay(i)}
            >
              Dan {d.number}
            </button>
          ))}
        </div>
      )}
      {current?.exercises.length ? (
        <section className="program-content">
          <div className="section-heading">
            <div>
              <span className="sheet-kicker">DAN {current.number}</span>
              <h3>{current.title}</h3>
            </div>
            <span className="muted">{current.exercises.length} vježbi</span>
          </div>
          {current.exercises.map((e, i) => (
            <article className="program-exercise" key={i}>
              <span className="exercise-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <small>{e.section}</small>
                <h4>{e.name || "Naziv nedostaje u izvornom programu"}</h4>
                <p>
                  {e.prescription || "Trajanje nije navedeno"}
                  {e.rest ? " · Odmor " + e.rest + " s" : ""}
                </p>
              </div>
            </article>
          ))}
          {onPrepare && exercises && (
            <button
              className="primary full"
              onClick={() =>
                onPrepare(`${p.title} · Dan ${current.number}`, exercises)
              }
            >
              Prilagodite klijentu <ArrowUpRight size={17} />
            </button>
          )}
        </section>
      ) : null}
      {current?.meals.length ? (
        <section className="program-content">
          {current.meals.every((m) => m.calories !== null) && (
            <div className="program-calorie-total">
              <span>Ukupno prema navedenim obrocima</span>
              <strong>
                {current.meals.reduce((sum, m) => sum + (m.calories || 0), 0)}{" "}
                <small>kcal</small>
              </strong>
            </div>
          )}
          {current.meals.map((m, i) => (
            <article className="program-meal" key={i}>
              <div className="section-heading">
                <h3>{m.name}</h3>
                <small>{m.time}</small>
              </div>
              <p>{m.details.replaceAll("•", " · ").replace(/^ · /, "")}</p>
              {m.calories !== null && (
                <div className="program-macros">
                  <strong>{m.calories} kcal</strong>
                  {Object.entries(m.macros).map(([k, v]) => (
                    <span key={k}>
                      {
                        (
                          {
                            P: "Proteini",
                            C: "Ugljikohidrati",
                            F: "Masti",
                          } as Record<string, string>
                        )[k]
                      }{" "}
                      {v} g
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </section>
      ) : null}
      {p.supplements.length > 0 && (
        <section className="program-content">
          <p className="information">
            Referentni sadržaj autora. Doze nisu individualna preporuka;
            pregledajte ih sa svojim ljekarom ili stručnjakom prije upotrebe.
          </p>
          {p.supplements.map((s, i) => (
            <article className="program-exercise" key={i}>
              <span className="exercise-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h4>{s.name}</h4>
                <p>
                  {s.dose} · {s.time}
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
      {p.needsReview && p.category === "training" && (
        <p className="information">
          {!p.days.length
            ? "Izvorni program još nema raspored treninga. Opis je sačuvan; trener treba dodati vježbe."
            : "Neki nazivi ili upute nedostaju u izvoru. Trener treba pregledati sadržaj prije dodjele."}
        </p>
      )}
      <p className="food-footnote">
        <a href={p.source} target="_blank" rel="noreferrer">
          Pogledajte izvorni program <ArrowUpRight size={12} />
        </a>
      </p>
    </div>
  );
}
