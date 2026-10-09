"use client";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { productCode } from "@/lib/barcode";
import { Camera, ImagePlus, LoaderCircle, X, Zap } from "lucide-react";
type NativeDetector = {
  detect: (
    image: HTMLVideoElement,
  ) => Promise<{ rawValue: string; format: string }[]>;
};
type DetectorConstructor = {
  new (options: { formats: string[] }): NativeDetector;
  getSupportedFormats: () => Promise<string[]>;
};
export default function BarcodeCamera({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const alive = useRef(true);
  const delivered = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onCode);
  callback.current = onCode;
  const stopRef = useRef<() => void>(() => {});
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  useEffect(() => {
    alive.current = true;
    let stopped = false;
    let scanner: IScannerControls | undefined;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      scanner?.stop();
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
    stopRef.current = stop;
    const accept = (raw: string, format?: string) => {
      const code = productCode(raw, format === "upc_e" ? "UPC_E" : undefined);
      if (!code) {
        setError(
          "Usmjerite kameru na barkod proizvoda ili QR kod s GTIN brojem.",
        );
        return;
      }
      if (delivered.current || !alive.current) return;
      delivered.current = true;
      stop();
      navigator.vibrate?.(40);
      callback.current(code);
    };
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw Error("Camera unavailable");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = stream.getVideoTracks()[0];
        trackRef.current = track;
        const capabilities =
          track.getCapabilities?.() as MediaTrackCapabilities & {
            torch?: boolean;
            focusMode?: string[];
          };
        setTorchAvailable(Boolean(capabilities?.torch));
        if (capabilities?.focusMode?.includes("continuous"))
          void track
            .applyConstraints({
              advanced: [
                { focusMode: "continuous" } as MediaTrackConstraintSet,
              ],
            })
            .catch(() => {});
        video.current!.srcObject = stream;
        await video.current!.play();
        if (stopped) return;
        const fallback = async () => {
          const { BrowserMultiFormatReader, BarcodeFormat } =
            await import("@zxing/browser");
          if (stopped) return;
          const hints = new Map([
            [
              2,
              [
                BarcodeFormat.EAN_13,
                BarcodeFormat.EAN_8,
                BarcodeFormat.UPC_A,
                BarcodeFormat.UPC_E,
                BarcodeFormat.QR_CODE,
                BarcodeFormat.DATA_MATRIX,
                BarcodeFormat.CODE_128,
                BarcodeFormat.ITF,
              ],
            ],
          ]);
          const reader = new BrowserMultiFormatReader(hints, {
            delayBetweenScanAttempts: 150,
            delayBetweenScanSuccess: 1000,
          });
          scanner = await reader.decodeFromStream(
            stream!,
            video.current!,
            (result) => {
              if (result && !stopped)
                accept(
                  result.getText(),
                  result.getBarcodeFormat() === BarcodeFormat.UPC_E
                    ? "upc_e"
                    : undefined,
                );
            },
          );
          if (stopped) scanner.stop();
        };
        const Constructor = (
          window as unknown as { BarcodeDetector?: DetectorConstructor }
        ).BarcodeDetector;
        let detector: NativeDetector | undefined;
        if (Constructor) {
          try {
            const supported = await Constructor.getSupportedFormats();
            const formats = [
              "ean_13",
              "ean_8",
              "upc_a",
              "upc_e",
              "qr_code",
              "data_matrix",
              "code_128",
              "itf",
            ].filter((f) => supported.includes(f));
            if (formats.includes("ean_13") && formats.includes("ean_8"))
              detector = new Constructor({ formats });
          } catch {}
        }
        if (stopped) return;
        setReady(true);
        if (detector) {
          const scan = async () => {
            if (stopped) return;
            try {
              if (video.current!.readyState >= 2) {
                const matches = await detector!.detect(video.current!);
                for (const match of matches) {
                  if (
                    productCode(
                      match.rawValue,
                      match.format === "upc_e" ? "UPC_E" : undefined,
                    )
                  ) {
                    accept(match.rawValue, match.format);
                    return;
                  }
                }
              }
            } catch {
              if (!stopped)
                void fallback().catch(() =>
                  setError(
                    "Skeniranje nije dostupno. Odaberite fotografiju ili unesite barkod.",
                  ),
                );
              return;
            }
            if (!stopped) timer = setTimeout(() => void scan(), 150);
          };
          void scan();
        } else await fallback();
      } catch (e) {
        if (!stopped) {
          stream?.getTracks().forEach((t) => t.stop());
          setError(
            (e as Error).name === "NotAllowedError"
              ? "Dozvolite kameru u postavkama preglednika ili odaberite fotografiju barkoda."
              : "Kamera nije dostupna. Odaberite fotografiju ili unesite barkod ručno.",
          );
        }
      }
    };
    void start();
    return () => {
      alive.current = false;
      stop();
    };
  }, []);
  return (
    <div className="barcode-camera">
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        aria-label="Kamera za skeniranje barkoda"
      />
      <div className="barcode-target" aria-hidden="true" />
      <button
        className="icon-button"
        aria-label="Zatvorite kameru"
        onClick={() => {
          stopRef.current();
          onClose();
        }}
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
      <div className="scanner-tools">
        {torchAvailable && (
          <button
            type="button"
            aria-pressed={torch}
            onClick={async () => {
              try {
                await trackRef.current?.applyConstraints({
                  advanced: [{ torch: !torch } as MediaTrackConstraintSet],
                });
                setTorch((v) => !v);
              } catch {
                setError("Svjetlo nije dostupno na ovom uređaju.");
              }
            }}
          >
            <Zap size={16} /> Svjetlo
          </button>
        )}
        <button
          type="button"
          disabled={photoBusy}
          onClick={() => photoRef.current?.click()}
        >
          {photoBusy ? (
            <LoaderCircle className="spinning" size={16} />
          ) : (
            <ImagePlus size={16} />
          )}{" "}
          Fotografija
        </button>
      </div>
      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > 15 * 1024 * 1024) {
            setError("Odaberite fotografiju manju od 15 MB.");
            return;
          }
          setPhotoBusy(true);
          setError("");
          let url = "";
          try {
            const { BrowserMultiFormatReader, BarcodeFormat } =
              await import("@zxing/browser");
            url = URL.createObjectURL(file);
            const result =
              await new BrowserMultiFormatReader().decodeFromImageUrl(url);
            const code = productCode(
              result.getText(),
              result.getBarcodeFormat() === BarcodeFormat.UPC_E
                ? "UPC_E"
                : undefined,
            );
            if (!code) throw Error();
            if (alive.current && !delivered.current) {
              delivered.current = true;
              stopRef.current();
              callback.current(code);
            }
          } catch {
            setError(
              "Barkod nije prepoznat. Približite fotografiju barkodu ili unesite broj ručno.",
            );
          } finally {
            if (url) URL.revokeObjectURL(url);
            setPhotoBusy(false);
          }
        }}
      />
      {error && (
        <p className="food-error" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
