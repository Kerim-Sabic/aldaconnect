"use client";
import { useEffect, useRef, useState } from "react";
import { Download, Share, Smartphone, WifiOff, X } from "lucide-react";
import { focusScope } from "./focus-scope";
import Brand from "./brand";
type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  const [apple, setApple] = useState(false);
  const [offline, setOffline] = useState(false);
  const [failure, setFailure] = useState(false);
  const [newRelease, setNewRelease] = useState("");
  const [dismissed, setDismissed] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  useEffect(() => {
    setApple(
      /iPhone|iPad|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const open = () => setHelp(true);
    window.addEventListener("alda-install", open);
    return () => window.removeEventListener("alda-install", open);
  }, []);
  useEffect(() => {
    if (help && helpRef.current)
      return focusScope(helpRef.current, () => setHelp(false));
  }, [help]);
  useEffect(() => {
    let stopped = false;
    let checking = false;
    const check = async () => {
      if (
        checking ||
        !navigator.onLine ||
        document.visibilityState !== "visible"
      )
        return;
      checking = true;
      try {
        const response = await fetch("/api/release", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        if (
          !stopped &&
          typeof result.release === "string" &&
          result.release !== process.env.NEXT_PUBLIC_APP_RELEASE
        )
          setNewRelease(result.release);
        if ("serviceWorker" in navigator)
          await (await navigator.serviceWorker.getRegistration())?.update();
      } catch {
        /* A failed update check never interrupts normal use. */
      } finally {
        checking = false;
      }
    };
    void check();
    const interval = window.setInterval(check, 5 * 60 * 1000);
    window.addEventListener("focus", check);
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      stopped = true;
      clearInterval(interval);
      window.removeEventListener("focus", check);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const standalone = () =>
      setInstalled(
        media.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    standalone();
    const ready = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallEvent);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
      setHelp(false);
    };
    const network = () => setOffline(!navigator.onLine);
    network();
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    window.addEventListener("online", network);
    window.addEventListener("offline", network);
    media.addEventListener("change", standalone);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => setFailure(true));
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
      window.removeEventListener("online", network);
      window.removeEventListener("offline", network);
      media.removeEventListener("change", standalone);
    };
  }, []);
  return (
    <>
      {newRelease && newRelease !== dismissed && (
        <section
          className="update-notice"
          role="status"
          aria-label="Ažuriranje aplikacije"
        >
          <strong>Nova verzija je dostupna.</strong>
          <p>
            {updateMessage ||
              "Sačuvajte unos prije ažuriranja. Vaša prijava i podaci ostaju povezani."}
          </p>
          <div>
            <button
              className="primary"
              onClick={() => {
                if (document.documentElement.dataset.updateBlocked === "true") {
                  setUpdateMessage(
                    "Završite trening, sačuvajte promjene i sinhronizujte serije prije ažuriranja.",
                  );
                  return;
                }
                if (
                  window.confirm(
                    "Jeste li sačuvali unos? Ažuriranje će ponovo otvoriti aplikaciju.",
                  )
                )
                  window.location.reload();
              }}
            >
              Ažurirajte aplikaciju
            </button>
            <button
              className="secondary"
              onClick={() => setDismissed(newRelease)}
            >
              Kasnije
            </button>
          </div>
        </section>
      )}
      <div className="install-tools">
        {offline && (
          <span role="status">
            <WifiOff size={15} /> Bez veze · za nove podatke potrebna je veza
          </span>
        )}
        {!installed && (
          <button
            onClick={async () => {
              if (!prompt) {
                setHelp(true);
                return;
              }
              try {
                await prompt.prompt();
                await prompt.userChoice;
                setPrompt(null);
              } catch {
                setHelp(true);
              }
            }}
          >
            <Download size={16} /> Dodajte na početni ekran
          </button>
        )}
      </div>
      {help && (
        <div className="install-backdrop" onClick={() => setHelp(false)}>
          <div
            ref={helpRef}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
            className="install-help"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
          >
            <button
              className="icon-btn"
              aria-label="Zatvorite upute"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <Brand />
            <h3 id="install-title">
              Vaš prostor.
              <br />
              Na jedan dodir.
            </h3>
            {installed ? (
              <p>Aplikacija je već otvorena kao samostalna aplikacija.</p>
            ) : (
              <>
                <p>
                  Dodajte Alda Connect na početni ekran i otvorite ga kao
                  aplikaciju, bez trake preglednika.
                </p>
                {apple ? (
                  <ol className="install-steps">
                    <li>
                      <Share size={18} />
                      <span>
                        Otvorite ovu stranicu u <strong>Safariju</strong> i
                        dodirnite <strong>Podijeli</strong>.
                      </span>
                    </li>
                    <li>
                      <PlusIcon />
                      <span>
                        Odaberite <strong>Dodaj na početni ekran</strong>.
                      </span>
                    </li>
                    <li>
                      <Smartphone size={18} />
                      <span>
                        Dodirnite <strong>Dodaj</strong>. Vaša aplikacija je
                        spremna.
                      </span>
                    </li>
                  </ol>
                ) : (
                  <ol className="install-steps">
                    <li>
                      <Download size={18} />
                      <span>
                        U meniju preglednika odaberite{" "}
                        <strong>Instaliraj aplikaciju</strong> ili{" "}
                        <strong>Dodaj na početni ekran</strong>.
                      </span>
                    </li>
                    <li>
                      <Smartphone size={18} />
                      <span>
                        Potvrdite instalaciju i otvorite novu ikonu Alda
                        Connect.
                      </span>
                    </li>
                  </ol>
                )}
                {prompt && (
                  <button
                    className="primary full"
                    onClick={async () => {
                      try {
                        await prompt.prompt();
                        await prompt.userChoice;
                        setPrompt(null);
                      } catch {
                        setFailure(true);
                      }
                    }}
                  >
                    <Download size={17} /> Instalirajte aplikaciju
                  </button>
                )}
                <p className="food-footnote">
                  Vaši podaci ostaju povezani s istim računom. Za učitavanje i
                  čuvanje novih unosa potrebna je internetska veza.
                </p>
              </>
            )}
            {failure && (
              <p>
                Priprema instalacije nije uspjela. Osvježite stranicu kada
                budete povezani.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
function PlusIcon() {
  return (
    <span aria-hidden="true" style={{ fontSize: 22, lineHeight: 1 }}>
      +
    </span>
  );
}
