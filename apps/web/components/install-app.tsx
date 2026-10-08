"use client";
import { useEffect, useState } from "react";
import { Download, WifiOff, X } from "lucide-react";
type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(true);
  const [help, setHelp] = useState(false);
  const [offline, setOffline] = useState(false);
  const [failure, setFailure] = useState(false);
  const [newRelease, setNewRelease] = useState("");
  const [dismissed, setDismissed] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
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
        {help && (
          <div
            className="install-help"
            role="dialog"
            aria-label="Instalacija aplikacije"
          >
            <button
              className="icon-btn"
              aria-label="Zatvorite upute"
              onClick={() => setHelp(false)}
            >
              <X size={18} />
            </button>
            <h3>Vaš prostor, na jedan dodir.</h3>
            <p>
              iPhone / iPad: otvorite stranicu u Safariju, odaberite{" "}
              <strong>Podijeli → Dodaj na početni ekran</strong>.
            </p>
            <p>
              Android / računar: u meniju preglednika odaberite{" "}
              <strong>Instaliraj aplikaciju</strong> ili{" "}
              <strong>Dodaj na početni ekran</strong>.
            </p>
            <p>
              Prijavite se istim računom. Instalirana aplikacija koristi istu
              bazu i sinhronizuje podatke dok ste povezani.
            </p>
            {failure && (
              <p>
                Priprema instalacije nije uspjela. Osvježite stranicu kada
                budete povezani.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
