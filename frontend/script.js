/**
 * Smart Grain Storage Monitor — script.js v3
 * Pure vanilla JavaScript. No frameworks.
 *
 * Architecture:
 *  - CONFIG: API URL + poll interval
 *  - DEMO: self-contained simulated data ticker
 *  - applyStatus() / applyReadings() / applyHealth(): UI renderers
 *  - ChartDraw: canvas distance-history chart
 *  - Poller: setInterval-based real API fetch loop
 */
"use strict";

/* ════════════════════════════════════════════════════════════
   CONFIG
   ════════════════════════════════════════════════════════════ */
const CONFIG = {
  API_BASE_URL:     "http://localhost:8000",
  POLL_INTERVAL_MS: 5000,
  MAX_CHART_POINTS: 20,
  MAX_TABLE_ROWS:   20,
};

/* ════════════════════════════════════════════════════════════
   DOM refs — keyed by stable IDs
   ════════════════════════════════════════════════════════════ */
const $  = id => document.getElementById(id);

const D = {
  // Demo banner
  demoBanner:      $("demo-banner"),
  btnDisableDemo:  $("btn-disable-demo"),
  btnToggleDemo:   $("btn-toggle-demo"),

  // Topbar
  liveClock:    $("live-clock"),
  connDot:      $("conn-dot"),
  connLabel:    $("conn-label"),
  btnRefresh:   $("btn-refresh"),

  // Sidebar
  apiStatusDot:  $("api-status-dot"),
  deviceConn:    $("device-conn-indicator"),
  sidebarDevice: $("sidebar-device-id"),

  // KPI cards
  valDistance: $("val-distance"),
  valFill:     $("val-fill"),
  valStatus:   $("val-status"),
  valUptime:   $("val-uptime"),
  kpiBarFill:  $("kpi-bar-fill"),

  // Silo
  siloGrain:    $("silo-grain"),
  siloBeam:     $("silo-beam"),
  siloPctBadge: $("silo-pct-badge"),
  chipHeight:   $("chip-height"),
  chipThresh:   $("chip-threshold"),
  grainCanvas:  $("grain-canvas"),

  // Silo stats col
  sstatDistance: $("sstat-distance"),
  sstatDepth:    $("sstat-depth"),
  sstatFill:     $("sstat-fill"),
  sstatStatus:   $("sstat-status"),
  sstatTime:     $("sstat-time"),

  // LEDs
  ledRedOrb:        $("led-red-orb"),
  ledRedHalo:       $("led-red-halo"),
  ledRedStatePill:  $("led-red-state-pill"),
  ledGreenOrb:      $("led-green-orb"),
  ledGreenHalo:     $("led-green-halo"),
  ledGreenStatePill:$("led-green-state-pill"),

  // Chart & table
  historyChart:  $("history-chart"),
  readingsTbody: $("readings-tbody"),
  tableCount:    $("table-count"),
  btnRefreshTbl: $("btn-refresh-table"),
};

/* ════════════════════════════════════════════════════════════
   APPLICATION STATE
   ════════════════════════════════════════════════════════════ */
const STATE = {
  chartData:       [],   // {ts, distance_cm}
  tableReadings:   [],
  containerHeight: 100,
  lowThreshold:    25,
  pollerTimer:     null,
};

/* ════════════════════════════════════════════════════════════
   DEMO MODE
   ════════════════════════════════════════════════════════════ */
const DEMO = {
  active:     false,
  _ticker:    null,
  _distance:  40,
  _dir:       1,
  _idCounter: 9000,
  containerH: 100,
  lowThresh:  25,
  deviceId:   "DEMO-ESP32-01",
  tickMs:     2800,
};

function demoCalc(dist) {
  if (dist < 0) return { grain_status: "SENSOR ERROR", fill_pct: null, red_led: true, green_led: false };
  const grain = Math.max(0, Math.min(DEMO.containerH - dist, DEMO.containerH));
  const pct   = Math.round((grain / DEMO.containerH) * 1000) / 10;
  const low   = pct < DEMO.lowThresh;
  return { grain_status: low ? "LOW" : "NORMAL", fill_pct: pct, red_led: low, green_led: !low };
}

function demoTick() {
  DEMO._distance += DEMO._dir * (Math.random() * 2.5 + 0.5);
  if (DEMO._distance >= 88) DEMO._dir = -1;
  if (DEMO._distance <= 8)  DEMO._dir =  1;
  const dist = Math.round(DEMO._distance * 10) / 10;
  const c    = demoCalc(dist);
  const ts   = new Date().toISOString();

  applyStatus({
    device_id: DEMO.deviceId, distance_cm: dist,
    fill_pct: c.fill_pct, grain_status: c.grain_status,
    red_led: c.red_led, green_led: c.green_led,
    last_reading_ts: ts,
    container_height_cm: DEMO.containerH,
    low_threshold_pct:   DEMO.lowThresh,
  });
  applyHealth({ status: "ok", uptime_s: 0, _demo: true });

  const reading = { id: DEMO._idCounter++, device_id: DEMO.deviceId, distance_cm: dist,
    fill_pct: c.fill_pct, grain_status: c.grain_status,
    red_led: c.red_led, green_led: c.green_led, timestamp: ts };
  STATE.tableReadings.unshift(reading);
  if (STATE.tableReadings.length > CONFIG.MAX_TABLE_ROWS) STATE.tableReadings.pop();
  STATE.chartData.push({ ts, distance_cm: dist });
  if (STATE.chartData.length > CONFIG.MAX_CHART_POINTS) STATE.chartData.shift();

  renderTable(STATE.tableReadings);
  drawChart();
}

function startDemo() {
  DEMO.active = true;
  sessionStorage.setItem("demoMode", "1");
  D.demoBanner.classList.remove("hidden");
  D.btnToggleDemo.classList.add("active");
  setConnection("demo");
  STATE.chartData = []; STATE.tableReadings = [];
  demoTick();
  DEMO._ticker = setInterval(demoTick, DEMO.tickMs);
}

function stopDemo() {
  DEMO.active = false;
  sessionStorage.removeItem("demoMode");
  clearInterval(DEMO._ticker); DEMO._ticker = null;
  D.demoBanner.classList.add("hidden");
  D.btnToggleDemo.classList.remove("active");
  STATE.chartData = []; STATE.tableReadings = [];
  renderTable([]);
  drawChart();
  setConnection("disconnected");
  fetchAll();
}

/* ════════════════════════════════════════════════════════════
   CONNECTION STATE
   ════════════════════════════════════════════════════════════ */
function setConnection(state) {
  // state: "connected" | "disconnected" | "demo"
  const dot   = D.connDot;
  const label = D.connLabel;
  const dConn = D.deviceConn;
  const navDot = D.apiStatusDot;

  dot.className = "conn-dot " + state;
  if (state === "connected") {
    label.textContent = "API Connected";
    dConn && (dConn.className = "device-conn online");
    navDot && (navDot.style.background = "var(--gr-500)");
  } else if (state === "demo") {
    label.textContent = "Demo Mode";
    dConn && (dConn.className = "device-conn demo");
    navDot && (navDot.style.background = "var(--am-400)");
  } else {
    label.textContent = "API Offline";
    dConn && (dConn.className = "device-conn offline");
    navDot && (navDot.style.background = "var(--rd-500)");
  }
}

/* ════════════════════════════════════════════════════════════
   LIVE CLOCK
   ════════════════════════════════════════════════════════════ */
function tickClock() {
  if (!D.liveClock) return;
  const now = new Date();
  D.liveClock.textContent = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}
tickClock();
setInterval(tickClock, 1000);

/* ════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════ */
function fmtTs(iso) {
  if (!iso) return "Never";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
    });
  } catch { return iso; }
}
function fmtTsShort(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }); }
  catch { return ""; }
}
function esc(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function statusClass(s) {
  switch ((s || "").toUpperCase()) {
    case "NORMAL":       return "chip-normal";
    case "LOW":          return "chip-low";
    case "SENSOR ERROR": return "chip-error";
    default:             return "chip-nodata";
  }
}
function statusClassTable(s) {
  switch ((s || "").toUpperCase()) {
    case "NORMAL":       return "spill--normal";
    case "LOW":          return "spill--low";
    case "SENSOR ERROR": return "spill--error";
    default:             return "spill--nodata";
  }
}

/* ════════════════════════════════════════════════════════════
   GRAIN CANVAS — animated texture for grain body
   ════════════════════════════════════════════════════════════ */
let _grainAnimFrame = null;
function drawGrainTexture() {
  const canvas = D.grainCanvas;
  if (!canvas) return;
  const w = canvas.offsetWidth, h = canvas.offsetHeight;
  if (!w || !h) return;
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  for (let y = 0; y < h; y += 7) {
    ctx.fillStyle = y % 14 === 0 ? "rgba(0,0,0,0.07)" : "rgba(0,0,0,0.03)";
    ctx.fillRect(0, y, w, 1);
  }
  for (let x = 0; x < w; x += 12) {
    ctx.fillStyle = "rgba(0,0,0,0.04)";
    ctx.fillRect(x, 0, 1, h);
  }
}

/* ════════════════════════════════════════════════════════════
   UI: applyStatus
   ════════════════════════════════════════════════════════════ */
function applyStatus(data) {
  const contH   = data.container_height_cm || 100;
  const lowPct  = data.low_threshold_pct   || 25;
  STATE.containerHeight = contH;
  STATE.lowThreshold    = lowPct;

  // Sidebar / chips
  if (D.sidebarDevice) D.sidebarDevice.textContent = data.device_id || "—";
  if (D.chipHeight)    D.chipHeight.textContent     = `H: ${contH} cm`;
  if (D.chipThresh)    D.chipThresh.textContent     = `Low: ${lowPct}%`;

  // KPI values
  const distTxt = data.distance_cm != null ? data.distance_cm.toFixed(1) : "—";
  const fillTxt = data.fill_pct    != null ? data.fill_pct.toFixed(1)    : "—";
  if (D.valDistance) D.valDistance.textContent = distTxt;
  if (D.valFill)     D.valFill.textContent     = fillTxt;

  // KPI status chip
  const chipEl = D.valStatus;
  if (chipEl) {
    chipEl.textContent = data.grain_status || "NO DATA";
    chipEl.className   = "status-chip " + statusClass(data.grain_status);
  }

  // Fill bar
  const fillPct = data.fill_pct != null ? Math.max(0, Math.min(100, data.fill_pct)) : 0;
  if (D.kpiBarFill) {
    D.kpiBarFill.style.width = fillPct + "%";
    D.kpiBarFill.style.background = data.grain_status === "LOW"
      ? "linear-gradient(90deg, var(--rd-700,#7f1d1d), var(--rd-500,#ef4444))"
      : "linear-gradient(90deg, var(--gr-700), var(--gr-400))";
  }

  // Silo fill animation
  if (D.siloGrain) {
    D.siloGrain.style.height = fillPct + "%";
    drawGrainTexture();
  }
  if (D.siloPctBadge) {
    D.siloPctBadge.textContent = data.fill_pct != null ? fillPct.toFixed(1) + "%" : "—";
  }

  // Silo beam
  if (D.siloBeam && data.distance_cm != null && data.distance_cm > 0) {
    const siloH  = 300;
    const beamPx = Math.min(Math.round((data.distance_cm / contH) * siloH), siloH - 44);
    D.siloBeam.style.height = beamPx + "px";
    D.siloBeam.classList.add("active");
  } else if (D.siloBeam) {
    D.siloBeam.style.height = "0px";
    D.siloBeam.classList.remove("active");
  }

  // Silo stats col
  if (D.sstatDistance) D.sstatDistance.textContent = data.distance_cm != null ? data.distance_cm.toFixed(1) + " cm" : "— cm";
  if (D.sstatDepth) {
    const depth = data.fill_pct != null ? ((data.fill_pct / 100) * contH).toFixed(1) + " cm" : "— cm";
    D.sstatDepth.textContent = depth;
  }
  if (D.sstatFill)   D.sstatFill.textContent   = data.fill_pct != null ? fillPct.toFixed(1) + "%" : "—%";
  if (D.sstatStatus) D.sstatStatus.textContent = data.grain_status || "—";
  if (D.sstatTime)   D.sstatTime.textContent   = fmtTs(data.last_reading_ts);

  // LEDs
  setLED("red",   data.red_led);
  setLED("green", data.green_led);
}

function setLED(color, isOn) {
  const orb   = color === "red" ? D.ledRedOrb   : D.ledGreenOrb;
  const halo  = color === "red" ? D.ledRedHalo  : D.ledGreenHalo;
  const pill  = color === "red" ? D.ledRedStatePill : D.ledGreenStatePill;

  if (!orb) return;

  if (isOn) {
    orb.classList.add("led-on");
    halo && halo.classList.add("glow");
    if (pill) { pill.textContent = "ON"; pill.className = "led-state-pill on-" + color; }
  } else {
    orb.classList.remove("led-on");
    halo && halo.classList.remove("glow");
    if (pill) { pill.textContent = "OFF"; pill.className = "led-state-pill"; }
  }
}

/* ════════════════════════════════════════════════════════════
   UI: applyHealth
   ════════════════════════════════════════════════════════════ */
function applyHealth(h) {
  if (!D.valUptime) return;
  if (h._demo) { D.valUptime.textContent = "DEMO"; return; }
  const s = Math.round(h.uptime_s);
  D.valUptime.textContent = s < 60 ? `${s}s` : `${Math.floor(s/60)}m ${s%60}s`;
}

/* ════════════════════════════════════════════════════════════
   UI: renderTable
   ════════════════════════════════════════════════════════════ */
function renderTable(rows) {
  if (D.tableCount) D.tableCount.textContent = rows.length ? `${rows.length} records` : "No records";
  if (!rows || !rows.length) {
    D.readingsTbody.innerHTML = '<tr><td colspan="8" class="table-empty">No readings yet.</td></tr>';
    return;
  }
  D.readingsTbody.innerHTML = rows.map((r, i) => `
    <tr${i === 0 ? ' class="row-flash"' : ''}>
      <td class="mono-cell">${r.id}</td>
      <td class="mono-cell">${fmtTs(r.timestamp)}</td>
      <td class="mono-cell">${esc(r.device_id)}</td>
      <td class="mono-cell">${r.distance_cm != null ? r.distance_cm.toFixed(2) : "—"}</td>
      <td class="mono-cell">${r.fill_pct != null ? r.fill_pct.toFixed(1) + "%" : "—"}</td>
      <td><span class="spill ${statusClassTable(r.grain_status)}">${esc(r.grain_status)}</span></td>
      <td>${r.red_led   ? '<span class="tdot tdot--red"></span>'   : '<span class="tdot tdot--off"></span>'}</td>
      <td>${r.green_led ? '<span class="tdot tdot--green"></span>' : '<span class="tdot tdot--off"></span>'}</td>
    </tr>
  `).join("");
}

/* ════════════════════════════════════════════════════════════
   CANVAS CHART
   ════════════════════════════════════════════════════════════ */
function drawChart() {
  const canvas = D.historyChart;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth;
  const H   = canvas.offsetHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const PAD = { t: 16, r: 20, b: 30, l: 52 };
  const iW  = W - PAD.l - PAD.r;
  const iH  = H - PAD.t - PAD.b;

  ctx.clearRect(0, 0, W, H);

  const data = STATE.chartData;
  if (!data.length) {
    ctx.fillStyle = "rgba(148,163,184,0.3)";
    ctx.font = "13px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Waiting for data…", W / 2, H / 2);
    return;
  }

  const maxD  = Math.max(...data.map(d => d.distance_cm), STATE.containerHeight);
  const yMax  = Math.ceil(maxD * 1.12 / 10) * 10;
  const yMin  = 0;
  const n     = data.length;

  const xOf = i => PAD.l + (n === 1 ? iW / 2 : i * (iW / (n - 1)));
  const yOf = v => PAD.t + iH - ((v - yMin) / (yMax - yMin)) * iH;

  // Grid
  const gridLines = 5;
  for (let g = 0; g <= gridLines; g++) {
    const v = yMin + (g / gridLines) * (yMax - yMin);
    const y = yOf(v);
    ctx.beginPath();
    ctx.strokeStyle = "rgba(148,163,184,0.06)";
    ctx.lineWidth = 1;
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(PAD.l + iW, y);
    ctx.stroke();
    ctx.fillStyle = "rgba(148,163,184,0.35)";
    ctx.font = `600 9px 'JetBrains Mono', monospace`;
    ctx.textAlign = "right";
    ctx.fillText(Math.round(v), PAD.l - 8, y + 3.5);
  }

  // Threshold line
  const thDist = STATE.containerHeight * (1 - STATE.lowThreshold / 100);
  if (thDist >= yMin && thDist <= yMax) {
    const ty = yOf(thDist);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = "rgba(245,158,11,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(PAD.l, ty); ctx.lineTo(PAD.l + iW, ty); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(251,191,36,0.7)";
    ctx.font = "700 9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Low threshold", PAD.l + 6, ty - 5);
    ctx.restore();
  }

  // Area fill
  const grad = ctx.createLinearGradient(0, PAD.t, 0, PAD.t + iH);
  grad.addColorStop(0,   "rgba(34,197,94,0.20)");
  grad.addColorStop(0.6, "rgba(34,197,94,0.06)");
  grad.addColorStop(1,   "rgba(34,197,94,0)");
  ctx.beginPath();
  ctx.moveTo(xOf(0), yOf(data[0].distance_cm));
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(data[i].distance_cm));
  ctx.lineTo(xOf(n - 1), PAD.t + iH);
  ctx.lineTo(xOf(0), PAD.t + iH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = "#22c55e"; ctx.lineWidth = 2.2; ctx.lineJoin = "round";
  ctx.moveTo(xOf(0), yOf(data[0].distance_cm));
  for (let i = 1; i < n; i++) ctx.lineTo(xOf(i), yOf(data[i].distance_cm));
  ctx.stroke();

  // Dots
  for (let i = 0; i < n; i++) {
    const x = xOf(i), y = yOf(data[i].distance_cm);
    const latest = i === n - 1;
    ctx.beginPath();
    ctx.arc(x, y, latest ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle   = latest ? "#4ade80" : "rgba(34,197,94,0.7)";
    ctx.strokeStyle = latest ? "#166534" : "#14532d";
    ctx.lineWidth   = 1.5;
    ctx.fill(); ctx.stroke();
  }

  // X labels
  [0, Math.floor(n / 2), n - 1].forEach(i => {
    if (i < 0 || i >= n) return;
    ctx.fillStyle = "rgba(148,163,184,0.4)";
    ctx.font = `500 9px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.fillText(fmtTsShort(data[i].ts), xOf(i), PAD.t + iH + 20);
  });

  // Y-axis label
  ctx.save();
  ctx.translate(12, PAD.t + iH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(148,163,184,0.3)";
  ctx.font = "700 9px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("DISTANCE (cm)", 0, 0);
  ctx.restore();
}

/* ════════════════════════════════════════════════════════════
   API
   ════════════════════════════════════════════════════════════ */
async function apiFetch(path) {
  const r = await fetch(CONFIG.API_BASE_URL + path, { signal: AbortSignal.timeout(4500) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchAll() {
  if (DEMO.active) return;
  try {
    const [status, readings, health] = await Promise.all([
      apiFetch("/api/status"),
      apiFetch("/api/readings?limit=" + CONFIG.MAX_CHART_POINTS),
      apiFetch("/api/health"),
    ]);
    setConnection("connected");
    applyStatus(status);
    applyHealth(health);

    // Chart
    STATE.chartData = [...readings].reverse().map(r => ({ ts: r.timestamp, distance_cm: r.distance_cm }));
    drawChart();

    // Table
    STATE.tableReadings = readings.slice(0, CONFIG.MAX_TABLE_ROWS);
    renderTable(STATE.tableReadings);
  } catch (err) {
    setConnection("disconnected");
    console.warn("API error:", err.message);
  }
}

function startPoller() {
  clearInterval(STATE.pollerTimer);
  STATE.pollerTimer = setInterval(fetchAll, CONFIG.POLL_INTERVAL_MS);
}

/* ════════════════════════════════════════════════════════════
   EVENTS
   ════════════════════════════════════════════════════════════ */
D.btnToggleDemo  && D.btnToggleDemo.addEventListener("click",  () => DEMO.active ? stopDemo() : startDemo());
D.btnDisableDemo && D.btnDisableDemo.addEventListener("click", stopDemo);
D.btnRefresh     && D.btnRefresh.addEventListener("click",     () => DEMO.active ? demoTick() : fetchAll());
D.btnRefreshTbl  && D.btnRefreshTbl.addEventListener("click",  () => DEMO.active ? demoTick() : fetchAll());

window.addEventListener("resize", () => {
  clearTimeout(window._rTimer);
  window._rTimer = setTimeout(() => { drawChart(); drawGrainTexture(); }, 160);
});

/* ════════════════════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════════════════════ */
(function boot() {
  if (sessionStorage.getItem("demoMode") === "1") {
    startDemo();
  } else {
    fetchAll();
    startPoller();
  }
})();
