// api.js - server talk + static-deploy fallback.
// Local server: /plan /fight /ask /models /history /dataset.json
// Static deploy (GitHub Pages/Netlify): no server -> replay only, from ./data/dataset.json
// Live mode needs the local Python server. Treat ANYTHING that is not localhost/127.0.0.1 as static.
export const IS_STATIC = !/^(localhost|127\.0\.0\.1)$/.test(location.hostname);
export const ASSET = (name) => `./assets/${name}`;

async function post(path, body) {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  return r.json();
}
async function get(path) { const r = await fetch(path); if (!r.ok) throw new Error(path + " -> " + r.status); return r.json(); }

async function bundledDataset() {
  // shipped with a static build; used when no live server
  const r = await fetch("./data/dataset.json");
  if (!r.ok) throw new Error("no bundled dataset");
  return r.json();
}

export const api = {
  async models() {
    try { return (await get("/models")).models; }
    catch {
      // static: derive model list from bundled dataset
      try { const d = await bundledDataset(); return [...new Set(d.results.map(x => x.defender))]; }
      catch { return null; }
    }
  },
  async plan(cfg) { return post("/plan", cfg); },
  async fight(index) { return post("/fight", { index }); },
  async ask(domain) { return post("/ask", { domain }); },
  async dataset() {
    try { return await get("/dataset.json"); }
    catch { return bundledDataset(); }
  },
  async saveHistory(record) { try { return await post("/history", record); } catch { return null; } },
  async loadHistory() { try { return (await get("/history")).items || []; } catch { return null; } },
};