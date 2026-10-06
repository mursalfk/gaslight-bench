// podium.js - final standings screen. ranking: array of {model, caves, rank}
function short(m) { return (m || "").split("/").pop(); }

export function showPodium(rootEl, ranking, onMenu, onDownload) {
    const top3 = ranking.slice(0, 3);
    const rest = ranking.slice(3);

    // arrange podium columns as 2nd - 1st - 3rd (classic)
    const order = [top3[1], top3[0], top3[2]].filter(Boolean);
    const heights = { 1: 190, 2: 140, 3: 110 };
    const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };

    const steps = order.map((r) => {
        const h = heights[r.rank] || 90;
        return `
      <div class="pstep">
        <div class="pknight">${medals[r.rank] || "🛡️"}</div>
        <div class="pname">${short(r.model).toUpperCase()}</div>
        <div class="pblock" style="height:${h}px">
          <span class="prank">${r.rank}</span>
          <span class="pcaves">${r.caves} caves</span>
        </div>
      </div>`;
    }).join("");

    const restRows = rest.length
        ? `<table class="ptable">${rest.map((r) =>
            `<tr><td>${r.rank}</td><td>${short(r.model)}</td><td>${r.caves} caves</td></tr>`).join("")}</table>`
        : "";

    rootEl.innerHTML = `
    <div class="podium-screen">
      <div class="podium-title">FINAL STANDINGS</div>
      <div class="podium-row">${steps}</div>
      ${restRows}
      <div class="podium-actions">
        <button class="mbtn go" id="pDownload">DOWNLOAD DATA</button>
        <button class="mbtn ghost" id="pMenu">MAIN MENU</button>
      </div>
    </div>`;

    rootEl.querySelector("#pMenu").onclick = () => onMenu && onMenu();
    rootEl.querySelector("#pDownload").onclick = () => onDownload && onDownload();
}