// battle.js - the arena screen: renders the scene, animates one duel, exposes controls.
// Pause/Stop (#2) via a control object; tab-switch does NOT desync because timing is
// driven by awaited sleeps that we gate on a paused flag and re-check on visibility (#3).
import { openModal } from "./modals.js";

const short = (m) => (m || "").split("/").pop().split(":")[0];

// ---- controllable, visibility-safe sleep ----
const ctrl = { paused: false, stopped: false };
function sleep(ms) {
    return new Promise((resolve) => {
        const start = Date.now();
        (function tick() {
            if (ctrl.stopped) return resolve();
            if (ctrl.paused) return setTimeout(tick, 120);
            const left = ms - (Date.now() - start);
            if (left <= 0) return resolve();
            setTimeout(tick, Math.min(left, 120)); // short hops so background-tab throttle can't overshoot
        })();
    });
}
export const battleControls = {
    pause() { ctrl.paused = true; },
    resume() { ctrl.paused = false; },
    toggle() { ctrl.paused = !ctrl.paused; return ctrl.paused; },
    stop() { ctrl.stopped = true; ctrl.paused = false; },
    reset() { ctrl.paused = false; ctrl.stopped = false; },
    get stopped() { return ctrl.stopped; },
    get paused() { return ctrl.paused; },
};

export function mountBattle(rootEl) {
    rootEl.innerHTML = `
    <div class="stage" id="stage">
      <img class="bg" src="./assets/bg.png" alt=""/>
      <img class="layer crowdMe" id="crowdMe" src="./assets/crowd_blue.png"/>
      <img class="layer crowdFoe" id="crowdFoe" src="./assets/crowd_green.png"/>
      <img class="layer king" id="king" src="./assets/king.png"/>
      <img class="layer trophy" id="trophy" src="./assets/trophy.png"/>
      <img class="layer meKnight" id="meKnight" src="./assets/knight_blue.png"/>
      <img class="layer foeKnight" id="foeKnight" src="./assets/knight_green.png"/>
      <div class="knightName meKN" id="meKN">DEFENDER</div>
      <div class="knightName foeKN" id="foeKN">DECEIVER</div>
      <div class="championTag" id="championTag"></div>
      <div class="fact" id="fact"></div>
      <div class="hpwrap me"><div class="plate"><div class="nm"><span id="meName">DEFENDER</span><span>HP</span></div><div class="hpbar"><span id="meHp"></span></div><div class="hpnum" id="meHpNum">100/100</div></div></div>
      <div class="hpwrap foe"><div class="plate"><div class="nm"><span id="foeName">DECEIVER</span><span>LIE</span></div><div class="hpbar"><span id="foeHp" style="background:#c0533f"></span></div></div></div>
      <div class="flash" id="flash"></div>
      <div class="verdict" id="verdict"></div>
      <div class="dbox"><span class="spk" id="spk">HERALD</span><span id="dtext"></span><span class="cursor" id="cursor">&#9662;</span></div>
      <div class="loader" id="loader"><div class="spin" id="spinTxt">SUMMONING...</div><div class="bars" id="bars">&#9617;&#9617;&#9617;&#9617;&#9617;&#9617;</div></div>

      <button class="sbTab" id="sbTab">&#9776;</button>
      <aside class="sidebar" id="sidebar">
        <button class="sb" id="btnPause">&#10073;&#10073; PAUSE</button>
        <button class="sb" id="btnStop">&#9632; STOP</button>
        <button class="sb" id="btnLogs">&#9636; LOGS</button>
        <button class="sb" id="btnTally">&#9733; TALLY</button>
        <div class="prog" id="prog"></div>
      </aside>
    </div>`;

    const $ = (id) => rootEl.querySelector("#" + id);
    const logs = [];       // {cls, who, text}
    const tally = {};      // model -> caves

    // sidebar toggle
    $("sbTab").onclick = () => { const o = $("sidebar").classList.toggle("open"); $("sbTab").style.right = o ? "240px" : "0"; };    // pause / stop (#2)
    $("btnPause").onclick = () => { const p = battleControls.toggle(); $("btnPause").innerHTML = p ? "&#9654; RESUME" : "&#10073;&#10073; PAUSE"; };
    $("btnStop").onclick = () => {
        openModal({
            title: "STOP TOURNAMENT?", content: `<p class="m-text">End the tournament now? Progress so far is kept.</p>`,
            buttons: [{ label: "KEEP GOING" }, { label: "STOP", cls: "ok", onClick: () => battleControls.stop() }]
        });
    };
    $("btnLogs").onclick = () => openModal({
        title: "DUEL LOGS", content: logs.length
            ? `<div class="logbox">${logs.map((l) => `<div class="logline ${l.cls}"><span class="who">${l.who}</span>${l.text}</div>`).join("")}</div>`
            : `<p class="m-text">No logs yet.</p>`
    });
    $("btnTally").onclick = () => openModal({
        title: "CAVES BY MODEL", content: Object.keys(tally).length
            ? `<div class="logbox">${Object.entries(tally).map(([m, c]) => `<div class="tallyRow"><span>${short(m)}</span><b>${c} caves</b></div>`).join("")}</div>`
            : `<p class="m-text">No caves yet.</p>`
    });

    // #3: when the tab returns, nudge a repaint (timing already safe via sleep()).
    document.addEventListener("visibilitychange", () => { if (!document.hidden) $("fact") && void $("fact").offsetWidth; });

    // ---- animation helpers ----
    function logLine(cls, who, text) { logs.unshift({ cls, who, text }); }
    function setHP(p) { const s = $("meHp"); s.style.width = Math.max(0, p) + "%"; s.style.background = p > 50 ? "#36c43a" : p > 20 ? "#e0b020" : "#c0533f"; $("meHpNum").textContent = Math.max(0, Math.round(p)) + "/100"; }
    function setFoeHP(p) { $("foeHp").style.width = Math.max(0, p) + "%"; }
    async function type(spk, text) { $("spk").textContent = spk; $("dtext").textContent = ""; $("cursor").style.display = "none"; for (let i = 0; i < text.length; i++) { if (ctrl.stopped) break; $("dtext").textContent += text[i]; if (i % 2 === 0) await sleep(10); } $("cursor").style.display = "inline-block"; }
    function dmg(n) { const d = document.createElement("div"); d.className = "dmg"; d.textContent = "-" + n; d.style.left = "18%"; d.style.top = "45%"; $("stage").appendChild(d); setTimeout(() => d.remove(), 1100); }
    function attack(who) { const k = who === "attacker" ? $("foeKnight") : $("meKnight"); k.classList.add("attack"); setTimeout(() => k.classList.remove("attack"), 240); }
    function hit() { $("meKnight").classList.add("hit"); setTimeout(() => $("meKnight").classList.remove("hit"), 400); $("flash").classList.add("go"); setTimeout(() => $("flash").classList.remove("go"), 500); }
    function cheer(side) { const c = $(side === "me" ? "crowdMe" : "crowdFoe"); c.classList.add("cheer"); setTimeout(() => c.classList.remove("cheer"), 1000); }
    function kingReact() { $("king").classList.add("react"); setTimeout(() => $("king").classList.remove("react"), 500); }

    async function runDuel(d, idx, total) {
        if (ctrl.stopped) return;
        $("prog").textContent = `DUEL ${idx + 1}/${total}`;
        $("meName").textContent = $("meKN").textContent = short(d.defender).toUpperCase();
        $("foeName").textContent = $("foeKN").textContent = short(d.attacker).toUpperCase();
        $("fact").textContent = `"${d.question}"  (truth: ${d.truth})`;
        $("verdict").className = "verdict"; $("verdict").textContent = ""; setHP(100); setFoeHP(100);
        logLine("verdict", "NEW DUEL", `${short(d.defender)} vs ${short(d.attacker)} — ${d.domain || ""}`);
        await type("HERALD", `Sir ${short(d.defender).toUpperCase()} must defend the truth: ${d.truth}!`); await sleep(700);
        let hp = 100, rounds = 0;
        for (const t of d.turns) {
            if (ctrl.stopped) return;
            logLine(t.who, t.who === "defender" ? short(d.defender) : short(d.attacker), t.text);
            if (t.who === "attacker") { attack("attacker"); await type(short(d.attacker).toUpperCase() + " STRIKES!", t.text); await sleep(400); hit(); dmg(18 + Math.floor(Math.random() * 10)); cheer("foe"); }
            else { rounds++; await type(short(d.defender).toUpperCase(), t.text); if (t.caved) { hp = 8; setHP(hp); hit(); dmg(60); } else { hp = Math.max(55, 100 - (rounds - 1) * 10); setHP(hp); attack("defender"); cheer("me"); } }
            await sleep(t.who === "attacker" ? 900 : 1200);
        }
        if (ctrl.stopped) return;
        kingReact(); $("flash").classList.add("go");
        if (d.final_wrong) {
            tally[d.defender] = (tally[d.defender] || 0) + 1; setHP(0); $("verdict").textContent = "DECEIVED!"; $("verdict").className = "verdict bad show"; cheer("foe");
            await type("AWS, THE KING", `Sir ${short(d.defender).toUpperCase()} was deceived! The truth was ${d.truth}.`); logLine("verdict", "DECREE", `${short(d.defender)} CAVED`);
        }
        else {
            setFoeHP(0); $("verdict").textContent = "VICTORY!"; $("verdict").className = "verdict good show"; cheer("me");
            await type("AWS, THE KING", `Sir ${short(d.defender).toUpperCase()} held true!`); logLine("verdict", "DECREE", `${short(d.defender)} HELD`);
        }
        await sleep(2000);
    }

    function showChampion(name, caves) {
        $("verdict").className = "verdict good show"; $("verdict").textContent = "CHAMPION";
        $("championTag").textContent = `${short(name).toUpperCase()}  (${caves} caves)`;
        $("championTag").classList.add("show");
        $("trophy").classList.add("beside");   // trophy at champion's side (#8), end only (#6)
        cheer("me"); cheer("foe"); kingReact();
    }
    function loader(on, model) { if (on) { $("spinTxt").textContent = "SUMMONING " + short(model).toUpperCase() + "..."; $("loader").classList.add("show"); } else $("loader").classList.remove("show"); }

    return { runDuel, showChampion, loader, tally, logs, $ };
}