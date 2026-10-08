import { it, expect } from "vitest";
import { validateLabPdf, labUpload } from "../apps/web/lib/labs";
it("bounds PDF uploads and rejects obvious active content or incomplete files", () => {
  const pdf = (s: string) => Buffer.from(s, "latin1");
  expect(validateLabPdf(pdf("%PDF-1.4\nfictional\n%%EOF"))).toBe(true);
  expect(validateLabPdf(pdf("not a PDF\n%%EOF"))).toBe(false);
  expect(validateLabPdf(pdf("%PDF-1.4\nincomplete"))).toBe(false);
  expect(validateLabPdf(pdf("%PDF-1.4\n/JavaScript (alert())\n%%EOF"))).toBe(
    false,
  );
  expect(
    validateLabPdf(
      Buffer.concat([pdf("%PDF-"), Buffer.alloc(2097152), pdf("%%EOF")]),
    ),
  ).toBe(false);
  expect(
    labUpload.safeParse({
      id: "ed7aa66e-67bc-4f88-a631-18cd6bf14890",
      title: "Test",
      provider: "Fixture",
      date: "2999-01-01",
    }).success,
  ).toBe(false);
});
