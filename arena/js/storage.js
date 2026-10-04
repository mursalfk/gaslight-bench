// storage.js - tournament history (localStorage, plus server when local) and dataset download.
import { api } from "./api.js";

const KEY = "cof_history_v1";

function localItems() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}
function setLocal(items) {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 50)));
}

export const store = {
  async history() {
    const local = localItems();
    const server = await api.loadHistory();
    if (!server) return local;
    // merge by id, server wins
    const map = {};
    [...local, ...server].forEach((it) => { map[it.id] = it; });
    return Object.values(map).sort((a, b) => b.ts - a.ts);
  },

  async save(record) {
    const items = localItems();
    items.unshift(record);
    setLocal(items);
    await api.saveHistory(record); // best effort; ignored on static deploy
  },

  download(dataset, filename = "court-of-facts-dataset.json") {
    const blob = new Blob([JSON.stringify(dataset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  },
};