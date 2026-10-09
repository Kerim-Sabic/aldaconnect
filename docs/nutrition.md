# Calorie diary and barcode lookup

Members can enter a meal name, calories and portion; reuse recent meals; navigate daily history; view a seven-day chart; and add water in 250 ml increments. Totals use the device calendar day. Old entries without calories remain explicitly uncounted. No calorie target is invented.

Meals use the existing authorized diary action: kind `meal`, readable label, value in kcal. Water uses ml. Local and Supabase storage already support these fields; no migration is required. Both server paths validate bounded inputs.

## Packaged food

The user opens the camera and grants browser permission. ZXing reads EAN/UPC, GTIN and QR codes locally. Supported QR content includes a numeric GTIN, an Open Food Facts product URL or a GS1 Digital Link with a GTIN. Check digits and code lengths are validated. Arbitrary QR destinations are never visited. A barcode identifies a product; nutrition is looked up in Open Food Facts, rather than embedded in the barcode itself.

Only the product code is sent to the server and Open Food Facts. Camera frames stay on the device; closing the scanner stops its tracks. The camera reader loads on demand. A typed barcode provides a camera-free fallback. No OpenAI key, photo upload or AI food estimation is used.

The authenticated `/api/nutrition/product` endpoint rejects experts, previews and other-member contexts. It calls a fixed provider host with a timeout, validates nutrition, and returns private no-store responses. Public product records use a bounded in-process one-hour cache. Ten lookups per member per minute are allowed per process; this is not a shared serverless quota. Provider rate limits also apply. Synthetic local testing uses the provider staging host with its documented public staging credentials.

The current v3.6 nutrition schema is supported, including aggregate calories per 100 g/ml and compatible serving quantities. Declared kcal or kJ values are used, with explicit kJ conversion. Prepared-food data and estimated-only energy are not substituted for packaged values. Missing nutrition produces a manual-entry fallback. The user enters consumed grams/ml, reviews the calculated kcal and explicitly saves. Values can be edited manually before saving. Community data is attributed to Open Food Facts under ODbL and should be checked against the package.

## Verification

Unit tests cover dates, legacy entries, bounded diary inputs, code checksums/QR parsing, portion scaling, current nutrition schema, kJ conversion and missing/estimated nutrition. Endpoint tests cover authentication, roles, previews, caching, fixed host, throttling and failure fallback. Browser QA uses fictional localhost records and real staging product lookup. Physical iOS/Android camera scanning and installation remain device acceptance tasks.

References: [Open Food Facts API](https://openfoodfacts.github.io/openfoodfacts-server/api/), [schema changes](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-api-and-product-schema-change-log/), [ZXing browser](https://github.com/zxing-js/browser), [PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).
