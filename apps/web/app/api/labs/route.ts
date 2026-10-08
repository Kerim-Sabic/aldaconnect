import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { labUpload, labReview, validateLabPdf } from "@/lib/labs";
import { labCall, labError } from "@/lib/lab-server";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(req: NextRequest) {
  try {
    const clientId = req.nextUrl.searchParams.get("client") ?? undefined,
      id = req.nextUrl.searchParams.get("file");
    const value = await labCall(
      req,
      id ? "file" : "snapshot",
      id ? { id: z.uuid().parse(id), clientId } : { clientId },
    );
    if (id) {
      const result = value as { fileBase64: string; filename: string };
      return new NextResponse(Buffer.from(result.fileBase64, "base64"), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${result.filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return reply(value);
  } catch (e) {
    return reply({ error: labError(e) }, 403);
  }
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (!origin || new URL(origin).host !== req.headers.get("host"))
      return reply({ error: "Zahtjev nije dozvoljen." }, 403);
    if (Number(req.headers.get("content-length") ?? 0) > 3000000)
      return reply({ error: "Najveća veličina PDF-a je 2 MB." }, 413);
    if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
      const reader = req.body?.getReader();
      if (!reader) return reply({ error: "Datoteka nedostaje." }, 400);
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > 3000000) {
          await reader.cancel();
          return reply({ error: "Najveća veličina PDF-a je 2 MB." }, 413);
        }
        chunks.push(value);
      }
      const form = await new Response(Buffer.concat(chunks), {
          headers: { "Content-Type": req.headers.get("content-type")! },
        }).formData(),
        file = form.get("file");
      if (
        !(file instanceof File) ||
        file.type !== "application/pdf" ||
        file.size > 2097152 ||
        !file.name.toLowerCase().endsWith(".pdf")
      )
        return reply({ error: "Odaberite PDF do 2 MB." }, 400);
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!validateLabPdf(bytes))
        return reply(
          { error: "PDF nije podržan ili sadrži aktivni sadržaj." },
          400,
        );
      const payload = labUpload.parse(
        Object.fromEntries(
          ["id", "clientId", "title", "provider", "date"].map((key) => [
            key,
            form.get(key) ?? undefined,
          ]),
        ),
      );
      return reply(
        await labCall(req, "upload", {
          ...payload,
          fileBase64: Buffer.from(bytes).toString("base64"),
        }),
      );
    }
    if (!req.headers.get("content-type")?.includes("application/json"))
      return reply({ error: "Neispravan format." }, 415);
    const raw = await req.text();
    if (raw.length > 8000) return reply({ error: "Zahtjev je prevelik." }, 413);
    const body = z
      .object({
        action: z.enum(["review", "grant", "remove", "restore"]),
        payload: z.record(z.string(), z.unknown()),
      })
      .parse(JSON.parse(raw));
    const payload =
      body.action === "review"
        ? labReview.parse(body.payload)
        : body.action === "grant"
          ? z
              .object({
                doctorId: z.string().min(1).max(80),
                granted: z.boolean(),
              })
              .parse(body.payload)
          : z
              .object({ id: z.uuid(), clientId: z.string().max(80).optional() })
              .parse(body.payload);
    return reply(await labCall(req, body.action, payload));
  } catch (e) {
    return reply({ error: labError(e) }, 400);
  }
}
