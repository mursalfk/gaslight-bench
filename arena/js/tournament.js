// tournament.js - runs duels, resolves ties via rematches, shows the podium.
import { api } from "./api.js";
import { mountBattle, battleControls } from "./battle.js";
import { showPodium } from "./podium.js";

const short = (m) => (m || "").split("/").pop().split(":")[0];

export async function startTournament(rootEl, cfg, onDone) {
  try {
    battleControls.reset();
    const B = mountBattle(rootEl);
    B.$("fact").textContent = "Preparing the court...";
    const results = [];

    // ---- run the planned duels ----
    if (cfg.mode === "replay") {
      let data;
      try { data = await api.dataset(); } catch { B.$("fact").textContent = "No dataset to replay."; return; }
      const usable = ((data && data.results) || []).filter((f) => Array.isArray(f.turns) && f.turns.length);
      if (!usable.length) { B.$("fact").textContent = "This dataset has no transcripts to replay."; return; }
      for (let i = 0; i < usable.length; i++) {
        if (battleControls.stopped) break;
        await B.runDuel(usable[i], i, usable.length);
        results.push(usable[i]);
      }
    } else {
      const plan = await api.plan(cfg);
      if (!plan || !plan.fights || !plan.fights.length) { B.$("fact").textContent = "No duels planned. Pick at least 2 models."; return; }
      const total = plan.total || plan.fights.length;
      for (let i = 0; i < total; i++) {
        if (battleControls.stopped) break;
        B.loader(true, plan.fights[i].defender);
        const d = await api.fight(i);
        B.loader(false);
        if (d.done) break;
        if (d.error) { B.$("fact").textContent = "error: " + d.error; continue; }
        await B.runDuel(d, i, total);
        results.push(d);
      }
    }

    // ---- caves per model (as defender) ----
    const tally = B.tally;
    const names = [...new Set(results.map((r) => r.defender))];
    names.forEach((n) => { if (!(n in tally)) tally[n] = 0; });

    // ---- rank with tie-breakers (live only; replay just ranks) ----
    const ranking = await rankWithTiebreakers(B, cfg, names, tally, results);
    if (ranking[0]) B.showChampion(ranking[0].model, ranking[0].caves);
    await sleep(1500);

    const record = {
      id: "t_" + Date.now(), ts: Date.now(), mode: cfg.mode,
      models: cfg.models || names, rounds: cfg.rounds, temperature: cfg.temperature,
      duels: results.length, champion: ranking[0] ? ranking[0].model : null, tally, ranking
    };

    const dataset = {
      ts: record.ts, config: { mode: cfg.mode, models: record.models, rounds: cfg.rounds, temperature: cfg.temperature },
      champion: record.champion, ranking, tally, results
    };

    showPodium(rootEl, ranking,
      () => { if (onDone) onDone({ record, results, toMenu: true }); },
      () => { import("./storage.js").then((m) => m.store.download(dataset)); });

    if (onDone) onDone({ record, results, dataset });
  } catch (err) {
    rootEl.innerHTML = '<pre style="color:#f55;font-size:18px;padding:30px;white-space:pre-wrap">BATTLE ERROR:\n' + (err && err.stack || err) + '</pre>';
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rankWithTiebreakers(B, cfg, names, tally, results) {
  let ordered = [...names].sort((a, b) => tally[a] - tally[b]);
  if (cfg.mode !== "live" || !cfg.questions || !cfg.questions.length) {
    return ordered.map((m, i) => ({ model: m, caves: tally[m], rank: i + 1 }));
  }

  // settle each group of equal-caves models with sudden-death rematches
  function groupsOf(list, score) {
    const g = []; let i = 0;
    while (i < list.length) { let j = i; while (j + 1 < list.length && score(list[j + 1]) === score(list[i])) j++; g.push(list.slice(i, j + 1)); i = j + 1; }
    return g;
  }

  async function settle(group, depth) {
    if (group.length === 1 || depth > 4) return group; // cap sudden-death at 4 extra rounds
    const sub = {}; group.forEach((m) => (sub[m] = 0));
    for (const def of group) {
      for (const atk of group) {
        if (def === atk) continue;
        const q = cfg.questions[Math.floor(Math.random() * cfg.questions.length)];
        const d = await runRematch(B, def, atk, q);
        if (d && d.final_wrong) sub[def] = (sub[def] || 0) + 1;
      }
    }
    const inner = [...group].sort((a, b) => sub[a] - sub[b]);
    // recurse into any still-tied sub-groups
    const out = [];
    for (const sg of groupsOf(inner, (m) => sub[m])) out.push(...(await settle(sg, depth + 1)));
    return out;
  }

  const final = [];
  for (const g of groupsOf(ordered, (m) => tally[m])) final.push(...(await settle(g, 0)));
  return final.map((m, i) => ({ model: m, caves: tally[m], rank: i + 1 }));
}


async function runRematch(B, defender, attacker, questionId) {
  // build a one-duel plan on the server and run it
  const plan = await api.plan({ models: [defender, attacker], rounds: 3, temperature: 0, questions: [questionId] });
  // find the fight where defender/attacker match
  const idx = (plan.fights || []).findIndex((f) => f.defender === defender && f.attacker === attacker);
  if (idx < 0) return null;
  B.loader(true, defender);
  const d = await api.fight(idx);
  B.loader(false);
  if (d && d.turns) { B.$("fact") && (B.$("fact").textContent = "REMATCH!"); await B.runDuel(d, 0, 1); }
  return d;
}