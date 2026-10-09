"use client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Plus,
  Users,
  MessageCircle,
  Check,
  LoaderCircle,
  ArrowLeft,
  Search,
  X,
  UserPlus,
} from "lucide-react";
import { portalAction, useLiveUpdates } from "@/lib/live-updates";
export type ChatMessage = {
  id: string;
  sender_id: string;
  recipient_id?: string;
  sender_name: string;
  body: string;
  created_at: string;
};
export type TrainingGroup = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  status: string;
  members: { id: string; name: string; status: string }[];
};
export type PortalData = {
  groups: TrainingGroup[];
  messages: ChatMessage[];
  directMessages: ChatMessage[];
  coachingClients: string[];
};
export function MessageFeed({
  messages,
  actorId,
}: {
  messages: ChatMessage[];
  actorId: string;
}) {
  const feed = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  useEffect(() => {
    if (nearEnd.current && feed.current)
      feed.current.scrollTop = feed.current.scrollHeight;
  }, [messages.at(-1)?.id]);
  return (
    <div
      ref={feed}
      className="message-feed"
      onScroll={() => {
        const e = feed.current;
        if (e)
          nearEnd.current = e.scrollHeight - e.scrollTop - e.clientHeight < 100;
      }}
    >
      {messages.map((m) => (
        <div
          className={"message " + (m.sender_id === actorId ? "own" : "")}
          key={m.id}
        >
          <small>{m.sender_name}</small>
          <p>{m.body}</p>
          <time dateTime={m.created_at}>
            {new Date(m.created_at).toLocaleTimeString("bs-BA", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      ))}
      {!messages.length && (
        <div className="empty-state">
          <MessageCircle size={30} />
          <h3>Razgovor počinje ovdje.</h3>
          <p>Pošaljite prvu poruku.</p>
        </div>
      )}
    </div>
  );
}
export function ChatComposer({
  send,
  disabled = false,
}: {
  send: (text: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <form
        className="message-composer"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim() || busy) return;
          setBusy(true);
          setError("");
          try {
            await send(text.trim());
            setText("");
          } catch (e) {
            setError(e instanceof Error ? e.message : "Poruka nije poslana.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          aria-label="Poruka"
          placeholder="Napišite poruku…"
          maxLength={2000}
          required
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="primary"
          disabled={disabled || busy || !text.trim()}
          aria-label="Pošaljite poruku"
        >
          {busy ? (
            <LoaderCircle className="spinning" size={18} />
          ) : (
            <ArrowUpRight size={19} />
          )}
        </button>
      </form>
      {error && (
        <p className="food-error" role="alert">
          {error} Vaša poruka je ostala u polju.
        </p>
      )}
    </>
  );
}
export default function TrainingGroups({
  actorId,
  owner = false,
  clients = [],
}: {
  actorId: string;
  owner?: boolean;
  clients?: { id: string; name: string }[];
}) {
  const [selected, setSelected] = useState("");
  const { data, error, connected, refresh } = useLiveUpdates<PortalData>(
    "/api/portal" + (selected ? "?group=" + encodeURIComponent(selected) : ""),
  );
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [create, setCreate] = useState(false);
  const [invite, setInvite] = useState(false);
  const [all, setAll] = useState(false);
  const [userId, setUserId] = useState("");
  const [memberQuery, setMemberQuery] = useState("");
  const group = data?.groups.find((g) => g.id === selected);
  const eligible = clients.filter(
    (c) =>
      !group?.members.some(
        (m) => m.id === c.id && ["active", "invited"].includes(m.status),
      ),
  );
  const action = async (
    name: string,
    payload: Record<string, unknown>,
    success: string,
  ) => {
    setBusy(true);
    setNotice("");
    try {
      const result = await portalAction(name, payload);
      await refresh();
      setNotice(
        name === "inviteGroup"
          ? result.invited
            ? `${result.invited} ${result.invited === 1 ? "poziv je poslan" : "poziva je poslano"}. Klijenti mogu prihvatiti poziv u svom prostoru.`
            : "Svi odabrani klijenti su već članovi ili imaju otvoren poziv."
          : success,
      );
      return result;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Pokušajte ponovo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="groups-workspace clean-groups">
      <div className="section-heading">
        <div>
          <span className="sheet-kicker">ZAJEDNO JE LAKŠE</span>
          {owner ? (
            <h2>Trening grupe</h2>
          ) : (
            <p className="group-intro">
              Pridružite se grupi i ostanite u toku sa svojim timom.
            </p>
          )}
        </div>
        {owner && (
          <button className="primary" onClick={() => setCreate(!create)}>
            <Plus size={16} /> Nova grupa
          </button>
        )}
      </div>
      {notice && (
        <p className="information" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="food-error" role="status">
          {error}
        </p>
      )}
      {create && (
        <form
          className="crm-panel inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const r = await action(
              "createGroup",
              { name: f.get("name") },
              "Grupa je kreirana.",
            );
            if (r) {
              setCreate(false);
              setSelected(r.groupId);
            }
          }}
        >
          <div>
            <span className="sheet-kicker">VAŠ TIM</span>
            <h3>Nova trening grupa</h3>
            <p>Izaberite naziv. Klijente ćete pozvati u sljedećem koraku.</p>
          </div>
          <label>
            Naziv grupe
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder="npr. Jutarnji trening"
            />
          </label>
          <button className="primary" disabled={busy}>
            Kreirajte grupu
          </button>
        </form>
      )}
      {selected && (
        <button
          className="text-link group-back"
          onClick={() => {
            setSelected("");
            setInvite(false);
          }}
        >
          <ArrowLeft size={16} /> Sve grupe
        </button>
      )}
      {!selected && (
        <div className="group-grid">
          {data?.groups.map((g) => (
            <article
              className={
                "crm-panel group-card " +
                (g.status === "invited" ? "group-card-invited" : "")
              }
              key={g.id}
            >
              {g.status === "invited" && (
                <span className="group-invited-label">POZVANI STE</span>
              )}
              <span className="group-emblem">
                <Users size={24} />
              </span>
              <h3>{g.name}</h3>
              <p>
                {g.ownerName} ·{" "}
                {g.members.filter((m) => m.status === "active").length} članova
              </p>
              {g.status === "invited" ? (
                <>
                  <p className="food-footnote">
                    Prihvatanjem se povezujete s trenerom {g.ownerName}. Članovi
                    grupe vide vaše ime i poruke u grupi.
                  </p>
                  <div className="food-actions">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        action(
                          "respondInvite",
                          { groupId: g.id, response: "active" },
                          "Dobro došli u grupu.",
                        )
                      }
                    >
                      <Check size={16} /> Pridružite se
                    </button>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() =>
                        action(
                          "respondInvite",
                          { groupId: g.id, response: "declined" },
                          "Poziv je odbijen.",
                        )
                      }
                    >
                      Odbijte
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="secondary full"
                  onClick={() => setSelected(g.id)}
                >
                  Otvorite razgovor <ArrowUpRight size={16} />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      {!selected && data && !data.groups.length && (
        <div className="empty-state">
          <Users size={32} />
          <h3>{owner ? "Vaša prva grupa." : "Vaš tim, na jednom mjestu."}</h3>
          <p>
            {owner
              ? "Kreirajte grupu i pozovite jednog klijenta ili sve klijente."
              : "Pozivi u trening grupe pojavit će se ovdje."}
          </p>
        </div>
      )}
      {group && (
        <>
          {invite && owner && (
            <form
              className="group-invitation-panel"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!all && !userId) return;
                const result = await action(
                  "inviteGroup",
                  { groupId: group.id, scope: all ? "all" : "single", userId },
                  "Poziv je poslan.",
                );
                if (result) {
                  setInvite(false);
                  setUserId("");
                }
              }}
            >
              <header>
                <span className="group-invitation-icon">
                  <UserPlus size={22} />
                </span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Zatvorite poziv"
                  disabled={busy}
                  onClick={() => setInvite(false)}
                >
                  <X size={20} />
                </button>
              </header>
              <span className="sheet-kicker">RASTIMO ZAJEDNO</span>
              <h3>Pozovite svoj tim.</h3>
              <p>
                Poziv u grupu <strong>{group.name}</strong> stiže direktno u
                Alda aplikaciju.
              </p>
              <div
                className="catalog-tabs"
                role="group"
                aria-label="Koga pozivate"
              >
                <button
                  type="button"
                  aria-pressed={!all}
                  onClick={() => setAll(false)}
                >
                  Jedan klijent
                </button>
                <button
                  type="button"
                  aria-pressed={all}
                  onClick={() => setAll(true)}
                >
                  Svi klijenti <span>{eligible.length}</span>
                </button>
              </div>
              {all ? (
                <div className="group-invite-all">
                  <Users size={25} />
                  <strong>{eligible.length} novih poziva</strong>
                  <p>
                    Članovi i klijenti s otvorenim pozivom neće dobiti dupli
                    poziv.
                  </p>
                </div>
              ) : (
                <>
                  <label className="catalog-search">
                    <Search size={17} />
                    <input
                      placeholder="Pronađite klijenta"
                      aria-label="Pronađite klijenta za poziv"
                      maxLength={80}
                      value={memberQuery}
                      onChange={(e) => setMemberQuery(e.target.value)}
                    />
                  </label>
                  <div
                    className="invite-client-list"
                    role="radiogroup"
                    aria-label="Odaberite klijenta"
                  >
                    {eligible
                      .filter((c) =>
                        c.name
                          .toLocaleLowerCase()
                          .includes(memberQuery.toLocaleLowerCase()),
                      )
                      .map((c) => (
                        <label
                          key={c.id}
                          className={userId === c.id ? "selected" : ""}
                        >
                          <span className="avatar sage">
                            {c.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span>{c.name}</span>
                          <input
                            type="radio"
                            name="inviteClient"
                            value={c.id}
                            checked={userId === c.id}
                            onChange={() => setUserId(c.id)}
                            required={!all}
                          />
                        </label>
                      ))}
                    {!eligible.length ? (
                      <p>
                        Svi klijenti su već u grupi ili imaju otvoren poziv.
                      </p>
                    ) : (
                      !eligible.some((c) =>
                        c.name
                          .toLocaleLowerCase()
                          .includes(memberQuery.toLocaleLowerCase()),
                      ) && <p>Nema klijenata za ovu pretragu.</p>
                    )}
                  </div>
                </>
              )}
              <p className="group-invite-consent">
                <Check size={15} /> Klijent bira hoće li prihvatiti poziv.
                Povezivanje s trenerom počinje nakon prihvatanja.
              </p>
              <div className="product-editor-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setInvite(false)}
                  disabled={busy}
                >
                  Odustanite
                </button>
                <button
                  className="primary"
                  disabled={busy || !eligible.length || (!all && !userId)}
                >
                  {busy ? (
                    <LoaderCircle className="spinning" size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}{" "}
                  {all
                    ? `Pošaljite pozive (${eligible.length})`
                    : "Pošaljite poziv"}
                </button>
              </div>
            </form>
          )}
          <section className="conversation group-conversation">
            <header>
              <span className="avatar sage">
                <Users size={21} />
              </span>
              <div>
                <strong>{group.name}</strong>
                <small className="chat-status">
                  <i className={connected ? "online-dot" : "offline-dot"} />
                  {connected
                    ? "Poruke se automatski osvježavaju"
                    : "Ponovno povezivanje…"}
                </small>
              </div>
              {owner && (
                <button
                  className="secondary"
                  onClick={() => {
                    setInvite(!invite);
                    setMemberQuery("");
                    setUserId("");
                  }}
                  aria-expanded={invite}
                >
                  <Plus size={15} /> Pozovite
                </button>
              )}
            </header>
            <MessageFeed messages={data?.messages || []} actorId={actorId} />
            <ChatComposer
              send={async (text) => {
                await portalAction("groupMessage", { groupId: group.id, text });
                await refresh();
              }}
            />
          </section>
          <details className="crm-panel group-members">
            <summary>
              Članovi ·{" "}
              {group.members.filter((m) => m.status === "active").length}
            </summary>
            {group.members.map((m) => (
              <div className="crm-member-line" key={m.id}>
                <span>{m.name}</span>
                <small>
                  {m.status === "active"
                    ? "Član"
                    : m.status === "invited"
                      ? "Poziv poslan"
                      : m.status === "declined"
                        ? "Poziv odbijen"
                        : "Napustio grupu"}
                </small>
              </div>
            ))}
            {!owner && (
              <>
                <p className="food-footnote">
                  Napuštanje grupe prekida pristup grupnom razgovoru. Povezanost
                  s trenerom ostaje aktivna.
                </p>
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={async () => {
                    const r = await action(
                      "leaveGroup",
                      { groupId: group.id },
                      "Napustili ste grupu.",
                    );
                    if (r) setSelected("");
                  }}
                >
                  Napustite grupu
                </button>
              </>
            )}
          </details>
        </>
      )}
    </div>
  );
}
