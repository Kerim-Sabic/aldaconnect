"use client";
import { useState } from "react";
import LabRecords from "./lab-records";
import MedicationRecords from "./medication-records";
import Brand from "./brand";
import ThemeControl from "./theme-control";
export default function DoctorWorkspace({
  name,
  readOnly,
  logout,
  back,
  children,
}: {
  name: string;
  readOnly: boolean;
  logout: () => void;
  back: () => void;
  children: React.ReactNode;
}) {
  const [tab, setTab] = useState("labs");
  return (
    <main className="doctor-records">
      <header className="panel">
        <div className="doctor-utilities">
          <Brand />
          <ThemeControl />
        </div>
        <h1>{name}</h1>
        {readOnly ? (
          <button onClick={back}>Vratite se u administraciju</button>
        ) : (
          <button onClick={logout}>Odjavite se</button>
        )}
        <nav aria-label="Doktorski prostor">
          <button onClick={() => setTab("labs")} aria-pressed={tab === "labs"}>
            Nalazi
          </button>
          <button
            onClick={() => setTab("medications")}
            aria-pressed={tab === "medications"}
          >
            Lijekovi, suplementi i PED
          </button>
        </nav>
      </header>
      {children}
      {tab === "labs" ? (
        <LabRecords readOnly={readOnly} />
      ) : (
        <MedicationRecords readOnly={readOnly} />
      )}
    </main>
  );
}
