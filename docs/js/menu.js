// menu.js - main menu. Collects a valid tournament config, then calls onBegin(cfg).
import { api } from "./api.js";
import { store } from "./storage.js";
import { infoModal, openModal } from "./modals.js";

const ROUNDS_INFO = "A 'round' is one push-back from the deceiver. More rounds = more pressure on the defender, so a weak model has more chances to cave. 3 is a good default.";
const TEMP_INFO = "Temperature controls how random a model's replies are. 0 = steady/deterministic (fairest test). Higher = more erratic, which can make a model wobble.";

const PREDEFINED = [
  { id: "quota", label: "Lambda concurrency quota" },
  { id: "pricing", label: "t3.micro hourly price (us-east-1)" },
  { id: "describe", label: "us-east-1 availability-zone count" },
  { id: "regions", label: "Enabled AWS regions count" },
  { id: "vcpu", label: "t3.micro vCPU count" },
  { id: "s3quota", label: "S3 buckets per account" },
];

export async function renderMenu(rootEl, onBegin) {
  const models = (await api.models()) || [];
  const haveModels = models.length > 0;
  rootEl.innerHTML = `
    <div class="menu-screen">
      <div class="menu-logo">COURT OF FACTS</div>
      <div class="menu-sub">AWS EDITION</div>
      <div class="menu-grid">
        <section class="mcard"><h3>MODE</h3>
          <label class="radio"><input type="radio" name="mode" value="live" checked> Live Battle</label>
          <label class="radio"><input type="radio" name="mode" value="replay"> Watch Replay</label>
        </section>
        <section class="mcard"><h3>QUESTIONS (pick 1+)</h3>
          ${PREDEFINED.map((q, i) => `<label class="chk"><input type="checkbox" name="question" value="${q.id}" ${i === 0 ? "checked" : ""}> ${q.label}</label>`).join("")}
        </section>
        <section class="mcard"><h3>ROUNDS <button class="info" data-info="rounds">i</button></h3>
          <div class="stepper"><button class="step" data-d="-1">&#9664;</button><span id="roundsVal">3</span><button class="step" data-d="1">&#9654;</button></div>
        </section>
        <section class="mcard"><h3>TEMPERATURE <button class="info" data-info="temp">i</button></h3>
          <input type="range" id="temp" min="0" max="10" value="0" step="1"><div class="tempval">0.0</div>
        </section>
        <section class="mcard wide"><h3>CHAMPIONS (pick at least 2)</h3>
          <div class="models" id="models">${haveModels ? models.map((m) => `<label class="chk"><input type="checkbox" value="${m}"> ${short(m)}</label>`).join("") : `<p class="warn">No local models found. Start Ollama, or use Watch Replay.</p>`}</div>
        </section>
      </div>
      <div class="menu-actions">
        <button id="historyBtn" class="mbtn ghost">HISTORY</button>
        <button id="beginBtn" class="mbtn go" disabled>BEGIN TOURNAMENT</button>
        <button id="exitBtn" class="mbtn ghost">EXIT</button>
      </div>
      <div class="menu-hint" id="hint">Pick at least one question and two champions.</div>
    </div>`;

  rootEl.querySelectorAll(".info").forEach((b) => { b.onclick = () => b.dataset.info === "rounds" ? infoModal("ROUNDS", ROUNDS_INFO) : infoModal("TEMPERATURE", TEMP_INFO); });
  let rounds = 3;
  rootEl.querySelectorAll(".step").forEach((b) => { b.onclick = () => { rounds = Math.min(6, Math.max(1, rounds + (+b.dataset.d))); rootEl.querySelector("#roundsVal").textContent = rounds; }; });
  const temp = rootEl.querySelector("#temp"), tempval = rootEl.querySelector(".tempval");
  temp.oninput = () => { tempval.textContent = (temp.value / 10).toFixed(1); validate(); };
  const beginBtn = rootEl.querySelector("#beginBtn"), hint = rootEl.querySelector("#hint");
  const chosenModels = () => [...rootEl.querySelectorAll('#models input:checked')].map((c) => c.value);
  const chosenQuestions = () => [...rootEl.querySelectorAll('input[name="question"]:checked')].map((c) => c.value);
  function validate() {
    const mode = rootEl.querySelector('input[name="mode"]:checked').value;
    const qs = chosenQuestions(), ms = chosenModels();
    let ok = true, msg = "Ready. Begin the tournament!";
    if (!qs.length) { ok = false; msg = "Pick at least one question."; }
    if (mode === "live" && ms.length < 2) { ok = false; msg = "Pick at least two champions for a live battle."; }
    beginBtn.disabled = !ok; hint.textContent = msg;
  }
  rootEl.addEventListener("change", validate); validate();
  rootEl.querySelector("#historyBtn").onclick = () => showHistory();
  rootEl.querySelector("#exitBtn").onclick = () => infoModal("FARE THEE WELL", "Close the tab to exit the court.");
  beginBtn.onclick = () => onBegin({ mode: rootEl.querySelector('input[name="mode"]:checked').value, questions: chosenQuestions(), rounds, temperature: +temp.value / 10, models: chosenModels() });
}

async function showHistory() {
  const items = await store.history();
  const body = items.length ? `<table class="htable"><tr><th>When</th><th>Champion</th><th>Models</th><th>Duels</th></tr>` + items.map((it) => `<tr><td>${new Date(it.ts).toLocaleString()}</td><td>${short(it.champion || "-")}</td><td>${(it.models || []).map(short).join(", ")}</td><td>${it.duels}</td></tr>`).join("") + `</table>` : `<p class="m-text">No tournaments yet.</p>`;
  openModal({ title: "TOURNAMENT HISTORY", content: body });
}
function short(m) { return (m || "").split("/").pop().split(":")[0]; }