export type Role =
  "admin" | "client" | "trainer" | "doctor" | "nutritionist" | "therapist";
export const modules = [
  {
    id: "training",
    name: "Trening",
    description: "Vaši programi, treninzi i tehnika.",
    category: "Svakodnevno",
    available: true,
  },
  {
    id: "nutrition",
    name: "Ishrana",
    description: "Obroci, hidratacija i svakodnevne navike.",
    category: "Svakodnevno",
    available: true,
  },
  {
    id: "progress",
    name: "Napredak",
    description: "Mjerenja i cjelovita slika napretka.",
    category: "Svakodnevno",
    available: true,
  },
  {
    id: "recovery",
    name: "Oporavak",
    description: "San, energija i spremnost za svakodnevne aktivnosti.",
    category: "Svakodnevno",
    available: true,
  },
  {
    id: "cycle",
    name: "Ciklus i simptomi",
    description: "Privatno praćenje prilagođeno vašem iskustvu.",
    category: "Zdravlje i podrška",
    available: false,
  },
  {
    id: "rehab",
    name: "Rehabilitacija",
    description: "Oporavak i povratak treningu uz fizioterapeuta.",
    category: "Zdravlje i podrška",
    available: false,
  },
  {
    id: "labs",
    name: "Nalazi i zdravstvena podrška",
    description: "Evidencija i odgovorno stručno praćenje.",
    category: "Zdravlje i podrška",
    available: false,
  },
  {
    id: "medications",
    name: "Lijekovi i suplementi",
    description: "Povjerljiva evidencija i stručni pregled.",
    category: "Zdravlje i podrška",
    available: false,
  },
  {
    id: "community",
    name: "Zajednica",
    description: "Učite i povezujte se svojim tempom.",
    category: "Istražite",
    available: false,
  },
  {
    id: "wearables",
    name: "Povezani uređaji",
    description: "Podaci s vaših uređaja uz jasne dozvole.",
    category: "Istražite",
    available: false,
  },
] as const;
export type ModuleId = (typeof modules)[number]["id"];
export function effectiveModule(
  selected: boolean,
  available: boolean,
  entitled: boolean,
) {
  return selected && available && entitled;
}
export type Actor = {
  id: string;
  role: Role;
  name: string;
  email: string;
  onboarded: boolean;
};
export function canAccessClient(
  actor: Actor,
  clientId: string,
  assignedIds: string[],
) {
  return (
    actor.id === clientId ||
    (actor.role === "trainer" && assignedIds.includes(clientId))
  );
}
export function normalizeModules(ids: string[]) {
  return [...new Set(ids)].filter((id) => modules.some((m) => m.id === id));
}
export function validateSet(weight: number, reps: number) {
  return (
    Number.isFinite(weight) &&
    weight >= 0 &&
    weight <= 1000 &&
    Number.isInteger(reps) &&
    reps > 0 &&
    reps <= 200
  );
}
export type Exercise = {
  id: string;
  name: string;
  group: string;
  sets: number;
  reps: string;
  weight: number;
  cue: string;
  metric?: "reps" | "seconds";
};
export const isTimed = (exercise: Exercise) =>
  exercise.metric === "seconds" || /\bsec\b/i.test(exercise.reps);
export const exercises: Exercise[] = [
  {
    id: "squat",
    name: "Čučanj sa šipkom",
    group: "Donji dio tijela",
    sets: 3,
    reps: "8–10",
    weight: 60,
    cue: "Ne žurite. Kontrolišite svako ponavljanje.",
  },
  {
    id: "rdl",
    name: "Rumunsko mrtvo dizanje",
    group: "Zadnji mišićni lanac",
    sets: 3,
    reps: "10–12",
    weight: 40,
    cue: "Krećite se unutar ugodnog opsega pokreta.",
  },
  {
    id: "lunge",
    name: "Iskorak unazad",
    group: "Jednonožna vježba",
    sets: 3,
    reps: "10 po strani",
    weight: 12,
    cue: "Mijenjajte strane. Odmorite po potrebi.",
  },
  {
    id: "plank",
    name: "Izdržaj",
    group: "Trup",
    sets: 3,
    reps: "30 sec",
    weight: 0,
    cue: "Dišite ravnomjerno tokom cijele vježbe.",
  },
];
