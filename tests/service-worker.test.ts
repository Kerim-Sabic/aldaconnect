import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";
it("the installed app caches only its public offline page and bypasses private APIs", async () => {
  const handlers: Record<string, (event: any) => void> = {};
  const cached: string[] = [];
  const removed: string[] = [];
  let failNetwork = false;
  const offline = { page: "public offline page" };
  runInNewContext(readFileSync("apps/web/public/sw.js", "utf8"), {
    URL,
    self: { location: { origin: "https://aldaconnect.fit" }, addEventListener: (name: string, handler: any) => { handlers[name] = handler; }, skipWaiting() {}, clients: { claim: async () => {} } },
    caches: { open: async () => ({ add: async (url: string) => { cached.push(url); } }), keys: async () => ["fitness-public-v1", "unrelated-app"], delete: async (key: string) => { removed.push(key); }, match: async (url: string) => url === "/offline.html" ? offline : undefined },
    fetch: async () => { if (failNetwork) throw Error("offline"); return { page: "fresh server response" }; },
  });
  let pending: Promise<any> = Promise.resolve();
  handlers.install({ waitUntil: (p: Promise<any>) => { pending = p; } }); await pending;
  expect(cached).toEqual(["/offline.html"]);
  handlers.activate({ waitUntil: (p: Promise<any>) => { pending = p; } }); await pending;
  expect(removed).toEqual(["fitness-public-v1"]);
  for (const path of ["/api/workspace", "/api/labs", "/api/medications", "/api/release"]) {
    let intercepted = false;
    handlers.fetch({ request: { url: "https://aldaconnect.fit"+path, mode: "cors", method: "GET" }, respondWith() { intercepted = true; } });
    expect(intercepted).toBe(false);
  }
  const navigate = () => { handlers.fetch({ request: { url: "https://aldaconnect.fit/", mode: "navigate", method: "GET" }, respondWith: (p: Promise<any>) => { pending = p; } }); return pending; };
  expect(await navigate()).toEqual({ page: "fresh server response" });
  failNetwork = true; expect(await navigate()).toEqual(offline);
  expect(cached).toEqual(["/offline.html"]);
});
