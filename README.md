# Smart Grain Storage Monitoring System

> **College Demo Project** — Real-time grain level monitoring using an ESP32 microcontroller, HC-SR04 ultrasonic sensor, FastAPI backend, and a vanilla HTML/CSS/JS dashboard.

---

## Project Overview

This system monitors the grain fill level inside a storage container using ultrasonic distance measurement. The ESP32 reads the distance to the grain surface, controls two LED indicators, and sends readings to a Python FastAPI server over Wi-Fi. A responsive web dashboard displays live data including a fill-level animation, LED status, distance history chart, and a table of recent readings.

```
┌─────────────┐   Wi-Fi / HTTP POST   ┌──────────────────┐   HTTP GET   ┌──────────────────┐
│  ESP32      │ ──────────────────▶  │  FastAPI Backend  │ ◀────────── │  Web Dashboard    │
│ + HC-SR04   │                       │  + SQLite DB      │             │  (Browser)        │
│ + 2 LEDs    │                       │  port 8000        │             │  port 5500        │
└─────────────┘                       └──────────────────┘             └──────────────────┘
```

---

## Hardware

| Component | Specification |
|-----------|--------------|
| Microcontroller | Generic ESP32 development board (38-pin or 30-pin) |
| Distance sensor | HC-SR04 ultrasonic sensor |
| Red LED | Any 5 mm red LED + 220 Ω current-limiting resistor |
| Green LED | Any 5 mm green LED + 220 Ω current-limiting resistor |

### GPIO Pin Assignment

| Signal | ESP32 GPIO | Notes |
|--------|-----------|-------|
| HC-SR04 TRIG | GPIO 5 | Direct 3.3 V output |
| HC-SR04 ECHO | GPIO 18 | **Via voltage divider** (see below) |
| Red LED | GPIO 25 | Through 220 Ω resistor to GND |
| Green LED | GPIO 26 | Through 220 Ω resistor to GND |

### ⚠️ ECHO Voltage Divider (REQUIRED)

The HC-SR04 ECHO pin outputs 5 V logic. ESP32 GPIOs are only 3.3 V tolerant. A simple resistor voltage divider is required to protect the ESP32.

```
HC-SR04 ECHO pin
      │
    [R1 = 1 kΩ]
      │
      ├──────────── GPIO 18 (ESP32)
      │
    [R2 = 2 kΩ]   (2.2 kΩ is fine)
      │
     GND

Vout = 5V × 2kΩ / (1kΩ + 2kΩ) = 3.33 V ✓
```

**Parts needed:** one 1 kΩ resistor + one 2 kΩ (or 2.2 kΩ) resistor.

### LED Wiring

```
GPIO 25 ──── [220 Ω] ──── Red LED anode ──── LED cathode ──── GND
GPIO 26 ──── [220 Ω] ──── Green LED anode ── LED cathode ──── GND
```

---

## Project Structure

```
Smart Grain Monitor/
├── backend/
│   ├── main.py              FastAPI application (all API endpoints)
│   └── requirements.txt     Python dependencies
├── firmware/
│   └── grain_monitor.ino    ESP32 Arduino sketch
├── frontend/
│   ├── index.html           Dashboard HTML
│   ├── style.css            Dashboard styles
│   └── script.js            Dashboard logic (vanilla JS)
└── README.md
```

---

## Setup Instructions (Windows)

### Prerequisites

- Python 3.10 or newer — https://www.python.org/downloads/
- A modern web browser (Chrome, Edge, Firefox)
- Arduino IDE 2.x (only if programming hardware) — https://www.arduino.cc/en/software

---

### Step 1 — Install Python Dependencies

Open **Command Prompt** or **PowerShell** and navigate to the `backend` folder:

```powershell
cd "c:\Projects\Smart Grain Monitor\backend"
python -m pip install -r requirements.txt
```

---

### Step 2 — Start the FastAPI Backend

From the `backend` folder:

```powershell
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> **Note:** The command is `main:app` (colon, not space). Keep this terminal open.

Verify it is running by opening your browser at:

- **API docs (Swagger UI):** http://localhost:8000/docs
- **Health check:** http://localhost:8000/api/health

Expected health response:
```json
{ "status": "ok", "timestamp": "...", "uptime_s": 1.23 }
```

---

### Step 3 — Start the Frontend Server

Open a **second** Command Prompt / PowerShell window and navigate to the `frontend` folder:

```powershell
cd "c:\Projects\Smart Grain Monitor\frontend"
python -m http.server 5500
```

Keep this terminal open.

---

### Step 4 — Open the Dashboard

Open your browser at:

**http://localhost:5500**

The dashboard will start in **connected mode** and poll the backend every 5 seconds.  
If the backend is not running, it will show **API Offline** in the connection badge.

---

### Step 5 — Demo Mode (no hardware required)

The dashboard includes a clearly labelled **Demo Mode** that generates realistic simulated readings so the dashboard can be demonstrated without any hardware.

- Click the **"Demo"** button in the header, OR
- Click **"✕ Disable Demo"** in the amber banner to return to real-data mode.

> **Important:** Demo values are simulated and are clearly marked. They are never sent to or stored by the backend.

---

## API Reference

All endpoints are at `http://localhost:8000`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health and uptime |
| GET | `/api/status` | Latest reading + config summary |
| POST | `/api/readings` | Submit a new sensor reading |
| GET | `/api/readings?limit=N` | Retrieve recent readings (max 500) |
| GET | `/api/config` | Get container configuration |
| PUT | `/api/config` | Update container height / low threshold |

### POST /api/readings — Request Body

```json
{
  "device_id":   "ESP32-GRAIN-01",
  "distance_cm": 42.5,
  "red_led":     false,
  "green_led":   true,
  "timestamp":   "2026-10-25T15:30:00Z"
}
```

- `distance_cm` must be between 0.01 and 500, or exactly `-1.0` (sensor error sentinel).
- `timestamp` is optional — the server will use UTC now if omitted.

### PUT /api/config — Request Body

```json
{
  "container_height_cm": 120.0,
  "low_threshold_pct":   30.0
}
```

---

## ESP32 Firmware Setup

### 1. Install ESP32 Board Support

1. Open Arduino IDE → **File → Preferences**
2. In **Additional Boards Manager URLs**, add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Tools → Board → Boards Manager** → search `esp32` → install **esp32 by Espressif Systems**

### 2. Install ArduinoJson Library

**Tools → Manage Libraries** → search `ArduinoJson` → install by **Benoît Blanchon** (v6 or v7).

### 3. Configure the Sketch

Open `firmware/grain_monitor.ino` and edit the top section:

```cpp
const char* WIFI_SSID     = "YourWiFiSSID";
const char* WIFI_PASSWORD = "YourWiFiPassword";
// Use your computer's LAN IP (find with: ipconfig on Windows)
const char* BACKEND_URL   = "http://192.168.1.42:8000";
const char* DEVICE_ID     = "ESP32-GRAIN-01";
```

> **Finding your LAN IP on Windows:**
> ```powershell
> ipconfig
> ```
> Look for `IPv4 Address` under your Wi-Fi adapter (e.g., `192.168.1.42`).

### 4. Upload

- **Tools → Board → esp32 → ESP32 Dev Module**
- Select the correct **COM port**: **Tools → Port**
- Click **Upload** (▶ button)
- Open **Serial Monitor** at **115200 baud** to see live output

---

## LED Behaviour

| Condition | Red LED (GPIO 25) | Green LED (GPIO 26) |
|-----------|:-----------------:|:-------------------:|
| Grain level NORMAL | OFF | ON |
| Grain level LOW | ON | OFF |
| SENSOR ERROR | ON | OFF |
| Wi-Fi disconnected | ON (blinking) | OFF |

---

## Grain Status Logic

```
fill_pct = (container_height_cm - distance_cm) / container_height_cm × 100

if fill_pct < low_threshold_pct  → Status: LOW    (Red LED ON)
if fill_pct ≥ low_threshold_pct  → Status: NORMAL (Green LED ON)
if distance_cm = -1.0            → Status: SENSOR ERROR (Red LED ON)
```

Default configuration:
- Container height: **100 cm**
- Low threshold: **25%** (grain depth < 25 cm)

These can be updated via `PUT /api/config` without restarting the server.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Dashboard shows "API Offline" | Backend not running | Start uvicorn (Step 2) |
| All readings show SENSOR ERROR | Bad wiring or missing voltage divider | Check HC-SR04 connections; verify voltage divider |
| ESP32 won't connect to Wi-Fi | Wrong SSID/password or 5 GHz network | ESP32 only supports 2.4 GHz Wi-Fi |
| HTTP POST fails (ESP32 serial) | Wrong BACKEND_URL | Use LAN IP, not `localhost` |
| Chart is empty | No readings in DB yet | Wait for first ESP32 POST, or enable Demo Mode |
| Frontend shows wrong fill % | Container height not configured | `PUT /api/config` with correct `container_height_cm` |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript, Canvas API |
| Backend | Python 3, FastAPI, Pydantic, aiosqlite |
| Database | SQLite (file: `backend/grain_monitor.db`) |
| Firmware | Arduino C++ (ESP32 Arduino core) |
| Sensor | HC-SR04 ultrasonic (2 cm – 400 cm range) |
| Communication | Wi-Fi 802.11 b/g/n (2.4 GHz), HTTP/JSON |

---

## Notes & Limitations

- **No temperature or humidity sensors are installed.** The dashboard intentionally does not display these measurements.
- **Demo mode values are clearly simulated.** Real hardware readings are required for accurate grain level monitoring.
- **Hardware testing** requires the physical ESP32 and sensor; this README describes the intended wiring and software configuration only.
- The SQLite database file is created automatically at `backend/grain_monitor.db` on first run.
- CORS is configured to allow all origins for local demo purposes.

---

*Smart Grain Storage Monitoring System — College Demo Project*
