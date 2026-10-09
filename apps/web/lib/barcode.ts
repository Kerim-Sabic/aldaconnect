export function expandUpce(code: string): string | null {
  if (!/^[01]\d{7}$/.test(code)) return null;
  const [a, b, c, d, e, f] = code.slice(1, 7);
  let body: string;
  if ("012".includes(f)) body = a + b + f + "0000" + c + d + e;
  else if (f === "3") body = a + b + c + "00000" + d + e;
  else if (f === "4") body = a + b + c + d + "00000" + e;
  else body = a + b + c + d + e + "0000" + f;
  return productCode(code[0] + body + code[7]);
}
export function productCode(input: string, format?: "UPC_E"): string | null {
  if (format === "UPC_E") return expandUpce(input.trim());
  let code = input.trim().replace(/[ -]/g, "");
  const gs1 = input
    .trim()
    .match(/^(?:\]C1|\]d2|\]Q3)?(?:\(01\)|01)(\d{14})(?:\x1d|\(|\d|$)/);
  if (gs1) code = gs1[1];
  if (!/^\d+$/.test(code)) {
    try {
      const url = new URL(input.trim());
      if (url.protocol !== "https:") return null;
      const off = /(^|\.)openfoodfacts\.(org|net)$/.test(url.hostname);
      code =
        (off
          ? url.pathname.match(/\/(?:product|produit)\/(\d{8,14})(?:\/|$)/)?.[1]
          : url.pathname.match(/\/01\/(\d{14})(?:\/|$)/)?.[1]) ?? "";
    } catch {
      return null;
    }
  }
  if (![8, 12, 13, 14].includes(code.length) || !/^\d+$/.test(code))
    return null;
  const digits = [...code].map(Number);
  const check = digits.pop();
  const sum = digits
    .reverse()
    .reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
      0,
    );
  return (10 - (sum % 10)) % 10 === check ? code : null;
}
export function productCodeVariants(code: string): string[] {
  const variants = [code];
  if (code.length === 14 && code.startsWith("0")) variants.push(code.slice(1));
  const ean = variants.at(-1)!;
  if (ean.length === 13 && ean.startsWith("0")) variants.push(ean.slice(1));
  if (code.length === 12) variants.push("0" + code);
  return [...new Set(variants)];
}
export type FoodProduct = {
  code: string;
  name: string;
  brand: string;
  caloriesPer100: number;
  unit: "g" | "ml";
  serving: number | null;
  source: string;
  protein?: number;
  carbs?: number;
  fat?: number;
  sugars?: number | null;
  fiber?: number | null;
  saturated?: number | null;
  salt?: number | null;
  packageQuantity?: number | null;
  ingredients?: string;
  allergens?: string;
  description?: string;
  version?: number;
  canEdit?: boolean;
  hidden?: boolean;
  reports?: { reason: string; createdAt: string }[];
};
export function portionCalories(per100: number, amount: number) {
  return Math.round((per100 * amount) / 100);
}
type Nutrient = { value?: number; unit?: string; source?: string };
type NutritionSet = {
  per?: string;
  per_quantity?: number;
  per_unit?: string;
  preparation?: string;
  nutrients?: Record<string, Nutrient>;
};
export function readFoodProduct(
  code: string,
  raw: Record<string, unknown>,
): FoodProduct | null {
  const p = raw.product as Record<string, unknown> | undefined;
  if ((raw.status !== 1 && raw.status !== "success") || !p) return null;
  const nutrition = p.nutrition as
    { aggregated_set?: NutritionSet; input_sets?: NutritionSet[] } | undefined;
  const aggregate = nutrition?.aggregated_set;
  let calories: number;
  let unit: "g" | "ml";
  let serving: number | null = null;
  if (aggregate) {
    if (
      !["100g", "100ml"].includes(aggregate.per ?? "") ||
      aggregate.preparation !== "as_sold"
    )
      return null;
    const kcal = aggregate.nutrients?.["energy-kcal"];
    const kj =
      aggregate.nutrients?.["energy-kj"] ?? aggregate.nutrients?.energy;
    const energy = typeof kcal?.value === "number" ? kcal : kj;
    if (!energy || energy.source === "estimate") return null;
    calories =
      energy.unit === "kcal"
        ? Number(energy.value)
        : energy.unit === "kJ"
          ? Number(energy.value) / 4.184
          : NaN;
    unit = aggregate.per === "100ml" ? "ml" : "g";
    const portion = nutrition?.input_sets?.find(
      (set) =>
        set.per === "serving" &&
        set.preparation === "as_sold" &&
        set.per_unit === unit,
    );
    serving = portion?.per_quantity ?? null;
  } else {
    const nutrients = p.nutriments as Record<string, unknown> | undefined;
    const energy = nutrients?.["energy-kcal_100g"];
    const kj = nutrients?.energy_100g;
    calories =
      typeof energy === "number"
        ? energy
        : typeof kj === "number"
          ? kj / 4.184
          : NaN;
    unit = p.serving_quantity_unit === "ml" ? "ml" : "g";
    serving =
      typeof p.serving_quantity === "number" ? p.serving_quantity : null;
  }
  if (!Number.isFinite(calories) || calories < 0 || calories > 1000)
    return null;
  if (
    serving !== null &&
    (!Number.isFinite(serving) || serving <= 0 || serving > 5000)
  )
    serving = null;
  const labelNutrients: Record<string, number> = {};
  for (const [key, providerKey] of Object.entries({
    protein: "proteins",
    carbs: "carbohydrates",
    fat: "fat",
    sugars: "sugars",
    fiber: "fiber",
    saturated: "saturated-fat",
    salt: "salt",
  })) {
    const declared = aggregate?.nutrients?.[providerKey];
    const legacy = (p.nutriments as Record<string, unknown> | undefined)?.[
      providerKey + "_100g"
    ];
    const value = aggregate
      ? declared?.source !== "estimate" && declared?.unit === "g"
        ? declared.value
        : undefined
      : legacy;
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 100
    )
      labelNutrients[key] = value;
  }
  return {
    ...labelNutrients,
    ingredients: String(p.ingredients_text || "").slice(0, 1000),
    allergens: String(p.allergens || "").slice(0, 300),
    code,
    name: String(
      p.product_name_bs ||
        p.product_name ||
        p.generic_name ||
        "Prehrambeni proizvod",
    ).slice(0, 160),
    brand: String(p.brands || "").slice(0, 80),
    caloriesPer100: Math.round(calories * 10) / 10,
    unit,
    serving,
    source: `https://world.openfoodfacts.org/product/${code}`,
  };
}
