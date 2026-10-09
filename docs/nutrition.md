# Calorie diary and shared barcode catalog

Members enter a meal and calories, reuse recent meals, navigate daily history, view a seven-day chart and add water in 250 ml increments. Totals follow the device calendar day. Old entries without calories remain uncounted. No calorie target is invented. Diary values are private and use the existing authorized meal/water actions with bounded server validation.

## Scanning and lookup

The on-demand camera scanner prefers the browser's native BarcodeDetector for supported EAN/UPC formats, with constrained ZXing decoding as the fallback. It checks sequential frames about every 150 ms without overlapping native detection. Compatible rear cameras request continuous focus and offer a torch. A local photograph can also be decoded, and typed barcodes remain available. Physical device support varies. Cleanup stops media tracks and cancels pending scanning; late photograph results cannot select a product after the scanner closes.

EAN-8, UPC-A/E, EAN-13, GTIN-14, GS1 data and product QR codes are supported with checksum/length validation. QR content must carry a numeric GTIN, an Open Food Facts product URL or a GS1 Digital Link; arbitrary URLs are never followed. A barcode identifies a product; nutrition comes from a label database. Camera images stay on device. There is no photo upload, OpenAI dependency or inferred nutrition.

The authenticated no-store `/api/nutrition/product` route first queries the shared catalog with a dedicated session-checked RPC, avoiding a full private workspace snapshot. Shared hits return immediately and take precedence over cached external data. Otherwise the fixed Open Food Facts host is queried within an eight-second total deadline, with equivalent UPC/EAN aliases and a bounded one-hour in-process positive cache. External lookups are limited to ten per member/minute and fourteen provider requests/minute/process; these are not shared serverless quotas. Query-supplied delegated/preview contexts are rejected. The dedicated food name search merges shared declarations ahead of Open Food Facts results and falls back to available shared matches if the provider fails.

Open Food Facts v3.6 aggregate calories per 100 g/ml, legacy declared energy, compatible portions and declared macros are supported. kJ is explicitly converted to kcal. Prepared-food data and estimated-only energy are not substituted. Missing nutrition keeps manual entry and the shared declaration form available. External data is attributed under ODbL; users review the package and the entered portion before saving.

## Shared declarations

`/api/nutrition/foods` lists/searches the shared catalog, retrieves a barcode and accepts validated save/report/moderate actions. New declarations require name, kcal, proteins, carbohydrates and fat per 100 g/ml. Sugar, fiber, saturated fat, salt, serving/package quantities, ingredients, allergens and notes are optional. Optional missing values remain null; zero values are retained. Server and database checks bound input and validate sugar/carbohydrate and saturated/total-fat relationships.

Database migrations create unexposed `food_private.products` and `food_private.reports`. RLS is enabled with direct API table privileges revoked. A public security-invoker wrapper calls a private security-definer dispatcher that verifies a hashed, unexpired username session or verified Supabase identity. Every operation is authorized independently; only clients/admins can save. GTINs normalize to fourteen digits so equivalent UPC/EAN forms share one record. Creation is limited persistently to twenty products per account/day, serialized per account. Existing unique barcodes cannot be overwritten by another member. Edits require ownership/admin and the current version; application conflicts return HTTP 409 without database serialization retries.

Products are available to all signed-in users immediately after saving. They are labeled community declarations, not verified nutrition. Author identities and diary records are not exposed. Creators can correct their own labels; other members can report problems. The admin sees report reasons and can hide/restore products or correct labels. Existing device-only declarations remain an account-local fallback and are not automatically published.

## Verification boundaries

Unit and database tests cover checksums, QR parsing, UPC-E expansion, nutrient parsing, bounded inputs, portion scaling, cache precedence, cross-account lookup, aliases, ownership, stale edits, report/moderation, hidden records, direct-table denial and unauthenticated denial. Real API/browser QA covers shared create/read, member form edits, selected-portion diary saving and error states. Remote catalog database lint passes. Physical iOS/Android camera, torch and home-screen installation remain device acceptance tasks.

References: [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/), [schema changes](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-api-and-product-schema-change-log/), [ZXing browser](https://github.com/zxing-js/browser), [BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector), [Supabase functions](https://supabase.com/docs/guides/database/functions).
