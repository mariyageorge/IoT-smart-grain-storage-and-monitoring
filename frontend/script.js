/**
 * ==========================================================================
 * GRAINLY STUDIO — SMART SILO OS
 * File: frontend/script.js
 * Architecture: Pure Vanilla ECMAScript (Zero Frameworks, Zero Dependencies)
 * Features:
 *   - Pinterest-Inspired Warm Editorial Design & Aesthetics
 *   - Real-time ESP32 & HC-SR04 Telemetry Polling (REST)
 *   - Deep Historical Analytics (Depletion Rate, Peak/Trough, Stability)
 *   - Enterprise Sidebar Navigation & Multi-Section Views
 *   - Real-Time Table Search & Status Filtering
 *   - 3D Architectural Grain Silo with Animated Volumetric Surface
 *   - Brushed Bezel Physical LED Indicators (GPIO 25 & 26)
 *   - Interactive Hardware Test Bench & Sensor Slider
 *   - Anti-aliased Canvas Spline Chart with Crosshair Tooltip
 *   - CSV Audit Trail Exporter & Sizing Calibration Modal
 * ==========================================================================
 */

"use strict";

/* ─── 1. GLOBAL CONFIGURATION & CONSTANTS ─── */
const CONFIG = {
  API_BASE_URL: "http://10.198.166.8:8000",
  POLL_INTERVAL_MS: 3000,
  MAX_CHART_POINTS: 20,
  MAX_TABLE_ROWS: 50,
  DEFAULT_HEIGHT_CM: 9.0,
  DEFAULT_LOW_PCT: 22.2,
  CYLINDER_RADIUS_CM: 3.0,
};

// Safe API URL normalizer (detects hostname dynamically)
function getApiBase() {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "http://localhost:8000";
  }
  if (window.location.hostname && window.location.hostname !== "") {
    return `http://${window.location.hostname}:8000`;
  }
  let u = (CONFIG.API_BASE_URL || "http://localhost:8000").trim();
  return u.replace(/\/api\/readings\/?$/, "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
}

// Bulk densities in kg/L for volumetric-to-mass estimations
const GRAIN_PROPERTIES = {
  wheat: { name: "Wheat", density: 0.78, themeClass: "grain-theme-wheat" },
  corn: { name: "Yellow Corn", density: 0.72, themeClass: "grain-theme-corn" },
  rice: { name: "White Rice", density: 0.85, themeClass: "grain-theme-rice" },
  soy: { name: "Soybeans", density: 0.75, themeClass: "grain-theme-soy" },
};

/* ─── 2. DOM ELEMENT REGISTRY ─── */
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

const DOM = {
  // Sidebar & Layout
  appSidebar: $("app-sidebar"),
  btnToggleSidebar: $("btn-toggle-sidebar"),
  btnCloseSidebar: $("btn-close-sidebar"),
  navLinks: $$(".nav-link"),
  navBtnSim: $("nav-btn-sim"),
  navBtnCalibrate: $("nav-btn-calibrate"),
  navLogCount: $("nav-log-count"),
  sideDepletionRate: $("side-depletion-rate"),
  sidePeakGrain: $("side-peak-grain"),
  sideStabilityIdx: $("side-stability-idx"),
  sideSampleCount: $("side-sample-count"),

  // Telemetry & Header
  deviceDot: $("device-dot"),
  deviceIdText: $("device-id-text"),
  connDot: $("conn-dot"),
  connLabel: $("conn-label"),
  liveClock: $("live-clock"),
  btnAudio: $("btn-audio-toggle"),
  iconSoundOn: $("icon-sound-on"),
  iconSoundOff: $("icon-sound-off"),
  btnSimDrawer: $("btn-sim-drawer"),
  btnOpenConfig: $("btn-open-config"),
  btnRefreshAll: $("btn-refresh-all"),

  // Simulator Drawer & Banner
  simBanner: $("sim-banner"),
  btnBannerSync: $("btn-banner-sync"),
  bannerSyncText: $("banner-sync-text"),
  btnExitSim: $("btn-exit-sim"),
  simDrawer: $("sim-drawer"),
  simSlider: $("sim-distance-slider"),
  sliderDistVal: $("slider-dist-val"),
  sliderFillPrev: $("slider-fill-preview"),
  presetBtns: $$(".preset-btn"),
  btnAutoWave: $("btn-auto-wave"),
  autoWaveText: $("auto-wave-text"),

  // KPI Metrics
  valFill: $("val-fill"),
  valDistance: $("val-distance"),
  valStatus: $("val-status"),
  valUptime: $("val-uptime"),
  heroStatusPill: $("hero-status-pill"),
  statusCardGlow: $("status-card-glow"),
  statusExplanation: $("status-explanation"),
  kpiProgressFill: $("kpi-progress-fill"),
  kpiProgressDist: $("kpi-progress-dist"),
  kpiEstVolume: $("kpi-est-volume"),
  kpiEstWeight: $("kpi-est-weight"),
  kpiContHeight: $("kpi-cont-height"),
  kpiGrainDepth: $("kpi-grain-depth"),
  kpiLowThresh: $("kpi-low-thresh"),
  alarmStateTxt: $("alarm-state-txt"),
  valLastSync: $("val-last-sync"),
  totalLogsCount: $("total-logs-count"),

  // Silo Visual Workspace & Glass Jar
  grainTypeSelect: $("grain-type-select"),
  siloStructure: $("silo-structure"),
  grainReservoir: $("grain-reservoir"),
  grainBedBody: $("grain-bed-body"),
  grainCanvas: $("grain-particles-canvas"),
  grainFallingCanvas: $("grain-falling-canvas"),
  grainImpactSplash: $("grain-impact-splash"),
  btnTogglePour: $("btn-toggle-pour"),
  pourBtnText: $("pour-btn-text"),
  pourBtnIcon: $("pour-btn-icon"),
  siloHudNum: $("silo-hud-num"),
  headspaceBracket: $("headspace-bracket"),
  bracketCm: $("bracket-cm"),
  rulerHTop: $("ruler-h-top"),

  // Silo Diagnostics
  diagHeadspace: $("diag-headspace"),
  diagDepth: $("diag-depth"),
  diagFillPct: $("diag-fill-pct"),
  diagMass: $("diag-mass"),
  diagGrainName: $("diag-grain-name"),
  diagStatusText: $("diag-status-text"),

  // LED Bezel Lamps
  lampRedLens: $("lamp-red-lens"),
  lampGreenLens: $("lamp-green-lens"),
  chipRedState: $("chip-red-state"),
  chipGreenState: $("chip-green-state"),

  // Canvas Spline Chart & HUD
  chartCanvas: $("scada-trend-chart"),
  chartWrapper: $("chart-wrapper"),
  chartTooltip: $("chart-tooltip"),
  ttTime: $("tt-time"),
  ttDist: $("tt-dist"),
  ttFill: $("tt-fill"),
  ttStatus: $("tt-status"),
  rangeBtns: $$(".range-btn"),
  cstatCurr: $("cstat-curr"),
  cstatMin: $("cstat-min"),
  cstatMax: $("cstat-max"),
  cstatStability: $("cstat-stability"),

  // Table & Filters
  scadaTable: $("scada-table"),
  readingsTbody: $("readings-tbody"),
  logSearchInput: $("log-search-input"),
  filterChips: $$(".filter-chip"),
  btnExportCsv: $("btn-export-csv"),
  btnRefreshTable: $("btn-refresh-table"),
  tableSubtitle: $("table-subtitle"),

  // Calibration Modal
  configModal: $("config-modal"),
  modalBackdrop: $("modal-backdrop"),
  btnCloseModal: $("btn-close-modal"),
  btnCancelConfig: $("btn-cancel-config"),
  configForm: $("config-form"),
  cfgContainerH: $("cfg-container-height"),
  cfgLowThresh: $("cfg-low-threshold"),
  cfgDeviceId: $("cfg-device-id"),

  // Footer
  footerStatusPill: $("footer-status-pill"),
};

/* ─── 3. APPLICATION STATE STORE ─── */
const STATE = {
  // Physical parameters
  containerHeight: CONFIG.DEFAULT_HEIGHT_CM,
  lowThreshold: CONFIG.DEFAULT_LOW_PCT,
  deviceId: "ESP32-GRAIN-01",
  grainType: "wheat",

  // Live telemetry
  latestDistance: null,
  latestFillPct: null,
  latestStatus: "NORMAL",
  redLedOn: false,
  greenLedOn: false,

  // Historical data
  historyReadings: [],
  chartLimit: 20,
  activeFilter: "ALL",
  searchQuery: "",

  // Hardware simulator
  simActive: false,
  simSyncToServer: true,
  autoWaveActive: false,
  autoWaveTimer: null,
  autoWaveDir: 1,

  // Audio system
  audioEnabled: true,
  audioContext: null,
  lastBeepTime: 0,

  // Polling timer
  pollTimer: null,
  bootTime: Date.now(),
};

/* ─── 4. WEB AUDIO ALARM SYNTHESIZER ─── */
function initAudio() {
  if (!STATE.audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      STATE.audioContext = new AudioCtx();
    }
  }
}

function playWarningChime() {
  if (!STATE.audioEnabled) return;
  initAudio();
  if (!STATE.audioContext) return;

  const now = Date.now();
  if (now - STATE.lastBeepTime < 3500) return; // Prevent buzzer spam
  STATE.lastBeepTime = now;

  try {
    const ctx = STATE.audioContext;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    // Warm harmonic chime
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(523.25, ctx.currentTime + 0.15); // C5

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.36);
  } catch (e) {
    console.warn("Audio alert error:", e);
  }
}

/* ─── 5. GRAIN PHYSICAL METRICS COMPUTATION ENGINE ─── */
function computeGrainMetrics(distanceCm, containerH, lowThreshPct) {
  const contH = containerH !== undefined ? containerH : STATE.containerHeight;
  const lowPct = lowThreshPct !== undefined ? lowThreshPct : STATE.lowThreshold;

  // Sensor error sentinel (-1) or out-of-range
  if (distanceCm == null || distanceCm < 0) {
    return {
      distance: null,
      depth: null,
      fillPct: null,
      status: "SENSOR ERROR",
      redLed: true,
      greenLed: false,
      volumeLiters: 0,
      massKg: 0,
    };
  }

  // Grain Depth = Container Height - Ultrasonic Distance
  let depth = contH - distanceCm;
  if (depth < 0) depth = 0;
  if (depth > contH) depth = contH;

  // Fill Percentage = (Grain Depth / Container Height) * 100
  const fillPct = contH > 0 ? (depth / contH) * 100 : 0;

  // Status & LEDs: depth <= 2.0 cm or fillPct <= lowPct triggers LOW
  const isLow = fillPct <= lowPct || depth <= 2.0;
  const status = isLow ? "LOW" : "NORMAL";
  const redLed = isLow;
  const greenLed = !isLow;

  // Cylinder Volume: V = pi * r^2 * h (in cm^3), convert to Liters (/1000)
  const r = CONFIG.CYLINDER_RADIUS_CM;
  const volumeCm3 = Math.PI * r * r * depth;
  const volumeLiters = volumeCm3 / 1000;

  // Mass = Volume (L) * Bulk Density (kg/L)
  const density = GRAIN_PROPERTIES[STATE.grainType]?.density || 0.78;
  const massKg = volumeLiters * density;

  return {
    distance: distanceCm,
    depth: depth,
    fillPct: fillPct,
    status: status,
    redLed: redLed,
    greenLed: greenLed,
    volumeLiters: volumeLiters,
    massKg: massKg,
  };
}

/* ─── 6. PARTICLES & TEXTURE GENERATOR ─── */
function renderGrainCanvasTexture() {
  const canvas = DOM.grainCanvas;
  if (!canvas) return;

  const w = (canvas.width = canvas.parentElement.clientWidth || 180);
  const h = (canvas.height = canvas.parentElement.clientHeight || 280);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(180, 83, 9, 0.22)";

  // Scatter grain specks
  const count = Math.floor((w * h) / 85);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 0.8 + Math.random() * 1.8;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Ambient Floating Golden Grain Particles in Background
function initAmbientGrainsAnimation() {
  const canvas = document.getElementById("ambient-grain-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w = (canvas.width = window.innerWidth);
  let h = (canvas.height = window.innerHeight);

  window.addEventListener("resize", () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  });

  const particles = [];
  const particleCount = 28;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: 4 + Math.random() * 6,
      aspect: 2.2 + Math.random() * 0.8,
      speedY: 0.3 + Math.random() * 0.6,
      speedX: (Math.random() - 0.45) * 0.4,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02,
      opacity: 0.12 + Math.random() * 0.22,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, w, h);

    particles.forEach((p) => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotSpeed;

      if (p.y > h + 20) {
        p.y = -20;
        p.x = Math.random() * w;
      }
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = `rgba(217, 119, 6, ${p.opacity})`;

      // Draw grain kernel (ellipse with tapered ends)
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size, p.size / p.aspect, 0, 0, Math.PI * 2);
      ctx.fill();

      // Tiny grain crease
      ctx.strokeStyle = `rgba(180, 83, 9, ${p.opacity * 0.8})`;
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(-p.size * 0.7, 0);
      ctx.lineTo(p.size * 0.7, 0);
      ctx.stroke();

      ctx.restore();
    });

    requestAnimationFrame(animate);
  }

  animate();
}

/* ─── 6.1 INTERACTIVE GRAIN POURING PHYSICS (JAR STREAM & SPLASH) ─── */
let isPouringStreamActive = true;
let triggerBurstCount = 0;

function initGrainPouringPhysics() {
  const canvas = DOM.grainFallingCanvas;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let w = (canvas.width = canvas.parentElement.clientWidth || 195);
  let h = (canvas.height = canvas.parentElement.clientHeight || 380);

  window.addEventListener("resize", () => {
    if (canvas.parentElement) {
      w = canvas.width = canvas.parentElement.clientWidth || 195;
      h = canvas.height = canvas.parentElement.clientHeight || 380;
    }
  });

  const fallingGrains = [];
  const splashParticles = [];

  // Grain Color Palettes by Commodity Type
  const PALETTES = {
    wheat: ["#F59E0B", "#D97706", "#B45309", "#FDE68A"],
    corn:  ["#FACC15", "#EAB308", "#CA8A04", "#FEF08A"],
    rice:  ["#F9FAFB", "#F3F4F6", "#E5E7EB", "#D1D5DB"],
    soy:   ["#A3E635", "#84CC16", "#65A30D", "#BEF264"],
  };

  function spawnFallingGrain() {
    const palette = PALETTES[STATE.grainType] || PALETTES.wheat;
    const color = palette[Math.floor(Math.random() * palette.length)];

    fallingGrains.push({
      x: w / 2 + (Math.random() - 0.5) * 14,
      y: 10 + Math.random() * 4,
      vx: (Math.random() - 0.5) * 0.8,
      vy: 1.8 + Math.random() * 1.5,
      size: 3.5 + Math.random() * 2.5,
      aspect: 2.2 + Math.random() * 0.6,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 0.15,
      color: color,
    });
  }

  function createImpactSplash(x, y) {
    const palette = PALETTES[STATE.grainType] || PALETTES.wheat;
    const numSplash = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numSplash; i++) {
      const angle = (Math.random() * Math.PI) + Math.PI; // Upward semi-circle
      const speed = 1.0 + Math.random() * 2.2;
      splashParticles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y - 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed * 0.6,
        size: 1.8 + Math.random() * 1.6,
        life: 1.0,
        decay: 0.04 + Math.random() * 0.04,
        color: palette[Math.floor(Math.random() * palette.length)],
      });
    }

    if (DOM.grainImpactSplash) {
      DOM.grainImpactSplash.classList.add("active");
    }
  }

  function loop() {
    ctx.clearRect(0, 0, w, h);

    // Calculate current grain bed surface height inside the jar
    let bedPx = 160;
    if (DOM.grainReservoir) {
      bedPx = DOM.grainReservoir.clientHeight || 160;
    }
    const impactSurfaceY = Math.max(45, h - bedPx - 4);

    // Spawn new stream grains if active
    if (isPouringStreamActive) {
      spawnFallingGrain();
      spawnFallingGrain();
    } else if (triggerBurstCount > 0) {
      spawnFallingGrain();
      spawnFallingGrain();
      spawnFallingGrain();
      triggerBurstCount--;
    } else if (DOM.grainImpactSplash) {
      DOM.grainImpactSplash.classList.remove("active");
    }

    // 1. Update and Draw Falling Grains
    for (let i = fallingGrains.length - 1; i >= 0; i--) {
      const g = fallingGrains[i];
      g.vy += 0.32; // Gravity
      g.y += g.vy;
      g.x += g.vx;
      g.rot += g.vrot;

      // Check collision with the heaping grain surface
      if (g.y >= impactSurfaceY) {
        createImpactSplash(g.x, impactSurfaceY);
        fallingGrains.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.rot);
      ctx.fillStyle = g.color;

      ctx.beginPath();
      ctx.ellipse(0, 0, g.size, g.size / g.aspect, 0, 0, Math.PI * 2);
      ctx.fill();

      // Subtle shadow streak
      ctx.fillStyle = "rgba(0,0,0,0.15)";
      ctx.beginPath();
      ctx.ellipse(0, 0.5, g.size * 0.7, (g.size / g.aspect) * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // 2. Update and Draw Splash Bouncing Specks
    for (let i = splashParticles.length - 1; i >= 0; i--) {
      const s = splashParticles[i];
      s.vy += 0.22; // Gravity on bounce
      s.x += s.vx;
      s.y += s.vy;
      s.life -= s.decay;

      if (s.life <= 0 || s.y > impactSurfaceY + 10) {
        splashParticles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    requestAnimationFrame(loop);
  }

  loop();
}

function triggerPourBurst() {
  triggerBurstCount += 35;
}
function analyzeHistory() {
  const logs = STATE.historyReadings;
  const count = logs.length;

  if (DOM.navLogCount) DOM.navLogCount.textContent = count;
  if (DOM.sideSampleCount) DOM.sideSampleCount.textContent = `${count} cycles`;
  if (DOM.totalLogsCount) DOM.totalLogsCount.textContent = count;

  if (count === 0) {
    if (DOM.sideDepletionRate) DOM.sideDepletionRate.textContent = "0.0 cm/hr";
    if (DOM.sidePeakGrain) DOM.sidePeakGrain.textContent = "-- cm";
    if (DOM.sideStabilityIdx) DOM.sideStabilityIdx.textContent = "100%";
    return;
  }

  // 1. Valid Distances
  const validDists = logs
    .map((r) => r.distance_cm)
    .filter((d) => d != null && d >= 0);

  if (validDists.length > 0) {
    const minD = Math.min(...validDists);
    const maxD = Math.max(...validDists);

    // Peak grain depth = Container Height - minDistance
    const peakDepth = Math.max(0, STATE.containerHeight - minD);
    if (DOM.sidePeakGrain) {
      DOM.sidePeakGrain.textContent = `${peakDepth.toFixed(1)} cm depth`;
    }

    if (DOM.cstatMin) DOM.cstatMin.textContent = `${minD.toFixed(1)} cm`;
    if (DOM.cstatMax) DOM.cstatMax.textContent = `${maxD.toFixed(1)} cm`;
    if (DOM.cstatCurr) DOM.cstatCurr.textContent = `${validDists[0].toFixed(1)} cm`;

    // 2. Stability Variance Index
    const mean = validDists.reduce((a, b) => a + b, 0) / validDists.length;
    const variance =
      validDists.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0) /
      validDists.length;
    const stdDev = Math.sqrt(variance);
    const stability = Math.max(94.0, Math.min(99.9, 100 - stdDev * 1.5));

    if (DOM.sideStabilityIdx) {
      DOM.sideStabilityIdx.textContent = `${stability.toFixed(1)}%`;
    }
    if (DOM.cstatStability) {
      DOM.cstatStability.textContent = `${stability.toFixed(1)}%`;
    }

    // 3. Depletion Rate (cm/hr) between oldest and newest in buffer
    if (logs.length >= 2) {
      const newest = logs[0];
      const oldest = logs[logs.length - 1];

      const tNew = new Date(newest.timestamp || Date.now()).getTime();
      const tOld = new Date(oldest.timestamp || Date.now() - 60000).getTime();
      const hoursDiff = (tNew - tOld) / (1000 * 3600);

      if (hoursDiff > 0.001 && newest.distance_cm != null && oldest.distance_cm != null) {
        // Distance increase means grain depth decreasing (depleting)
        const distDiff = newest.distance_cm - oldest.distance_cm;
        const ratePerHour = distDiff / hoursDiff;

        if (Math.abs(ratePerHour) < 0.1) {
          DOM.sideDepletionRate.textContent = "Stable (0.0 cm/h)";
        } else if (ratePerHour > 0) {
          DOM.sideDepletionRate.textContent = `-${ratePerHour.toFixed(1)} cm/h (discharging)`;
        } else {
          DOM.sideDepletionRate.textContent = `+${Math.abs(ratePerHour).toFixed(1)} cm/h (filling)`;
        }
      } else {
        DOM.sideDepletionRate.textContent = "0.0 cm/hr";
      }
    }
  }
}

/* ─── 8. TELEMETRY RENDER PIPELINE ─── */
function renderTelemetry(data) {
  if (!data) return;

  const contH = data.container_height_cm != null ? data.container_height_cm : STATE.containerHeight;
  const lowThresh = data.low_threshold_pct != null ? data.low_threshold_pct : STATE.lowThreshold;
  const rawDist = data.distance_cm;

  // Compute full physics set
  const metrics = computeGrainMetrics(rawDist, contH, lowThresh);

  STATE.latestDistance = metrics.distance;
  STATE.latestFillPct = metrics.fillPct;
  STATE.latestStatus = metrics.status;
  STATE.redLedOn = metrics.redLed;
  STATE.greenLedOn = metrics.greenLed;

  const fillPct = metrics.fillPct;
  const status = metrics.status;
  const redLed = metrics.redLed;
  const greenLed = metrics.greenLed;

  // 1. KPI Numeric Cards
  DOM.valFill.textContent = fillPct != null ? fillPct.toFixed(1) : "--";
  DOM.valDistance.textContent = metrics.distance != null ? metrics.distance.toFixed(1) : "--";
  DOM.kpiProgressFill.style.width = `${fillPct != null ? fillPct : 0}%`;

  if (metrics.distance != null && contH > 0) {
    const distRatio = Math.min(100, Math.max(0, (metrics.distance / contH) * 100));
    DOM.kpiProgressDist.style.width = `${distRatio}%`;
  } else {
    DOM.kpiProgressDist.style.width = "0%";
  }

  DOM.diagHeadspace.textContent = metrics.distance != null ? `${metrics.distance.toFixed(1)} cm` : "-- cm";

  if (metrics.depth != null) {
    DOM.kpiGrainDepth.textContent = `${metrics.depth.toFixed(1)} cm`;
    DOM.diagDepth.textContent = `${metrics.depth.toFixed(1)} cm`;
    DOM.kpiEstVolume.textContent = `${metrics.volumeLiters.toFixed(2)} L`;
    DOM.kpiEstWeight.textContent = `${metrics.massKg.toFixed(2)} kg`;
    DOM.diagMass.textContent = `${metrics.massKg.toFixed(2)} kg`;
  } else {
    DOM.kpiGrainDepth.textContent = "-- cm";
    DOM.diagDepth.textContent = "-- cm";
    DOM.kpiEstVolume.textContent = "-- L";
    DOM.kpiEstWeight.textContent = "-- kg";
    DOM.diagMass.textContent = "-- kg";
  }

  DOM.kpiContHeight.textContent = `${contH.toFixed(1)} cm`;
  DOM.kpiLowThresh.textContent = `${lowThresh.toFixed(1)}%`;
  DOM.rulerHTop.textContent = `${contH.toFixed(0)}cm`;

  // 2. Status Badge & Editorial Underglow
  DOM.valStatus.textContent = status;
  DOM.heroStatusPill.className = "status-pill-hero";

  if (status === "NORMAL") {
    DOM.heroStatusPill.classList.add("status-pill-hero--normal");
    DOM.statusCardGlow.style.background = "radial-gradient(circle, var(--c-sage-glow) 0%, transparent 70%)";
    DOM.statusExplanation.textContent = `Nominal level (${fillPct != null ? fillPct.toFixed(1) : 0}%). Sufficient grain buffer.`;
    DOM.diagStatusText.textContent = "Status: Nominal Storage";
    DOM.diagStatusText.parentElement.style.color = "var(--c-sage)";
    DOM.diagStatusText.parentElement.style.background = "var(--c-sage-soft)";
  } else if (status === "LOW") {
    DOM.heroStatusPill.classList.add("status-pill-hero--low");
    DOM.statusCardGlow.style.background = "radial-gradient(circle, var(--c-terracotta-glow) 0%, transparent 70%)";
    DOM.statusExplanation.textContent = `WARNING: Fill level fell below ${lowThresh}% safety threshold. Grain replenishment advised!`;
    DOM.diagStatusText.textContent = "Status: LOW GRAIN ALERT";
    DOM.diagStatusText.parentElement.style.color = "var(--c-terracotta)";
    DOM.diagStatusText.parentElement.style.background = "var(--c-terracotta-soft)";
    playWarningChime();
  } else {
    DOM.heroStatusPill.classList.add("status-pill-hero--error");
    DOM.statusCardGlow.style.background = "radial-gradient(circle, rgba(185, 28, 28, 0.25) 0%, transparent 70%)";
    DOM.statusExplanation.textContent = "HARDWARE FAULT: HC-SR04 ultrasonic echo out of range or sensor disconnected.";
    DOM.diagStatusText.textContent = "Status: SENSOR TIMEOUT";
    DOM.diagStatusText.parentElement.style.color = "#B91C1C";
    DOM.diagStatusText.parentElement.style.background = "#FEE2E2";
    playWarningChime();
  }

  // 3. Architectural Silo Fill Animation
  const visualPct = fillPct != null ? Math.min(100, Math.max(0, fillPct)) : 0;
  DOM.grainReservoir.style.height = `${visualPct}%`;
  DOM.siloHudNum.textContent = fillPct != null ? `${fillPct.toFixed(1)}%` : "FAULT";
  DOM.diagFillPct.textContent = fillPct != null ? `${fillPct.toFixed(1)}%` : "--%";

  // Headspace Bracket Position (Physical Headspace)
  if (metrics.distance != null && contH > 0) {
    const siloPx = 350; // Silo height in CSS
    const headspaceRatio = Math.min(1, Math.max(0.08, metrics.distance / contH));
    const bracketPx = Math.round(headspaceRatio * (siloPx - 50));
    DOM.headspaceBracket.style.height = `${bracketPx}px`;
    DOM.bracketCm.textContent = `${metrics.distance.toFixed(1)} cm`;
  } else {
    DOM.headspaceBracket.style.height = "260px";
    DOM.bracketCm.textContent = "N/A";
  }

  // 4. Physical LED Lamps with Brushed Bezels
  if (redLed) {
    DOM.lampRedLens.classList.add("active");
    DOM.chipRedState.textContent = "ON";
    DOM.chipRedState.className = "lamp-status-chip on-red";
  } else {
    DOM.lampRedLens.classList.remove("active");
    DOM.chipRedState.textContent = "OFF";
    DOM.chipRedState.className = "lamp-status-chip";
  }

  if (greenLed) {
    DOM.lampGreenLens.classList.add("active");
    DOM.chipGreenState.textContent = "ON";
    DOM.chipGreenState.className = "lamp-status-chip on-green";
  } else {
    DOM.lampGreenLens.classList.remove("active");
    DOM.chipGreenState.textContent = "OFF";
    DOM.chipGreenState.className = "lamp-status-chip";
  }

  // 5. Header & Telemetry Sync
  const ts = data.timestamp ? new Date(data.timestamp) : new Date();
  DOM.valLastSync.textContent = ts.toLocaleTimeString("en-IN", { hour12: false });
  if (data.device_id) {
    DOM.deviceIdText.textContent = data.device_id;
  }

  // 6. Refresh Deep Analytics
  analyzeHistory();
}

/* ─── 9. CANVAS SPLINE CHART RENDERER (WARM PINTEREST PALETTE) ─── */
function renderChart() {
  const canvas = DOM.chartCanvas;
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  canvas.width = w * dpr;
  canvas.height = h * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const rawData = STATE.historyReadings.slice(0, STATE.chartLimit).reverse();
  if (rawData.length === 0) {
    ctx.fillStyle = "#A3998E";
    ctx.font = "600 12px 'Plus Jakarta Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No historical telemetry recorded. Sensor readings will populate automatically.", w / 2, h / 2);
    return;
  }

  const pad = { t: 20, r: 30, b: 35, l: 45 };
  const plotW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;

  // Determine Y-scale range (Distance in cm)
  const validDistances = rawData.map((d) => d.distance_cm).filter((d) => d != null && d >= 0);
  const minVal = validDistances.length > 0 ? Math.max(0, Math.min(...validDistances) - 3) : 0;
  const maxVal = validDistances.length > 0 ? Math.max(...validDistances, STATE.containerHeight) : STATE.containerHeight;

  // Draw Grid Lines & Y-Labels (Warm Linen Minimalist)
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(228, 221, 210, 0.75)";
  ctx.fillStyle = "#766D64";
  ctx.font = "500 10px 'JetBrains Mono', monospace";
  ctx.textAlign = "right";

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const val = minVal + ((maxVal - minVal) / gridSteps) * (gridSteps - i);
    const y = pad.t + (plotH / gridSteps) * i;

    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(pad.l + plotW, y);
    ctx.stroke();

    ctx.fillText(`${Math.round(val)}cm`, pad.l - 8, y + 3);
  }

  // Draw Low Threshold Danger Line (Terracotta)
  const threshDist = STATE.containerHeight * (1 - STATE.lowThreshold / 100);
  if (threshDist >= minVal && threshDist <= maxVal) {
    const threshY = pad.t + plotH - ((threshDist - minVal) / (maxVal - minVal)) * plotH;
    ctx.save();
    ctx.strokeStyle = "rgba(194, 91, 78, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pad.l, threshY);
    ctx.lineTo(pad.l + plotW, threshY);
    ctx.stroke();

    ctx.fillStyle = "rgba(194, 91, 78, 0.9)";
    ctx.font = "700 9px 'JetBrains Mono', monospace";
    ctx.fillText("LOW BARRIER", pad.l + plotW, threshY - 4);
    ctx.restore();
  }

  // Compute Coordinates for Points
  const points = [];
  const stepX = plotW / Math.max(1, rawData.length - 1);

  rawData.forEach((item, idx) => {
    const x = pad.l + idx * stepX;
    const dist = item.distance_cm != null && item.distance_cm >= 0 ? item.distance_cm : maxVal;
    const y = pad.t + plotH - ((dist - minVal) / Math.max(1, maxVal - minVal)) * plotH;
    points.push({ x, y, raw: item });
  });

  // Store plotted points on canvas for tooltip lookup
  canvas._plottedPoints = points;

  // Draw Warm Terracotta/Amber Area Gradient Fill
  const areaGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + plotH);
  areaGrad.addColorStop(0, "rgba(201, 122, 62, 0.22)");
  areaGrad.addColorStop(1, "rgba(201, 122, 62, 0.0)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, pad.t + plotH);
  ctx.lineTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.lineTo(points[points.length - 1].x, pad.t + plotH);
  ctx.closePath();
  ctx.fillStyle = areaGrad;
  ctx.fill();

  // Draw Spline Line Stroke (Warm Amber)
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  ctx.strokeStyle = "#C97A3E";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Draw Points Circles
  points.forEach((pt) => {
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.strokeStyle = "#C97A3E";
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

/* ─── 10. CHART INTERACTIVE TOOLTIP HUD ─── */
function setupChartInteractivity() {
  const canvas = DOM.chartCanvas;
  if (!canvas) return;

  canvas.addEventListener("mousemove", (e) => {
    const points = canvas._plottedPoints;
    if (!points || points.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closest = null;
    let minDist = Infinity;

    points.forEach((pt) => {
      const d = Math.hypot(pt.x - mouseX, pt.y - mouseY);
      if (d < minDist) {
        minDist = d;
        closest = pt;
      }
    });

    if (minDist < 35 && closest) {
      const item = closest.raw;
      const ts = new Date(item.timestamp || Date.now());
      DOM.ttTime.textContent = ts.toLocaleTimeString("en-IN", { hour12: false });
      DOM.ttDist.textContent = `${item.distance_cm != null ? item.distance_cm.toFixed(1) : "--"} cm`;
      DOM.ttFill.textContent = `${item.fill_pct != null ? item.fill_pct.toFixed(1) : "--"}%`;
      DOM.ttStatus.textContent = item.grain_status || "NORMAL";

      // Position Tooltip
      DOM.chartTooltip.classList.remove("hidden");
      const left = Math.min(rect.width - 150, Math.max(10, closest.x - 70));
      const top = Math.max(10, closest.y - 75);
      DOM.chartTooltip.style.left = `${left}px`;
      DOM.chartTooltip.style.top = `${top}px`;
    } else {
      DOM.chartTooltip.classList.add("hidden");
    }
  });

  canvas.addEventListener("mouseleave", () => {
    DOM.chartTooltip.classList.add("hidden");
  });
}

/* ─── 11. TELEMETRY LOG TABLE & STATUS/SEARCH FILTER ─── */
function renderTable() {
  const tbody = DOM.readingsTbody;
  if (!tbody) return;

  const filter = STATE.activeFilter;
  const query = (STATE.searchQuery || "").toLowerCase().trim();

  const filtered = STATE.historyReadings.filter((r) => {
    // 1. Status Filter
    if (filter === "NORMAL" && r.grain_status !== "NORMAL") return false;
    if (filter === "LOW" && r.grain_status !== "LOW") return false;
    if (filter === "ERROR" && r.grain_status !== "SENSOR ERROR") return false;

    // 2. Search Query Filter
    if (query) {
      const tsStr = (r.timestamp || "").toLowerCase();
      const devStr = (r.device_id || "").toLowerCase();
      const distStr = r.distance_cm != null ? String(r.distance_cm) : "";
      const statusStr = (r.grain_status || "").toLowerCase();
      const matches =
        tsStr.includes(query) ||
        devStr.includes(query) ||
        distStr.includes(query) ||
        statusStr.includes(query);
      if (!matches) return false;
    }

    return true;
  });

  DOM.totalLogsCount.textContent = STATE.historyReadings.length;
  DOM.tableSubtitle.textContent = `Showing ${filtered.length} of ${STATE.historyReadings.length} total records (${filter} view)`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">
          <div class="empty-state-box">
            <span>No records matching criteria "${filter}" ${query ? `and query "${query}"` : ""}.</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((row, idx) => {
      const isRed = Boolean(row.red_led);
      const isGreen = Boolean(row.green_led);
      const statusClass =
        row.grain_status === "NORMAL"
          ? "tbl-pill--normal"
          : row.grain_status === "LOW"
            ? "tbl-pill--low"
            : "tbl-pill--error";

      const ts = new Date(row.timestamp || Date.now());
      const formattedTs = ts.toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });

      return `
        <tr>
          <td class="mono">${row.id || idx + 1}</td>
          <td class="mono">${formattedTs}</td>
          <td><strong style="color: var(--tx-hero);">${row.device_id || "ESP32-GRAIN-01"}</strong></td>
          <td class="mono">${row.distance_cm != null ? row.distance_cm.toFixed(1) + " cm" : "--"}</td>
          <td class="mono">${row.fill_pct != null ? row.fill_pct.toFixed(1) + "%" : "--"}</td>
          <td><span class="tbl-pill ${statusClass}">${row.grain_status || "NORMAL"}</span></td>
          <td style="text-align: center;"><span class="tbl-led-dot ${isRed ? "on-red" : ""}"></span></td>
          <td style="text-align: center;"><span class="tbl-led-dot ${isGreen ? "on-green" : ""}"></span></td>
        </tr>
      `;
    })
    .join("");
}

/* ─── 12. AUDIT TRAIL CSV EXPORTER ─── */
function exportAuditTrailCsv() {
  if (STATE.historyReadings.length === 0) {
    alert("No telemetry records available to export yet.");
    return;
  }

  const headers = ["Record_ID", "Timestamp_ISO", "Device_ID", "Distance_cm", "Fill_Percentage", "Grain_Status", "Red_LED_GPIO25", "Green_LED_GPIO26"];
  const rows = STATE.historyReadings.map((r) => [
    r.id || "",
    r.timestamp || new Date().toISOString(),
    r.device_id || STATE.deviceId,
    r.distance_cm != null ? r.distance_cm : "",
    r.fill_pct != null ? r.fill_pct : "",
    `"${r.grain_status || "NORMAL"}"`,
    r.red_led ? 1 : 0,
    r.green_led ? 1 : 0,
  ]);

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Grainly_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* ─── 13. HARDWARE SIMULATOR RIG ─── */
function setSimulatorMode(active) {
  STATE.simActive = active;
  if (active) {
    DOM.simBanner.classList.add("active");
    DOM.simDrawer.classList.add("open");
    DOM.connDot.className = "telem-dot demo";
    DOM.connLabel.textContent = "Virtual Rig Active";
    DOM.deviceDot.className = "telem-dot demo telem-dot--pulse";
    DOM.footerStatusPill.textContent = "Simulation Mode";
    DOM.footerStatusPill.style.color = "var(--c-amber)";
  } else {
    DOM.simBanner.classList.remove("active");
    DOM.simDrawer.classList.remove("open");
    stopAutoCycle();
    DOM.footerStatusPill.textContent = "System Online";
    DOM.footerStatusPill.style.color = "var(--c-sage)";
    fetchApiAll();
  }
}

async function injectVirtualReading(distCm) {
  const contH = STATE.containerHeight;
  const lowThresh = STATE.lowThreshold;
  const metrics = computeGrainMetrics(distCm, contH, lowThresh);
  const nowIso = new Date().toISOString();

  const record = {
    id: STATE.historyReadings.length + 1,
    device_id: STATE.deviceId,
    distance_cm: metrics.distance,
    fill_pct: metrics.fillPct,
    grain_status: metrics.status,
    red_led: metrics.redLed,
    green_led: metrics.greenLed,
    timestamp: nowIso,
    container_height_cm: contH,
    low_threshold_pct: lowThresh,
  };

  renderTelemetry(record);

  STATE.historyReadings.unshift(record);
  if (STATE.historyReadings.length > CONFIG.MAX_TABLE_ROWS) {
    STATE.historyReadings.pop();
  }

  renderChart();
  renderTable();

  // If sync enabled, post to actual backend /api/readings
  if (STATE.simSyncToServer && distCm !== -1) {
    try {
      fetch(`${getApiBase()}/api/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: STATE.deviceId,
          distance_cm: distCm,
          red_led: metrics.redLed,
          green_led: metrics.greenLed,
          timestamp: nowIso,
        }),
      }).catch(() => { });
    } catch (_) { }
  }
}

function handleSliderInput(e) {
  const dist = parseFloat(e.target.value);
  DOM.sliderDistVal.textContent = dist.toFixed(1);
  const m = computeGrainMetrics(dist);
  DOM.sliderFillPrev.textContent = `(${m.fillPct != null ? m.fillPct.toFixed(1) : 0}% Fill)`;
  triggerPourBurst();
  injectVirtualReading(dist);
}

function toggleAutoCycle() {
  if (STATE.autoWaveActive) {
    stopAutoCycle();
  } else {
    startAutoCycle();
  }
}

function startAutoCycle() {
  STATE.autoWaveActive = true;
  DOM.btnAutoWave.classList.add("active");
  DOM.autoWaveText.textContent = "Auto Wave: Running";

  STATE.autoWaveTimer = setInterval(() => {
    let cur = parseFloat(DOM.simSlider.value);
    const min = parseFloat(DOM.simSlider.min);
    const max = parseFloat(DOM.simSlider.max);

    cur += 0.2 * STATE.autoWaveDir;
    if (cur >= max) {
      cur = max;
      STATE.autoWaveDir = -1;
    } else if (cur <= min) {
      cur = min;
      STATE.autoWaveDir = 1;
    }

    DOM.simSlider.value = cur.toFixed(1);
    DOM.sliderDistVal.textContent = cur.toFixed(1);
    const m = computeGrainMetrics(cur);
    DOM.sliderFillPrev.textContent = `(${m.fillPct != null ? m.fillPct.toFixed(1) : 0}% Fill)`;
    injectVirtualReading(cur);
  }, 1000);
}

function stopAutoCycle() {
  STATE.autoWaveActive = false;
  clearInterval(STATE.autoWaveTimer);
  STATE.autoWaveTimer = null;
  DOM.btnAutoWave.classList.remove("active");
  DOM.autoWaveText.textContent = "Auto Fill/Empty Ticker";
}

/* ─── 14. FASTAPI BACKEND CLIENT & DATA INGESTION ─── */
async function fetchApiStatus() {
  try {
    const res = await fetch(`${getApiBase()}/api/status`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    DOM.connDot.className = "telem-dot online";
    DOM.connLabel.textContent = "FastAPI Online";
    DOM.deviceDot.className = "telem-dot online telem-dot--pulse";
    DOM.footerStatusPill.textContent = "System Online";
    DOM.footerStatusPill.className = "f-chip f-chip--green";

    if (data.container_height_cm != null) {
      STATE.containerHeight = parseFloat(data.container_height_cm);
    }
    if (data.low_threshold_pct != null) {
      STATE.lowThreshold = parseFloat(data.low_threshold_pct);
    }
    if (data.device_id) {
      STATE.deviceId = data.device_id;
    }

    if (!STATE.simActive) {
      renderTelemetry(data);
    }
  } catch (err) {
    if (!STATE.simActive) {
      DOM.connDot.className = "telem-dot offline";
      DOM.connLabel.textContent = "Connecting…";
      DOM.deviceDot.className = "telem-dot offline";
      DOM.footerStatusPill.textContent = "Awaiting Backend";
      DOM.footerStatusPill.className = "f-chip";
    }
  }
}

async function fetchApiReadings() {
  try {
    const res = await fetch(`${getApiBase()}/api/readings?limit=${CONFIG.MAX_TABLE_ROWS}`, { cache: "no-store" });
    if (!res.ok) return;
    const items = await res.json();

    if (Array.isArray(items) && items.length > 0) {
      if (!STATE.simActive) {
        STATE.historyReadings = items;
        renderChart();
        renderTable();
      }
    }
  } catch (_) { }
}

async function fetchApiAll() {
  await fetchApiStatus();
  await fetchApiReadings();
}

/* ─── 15. CALIBRATION MODAL HANDLERS ─── */
function openCalibrationModal() {
  DOM.cfgContainerH.value = STATE.containerHeight;
  DOM.cfgLowThresh.value = STATE.lowThreshold;
  DOM.cfgDeviceId.value = STATE.deviceId;
  DOM.configModal.classList.remove("hidden");
}

function closeCalibrationModal() {
  DOM.configModal.classList.add("hidden");
}

async function saveCalibration(e) {
  e.preventDefault();
  const height = parseFloat(DOM.cfgContainerH.value);
  const lowThresh = parseFloat(DOM.cfgLowThresh.value);
  const devId = DOM.cfgDeviceId.value.trim() || STATE.deviceId;

  if (isNaN(height) || height <= 0 || isNaN(lowThresh) || lowThresh <= 0 || lowThresh >= 100) {
    alert("Please enter valid positive dimensions for Container Height and Low Threshold.");
    return;
  }

  STATE.containerHeight = height;
  STATE.lowThreshold = lowThresh;
  STATE.deviceId = devId;

  // Update simulator slider bounds to container scale
  DOM.simSlider.max = Math.max(8.0, height * 0.9).toFixed(1);

  // Sync to FastAPI if available
  try {
    await fetch(`${getApiBase()}/api/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        container_height_cm: height,
        low_threshold_pct: lowThresh,
        device_id: devId,
      }),
    });
  } catch (_) { }

  closeCalibrationModal();

  // Re-compute with current distance
  if (STATE.latestDistance != null) {
    renderTelemetry({
      distance_cm: STATE.latestDistance,
      container_height_cm: height,
      low_threshold_pct: lowThresh,
    });
  }
  renderChart();
  renderTable();
}

/* ─── 16. EVENT BINDING & INTERACTIVITY ─── */
function bindEventListeners() {
  // Mobile Sidebar Toggle
  if (DOM.btnToggleSidebar && DOM.appSidebar) {
    DOM.btnToggleSidebar.addEventListener("click", () => {
      DOM.appSidebar.classList.toggle("open");
    });
  }
  if (DOM.btnCloseSidebar && DOM.appSidebar) {
    DOM.btnCloseSidebar.addEventListener("click", () => {
      DOM.appSidebar.classList.remove("open");
    });
  }

  // Sidebar Nav Links Smooth Scroll & Active State
  DOM.navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      DOM.navLinks.forEach((l) => l.classList.remove("active"));
      link.classList.add("active");
      if (DOM.appSidebar && window.innerWidth <= 1080) {
        DOM.appSidebar.classList.remove("open");
      }
    });
  });

  // Sidebar Tool Buttons
  if (DOM.navBtnSim) {
    DOM.navBtnSim.addEventListener("click", () => {
      setSimulatorMode(!STATE.simActive);
      if (DOM.appSidebar && window.innerWidth <= 1080) {
        DOM.appSidebar.classList.remove("open");
      }
    });
  }
  if (DOM.navBtnCalibrate) {
    DOM.navBtnCalibrate.addEventListener("click", () => {
      openCalibrationModal();
      if (DOM.appSidebar && window.innerWidth <= 1080) {
        DOM.appSidebar.classList.remove("open");
      }
    });
  }

  // Pour Grain Stream Toggle
  if (DOM.btnTogglePour) {
    DOM.btnTogglePour.addEventListener("click", () => {
      isPouringStreamActive = !isPouringStreamActive;
      if (isPouringStreamActive) {
        DOM.btnTogglePour.classList.add("header-btn--amber");
        if (DOM.pourBtnText) DOM.pourBtnText.textContent = "Pouring: ON";
      } else {
        DOM.btnTogglePour.classList.remove("header-btn--amber");
        if (DOM.pourBtnText) DOM.pourBtnText.textContent = "Pour Grain Stream";
      }
    });
  }

  // Simulator Drawer Toggles
  DOM.btnSimDrawer.addEventListener("click", () => {
    setSimulatorMode(!STATE.simActive);
  });
  DOM.btnExitSim.addEventListener("click", () => setSimulatorMode(false));

  DOM.btnBannerSync.addEventListener("click", () => {
    STATE.simSyncToServer = !STATE.simSyncToServer;
    DOM.bannerSyncText.textContent = `Sync to API: ${STATE.simSyncToServer ? "ON" : "OFF"}`;
  });

  DOM.simSlider.addEventListener("input", handleSliderInput);

  DOM.presetBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      DOM.presetBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const d = parseFloat(btn.dataset.dist);
      if (d !== -1) {
        DOM.simSlider.value = d;
        DOM.sliderDistVal.textContent = d.toFixed(1);
      } else {
        DOM.sliderDistVal.textContent = "ERR";
        DOM.sliderFillPrev.textContent = "(Sensor Fault)";
      }
      injectVirtualReading(d);
    });
  });

  DOM.btnAutoWave.addEventListener("click", toggleAutoCycle);

  // Audio Alarm Mute Toggle
  DOM.btnAudio.addEventListener("click", () => {
    STATE.audioEnabled = !STATE.audioEnabled;
    if (STATE.audioEnabled) {
      DOM.iconSoundOn.classList.remove("hidden");
      DOM.iconSoundOff.classList.add("hidden");
      DOM.alarmStateTxt.textContent = "Audio Alarm: Ready";
      playWarningChime();
    } else {
      DOM.iconSoundOn.classList.add("hidden");
      DOM.iconSoundOff.classList.remove("hidden");
      DOM.alarmStateTxt.textContent = "Audio Alarm: Muted";
    }
  });

  // Grain Type Selector
  DOM.grainTypeSelect.addEventListener("change", (e) => {
    const val = e.target.value;
    STATE.grainType = val;

    DOM.diagGrainName.textContent = `Based on ${GRAIN_PROPERTIES[val].name} density`;

    if (STATE.latestDistance != null) {
      renderTelemetry({
        distance_cm: STATE.latestDistance,
        container_height_cm: STATE.containerHeight,
        low_threshold_pct: STATE.lowThreshold,
      });
    }
  });

  // Chart Range Limits
  DOM.rangeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      DOM.rangeBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      STATE.chartLimit = parseInt(btn.dataset.limit, 10);
      renderChart();
    });
  });

  // Table Filter Chips
  DOM.filterChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      DOM.filterChips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      STATE.activeFilter = chip.dataset.filter;
      renderTable();
    });
  });

  // Table Real-Time Search Box
  if (DOM.logSearchInput) {
    DOM.logSearchInput.addEventListener("input", (e) => {
      STATE.searchQuery = e.target.value;
      renderTable();
    });
  }

  // CSV Export & Refreshes
  DOM.btnExportCsv.addEventListener("click", exportAuditTrailCsv);
  DOM.btnRefreshAll.addEventListener("click", () => {
    if (STATE.simActive) {
      injectVirtualReading(parseFloat(DOM.simSlider.value));
    } else {
      fetchApiAll();
    }
  });
  DOM.btnRefreshTable.addEventListener("click", fetchApiAll);

  // Calibration Modal
  DOM.btnOpenConfig.addEventListener("click", openCalibrationModal);
  DOM.btnCloseModal.addEventListener("click", closeCalibrationModal);
  DOM.btnCancelConfig.addEventListener("click", closeCalibrationModal);
  DOM.modalBackdrop.addEventListener("click", closeCalibrationModal);
  DOM.configForm.addEventListener("submit", saveCalibration);

  // Window Resize (Canvas Responsiveness)
  window.addEventListener("resize", () => {
    renderChart();
    renderGrainCanvasTexture();
  });
}

/* ─── 17. SYSTEM INITIALIZATION & BOOT ─── */
function initSystem() {
  // 1. Digital Clock
  setInterval(() => {
    const now = new Date();
    DOM.liveClock.textContent = now.toLocaleTimeString("en-IN", { hour12: false });

    // Uptime counter
    const elapsedSec = Math.floor((Date.now() - STATE.bootTime) / 1000);
    const hrs = Math.floor(elapsedSec / 3600);
    const mins = Math.floor((elapsedSec % 3600) / 60);
    DOM.valUptime.textContent = `${hrs}h ${mins.toString().padStart(2, "0")}m`;
  }, 1000);

  // 2. Grain Bed Particle Canvas & Ambient Floating Kernels & Pouring Physics
  renderGrainCanvasTexture();
  initAmbientGrainsAnimation();
  initGrainPouringPhysics();

  // 3. Chart Interactions
  setupChartInteractivity();

  // 4. Attach Events
  bindEventListeners();

  // 5. Initial Polling & Seed Data
  fetchApiAll();
  STATE.pollTimer = setInterval(fetchApiAll, CONFIG.POLL_INTERVAL_MS);

  // 6. Automatically populate test reading if fresh boot
  setTimeout(() => {
    if (STATE.historyReadings.length === 0 || STATE.latestDistance == null) {
      setSimulatorMode(true);
      injectVirtualReading(3.5);
    }
  }, 800);
}

// Fire on DOM Ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSystem);
} else {
  initSystem();
}
