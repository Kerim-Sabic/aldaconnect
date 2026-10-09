import { productCode, type FoodProduct } from "./barcode";
const key = (actorId: string) => "alda-food-products-v1:" + actorId;
export function savedFoods(actorId: string): FoodProduct[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(actorId)) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .slice(0, 300)
      .filter(
        (p: FoodProduct) =>
          p &&
          typeof p.code === "string" &&
          productCode(p.code) &&
          typeof p.name === "string" &&
          p.name.length <= 160 &&
          Number.isFinite(p.caloriesPer100) &&
          p.caloriesPer100 >= 0 &&
          p.caloriesPer100 <= 1000 &&
          ["g", "ml"].includes(p.unit),
      )
      .map((p: FoodProduct) => ({
        ...p,
        source: "device",
        brand: "Vaša deklaracija",
        serving: null,
      }));
  } catch {
    return [];
  }
}
export function saveFood(actorId: string, product: FoodProduct) {
  if (
    !actorId ||
    !productCode(product.code) ||
    !product.name.trim() ||
    !Number.isFinite(product.caloriesPer100) ||
    product.caloriesPer100 < 0 ||
    product.caloriesPer100 > 1000
  )
    throw Error("Provjerite vrijednosti s deklaracije.");
  try {
    localStorage.setItem(
      key(actorId),
      JSON.stringify(
        [
          { ...product, source: "device" },
          ...savedFoods(actorId).filter((p) => p.code !== product.code),
        ].slice(0, 300),
      ),
    );
  } catch {
    throw Error("Preglednik nije dozvolio čuvanje proizvoda na uređaju.");
  }
}
