// modals.js - retro-themed modal dialogs. All game popups go through here.
let host;
function ensureHost() {
  if (!host) {
    host = document.createElement("div");
    host.id = "modalHost";
    document.body.appendChild(host);
  }
  return host;
}

export function closeModal() {
  if (host) host.innerHTML = "";
}

// content: HTML string. buttons: [{label, cls, onClick}]
export function openModal({ title, content, buttons }) {
  ensureHost();
  const btns = (buttons || [{ label: "CLOSE", onClick: closeModal }])
    .map((b, i) => `<button class="m-btn ${b.cls || ""}" data-i="${i}">${b.label}</button>`)
    .join("");
  host.innerHTML = `
    <div class="m-overlay">
      <div class="m-box">
        <div class="m-title">${title || ""}</div>
        <div class="m-content">${content || ""}</div>
        <div class="m-actions">${btns}</div>
      </div>
    </div>`;
  const defs = buttons || [{ label: "CLOSE", onClick: closeModal }];
  host.querySelectorAll(".m-btn").forEach((el) => {
    el.onclick = () => {
      const def = defs[+el.dataset.i];
      if (def.onClick) def.onClick();
      if (!def.keepOpen) closeModal();
    };
  });
  // click outside to close
  host.querySelector(".m-overlay").onclick = (e) => {
    if (e.target.classList.contains("m-overlay")) closeModal();
  };
  return host.querySelector(".m-box");
}

export function infoModal(title, text) {
  openModal({ title, content: `<p class="m-text">${text}</p>` });
}

// Ask-your-own-question modal, returns the chosen value via callback
export function customQuestionModal(onSubmit) {
  openModal({
    title: "ASK YOUR OWN",
    content: `
      <p class="m-text">Pick an AWS fact for the court to judge:</p>
      <div class="m-radios">
        <label><input type="radio" name="cq" value="quota" checked> Lambda concurrency quota</label>
        <label><input type="radio" name="cq" value="pricing"> t3.micro hourly price (us-east-1)</label>
        <label><input type="radio" name="cq" value="describe"> us-east-1 availability-zone count</label>
      </div>`,
    buttons: [
      { label: "CANCEL" },
      { label: "CHOOSE", cls: "ok", onClick: () => {
        const v = document.querySelector('input[name="cq"]:checked').value;
        onSubmit(v);
      } },
    ],
  });
}