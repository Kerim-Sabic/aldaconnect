"use client";
import { useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { productCode } from "@/lib/barcode";
import { Camera, LoaderCircle, X } from "lucide-react";
export default function BarcodeCamera({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let stopped = false;
    let controls: IScannerControls | undefined;
    const video = videoRef.current;
    const reader = new BrowserMultiFormatReader(undefined, {
      delayBetweenScanAttempts: 200,
      delayBetweenScanSuccess: 1000,
    });
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Kamera nije dostupna. Otvorite aplikaciju putem HTTPS adrese ili unesite broj barkoda ručno.",
      );
      return;
    }
    void reader
      .decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        video!,
        (result, _error, scanner) => {
          if (!result || stopped) return;
          const code = productCode(result.getText());
          if (!code) {
            setError(
              "Ovaj kod ne sadrži prepoznatljiv barkod proizvoda. Usmjerite kameru prema barkodu na pakovanju.",
            );
            return;
          }
          stopped = true;
          scanner.stop();
          onCode(code);
        },
      )
      .then((scanner) => {
        controls = scanner;
        if (stopped) scanner.stop();
        else setReady(true);
      })
      .catch((e) => {
        if (!stopped)
          setError(
            e?.name === "NotAllowedError"
              ? "Dozvolite kameru u postavkama preglednika ili unesite barkod ručno."
              : "Kameru nije moguće otvoriti. Pokušajte ponovo ili unesite barkod ručno.",
          );
      });
    return () => {
      stopped = true;
      controls?.stop();
      if (video?.srcObject instanceof MediaStream)
        video.srcObject.getTracks().forEach((track) => track.stop());
    };
  }, [onCode]);
  return (
    <div className="barcode-camera">
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-label="Kamera za skeniranje barkoda"
      />
      <div className="barcode-target" aria-hidden="true" />
      <button
        className="icon-button"
        aria-label="Zatvorite kameru"
        onClick={onClose}
      >
        <X size={18} />
      </button>
      {!ready && !error && (
        <p role="status">
          <LoaderCircle className="spinning" size={18} /> Pripremamo kameru…
        </p>
      )}
      <span className="barcode-camera-hint">
        <Camera size={16} /> Poravnajte barkod s okvirom.
      </span>
      {error && (
        <p className="food-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
