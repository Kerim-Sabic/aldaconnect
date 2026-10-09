import { expect, it } from "vitest";
import {
  productCode,
  portionCalories,
  readFoodProduct,
} from "../apps/web/lib/barcode";
it("accepts GTIN checksums and supported product QR URLs", () => {
  expect(productCode("3017620422003")).toBe("3017620422003");
  expect(
    productCode(
      "https://world.openfoodfacts.org/product/3017620422003/nutella",
    ),
  ).toBe("3017620422003");
  expect(productCode("https://id.gs1.org/01/03017620422003")).toBe(
    "03017620422003",
  );
});
it("rejects malformed checksums and arbitrary QR destinations", () => {
  for (const code of [
    "3017620422004",
    "123",
    "https://evil.test/3017620422003",
    "http://world.openfoodfacts.org/product/3017620422003",
    "javascript:alert(1)",
  ])
    expect(productCode(code)).toBeNull();
});
it("scales portion calories including zero-calorie foods", () => {
  expect(portionCalories(539, 15)).toBe(81);
  expect(portionCalories(0, 250)).toBe(0);
  expect(portionCalories(42, 330)).toBe(139);
});
it("reads current nutrition schema with matching serving units", () => {
  const product = readFoodProduct("3017620422003", {
    status: "success",
    product: {
      product_name: "Nutella",
      nutrition: {
        aggregated_set: {
          per: "100g",
          preparation: "as_sold",
          nutrients: {
            "energy-kcal": { value: 539, unit: "kcal", source: "manufacturer" },
          },
        },
        input_sets: [
          {
            per: "serving",
            preparation: "as_sold",
            per_quantity: 15,
            per_unit: "g",
          },
        ],
      },
    },
  });
  expect(product).toMatchObject({
    caloriesPer100: 539,
    unit: "g",
    serving: 15,
  });
});
it("converts kJ and preserves explicit zero", () => {
  expect(
    readFoodProduct("x", {
      status: 1,
      product: { nutriments: { energy_100g: 418.4 } },
    })?.caloriesPer100,
  ).toBe(100);
  expect(
    readFoodProduct("x", {
      status: 1,
      product: { nutriments: { "energy-kcal_100g": 0 } },
    })?.caloriesPer100,
  ).toBe(0);
});
it("does not substitute estimated or prepared nutrition for package values", () => {
  for (const aggregate of [
    {
      per: "serving",
      preparation: "as_sold",
      nutrients: { "energy-kcal": { value: 50, unit: "kcal" } },
    },
    {
      per: "100g",
      preparation: "prepared",
      nutrients: { "energy-kcal": { value: 50, unit: "kcal" } },
    },
    {
      per: "100g",
      preparation: "as_sold",
      nutrients: {
        "energy-kcal": { value: 50, unit: "kcal", source: "estimate" },
      },
    },
  ])
    expect(
      readFoodProduct("x", {
        status: "success",
        product: { nutrition: { aggregated_set: aggregate } },
      }),
    ).toBeNull();
});
