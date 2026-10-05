// tournament.js - runs a tournament; shows errors on screen, never blanks silently.
import { api } from "./api.js";
import { mountBattle, battleControls } from "./battle.js";

const short = (m) => (m || "").split("/").pop().split(":")[0];

export async function startTournament(rootEl, cfg, onDone) {
  try {
    battleControls.reset();
    const B = mountBattle(rootEl);
    B.$("fact").textContent = "Preparing the court...";
    const results = [];

    if (cfg.mode === "replay") {
      let data;
      try { data = await api.dataset(); } catch (e) { B.$("fact").textContent = "No dataset to replay."; return; }
      const fights = (data && data.results) || [];
      // only duels that carry full transcripts can be animated
      const usable = fights.filter((f) => Array.isArray(f.turns) && f.turns.length);
      if (!usable.length) {
        B.$("fact").textContent = "This dataset has no transcripts to replay. Run a live tournament and download it.";
        return;
      }
      for (let i = 0; i < usable.length; i++) {
        if (battleControls.stopped) break;
        await B.runDuel(usable[i], i, usable.length);
        results.push(usable[i]);
      }
    } else {
      const plan = await api.plan(cfg);
      if (!plan || !plan.fights || !plan.fights.length) {
        B.$("fact").textContent = "No duels planned. Pick at least 2 models.";
        return;
      }
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

    const tally = B.tally;
    const names = [...new Set(results.map((r) => r.defender))];
    names.forEach((n) => { if (!(n in tally)) tally[n] = 0; });
    let champ = null, best = Infinity;
    for (const n of names) { if (tally[n] < best) { best = tally[n]; champ = n; } }
    if (champ) B.showChampion(champ, best);

    const record = {
      id: "t_" + Date.now(), ts: Date.now(), mode: cfg.mode,
      models: cfg.models || names, rounds: cfg.rounds, temperature: cfg.temperature,
      duels: results.length, champion: champ, tally
    };
    if (onDone) onDone({ record, results });
  } catch (err) {
    rootEl.innerHTML = '<pre style="color:#f55;font-size:18px;padding:30px;white-space:pre-wrap">BATTLE ERROR:\n' + (err && err.stack || err) + '</pre>';
  }
}