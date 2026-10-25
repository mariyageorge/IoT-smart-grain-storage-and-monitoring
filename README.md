# Smart Grain Storage Monitoring System

> **College Demo Project** — Real-time grain level monitoring using an ESP32 microcontroller, HC-SR04 ultrasonic distance sensor, FastAPI backend, and a modern industrial web dashboard.

---

## 📋 Table of Contents

1. [Quick Start (Run in 2 Minutes)](#-quick-start-run-in-2-minutes)
2. [Project Architecture](#-project-architecture)
3. [Running the Backend](#-running-the-backend)
4. [Running the Frontend](#-running-the-frontend)
5. [Testing & Simulation (No Hardware Needed)](#-testing--simulation-no-hardware-needed)
6. [Hardware Setup & Wiring](#-hardware-setup--wiring)
7. [ESP32 Firmware Configuration](#-esp32-firmware-configuration)
8. [API Reference](#-api-reference)
9. [Troubleshooting Guide](#-troubleshooting-guide)
10. [Project Structure](#-project-structure)

---

## ⚡ Quick Start (Run in 2 Minutes)

To run the full stack locally, open **two separate terminal windows** (Command Prompt or PowerShell).

### 🖥️ Terminal 1: Backend (FastAPI)

```powershell
# 1. Navigate to backend directory
cd "c:\Projects\Smart Grain Monitor\backend"

# 2. Install dependencies (only required on first run)
python -m pip install -r requirements.txt

# 3. Start the server (Option A: Direct Python)
python main.py

# ...OR (Option B: Uvicorn with auto-reload)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

> **Backend URL:** http://localhost:8000  
> **Interactive Swagger Docs:** http://localhost:8000/docs  
> **Health Check:** http://localhost:8000/api/health

---

### 🌐 Terminal 2: Frontend (Web Dashboard)

```powershell
# 1. Navigate to frontend directory
cd "c:\Projects\Smart Grain Monitor\frontend"

# 2. Start local HTTP server
python -m http.server 5500
```

> **Open in your browser:** **[http://localhost:5500](http://localhost:5500)**

---

## 🏗️ Project Architecture

```
┌─────────────────────┐       Wi-Fi / HTTP POST        ┌─────────────────────────┐       HTTP GET / Polling       ┌────────────────────────┐
│   ESP32 MCU         │  ───────────────────────────▶  │  FastAPI Backend (Py)   │  ◀───────────────────────────  │   Web Dashboard        │
│   + HC-SR04 Sensor  │   JSON: {distance_cm: 4.2}     │  + SQLite Database      │      Live Telemetry & Status   │   (HTML5/CSS3/Canvas)  │
│   + Red/Green LEDs  │                                │  Port: 8000             │                                │   Port: 5500           │
└─────────────────────┘                                └─────────────────────────┘                                └────────────────────────┘
```

- **ESP32 Microcontroller:** Measures grain surface distance and posts telemetry every 3 seconds.
- **FastAPI Backend:** Computes fill percentage, tracks grain status (`NORMAL` / `LOW` / `SENSOR ERROR`), and persists audit logs to SQLite (`grain_monitor.db`).
- **SCADA Web Dashboard:** Real-time 3D silo animation, Canvas spline trend charts, audio alarms, calibration modal, and CSV export.

---

## 🐍 Running the Backend

### Prerequisites
- **Python 3.10+** installed: verify with `python --version`
- **pip** package manager: verify with `python -m pip --version`

### Step-by-Step Instructions

1. Open PowerShell or Command Prompt.
2. Navigate to the `backend/` directory:
   ```powershell
   cd "c:\Projects\Smart Grain Monitor\backend"
   ```
3. Install required Python packages:
   ```powershell
   python -m pip install -r requirements.txt
   ```
   *Installed dependencies:* `fastapi`, `uvicorn[standard]`, `pydantic`, `aiosqlite`, `python-multipart`.

4. Start the backend server:
   - **Method 1 (Recommended):**
     ```powershell
     python main.py
     ```
   - **Method 2 (Uvicorn CLI):**
     ```powershell
     uvicorn main:app --reload --host 0.0.0.0 --port 8000
     ```

### Verification
Once started, you should see console output indicating `Uvicorn running on http://0.0.0.0:8000`. Test it in your browser:
- Health check: [http://localhost:8000/api/health](http://localhost:8000/api/health)
- API documentation: [http://localhost:8000/docs](http://localhost:8000/docs)
- Current status: [http://localhost:8000/api/status](http://localhost:8000/api/status)

> [!NOTE]
> The database file `grain_monitor.db` is automatically created in the `backend/` folder on first launch.

---

## 💻 Running the Frontend

The frontend is built using standard Vanilla HTML5, CSS3, and modern JavaScript (Zero node_modules or build steps needed).

### Option 1: Python Built-in HTTP Server (Recommended)
In a new terminal window:
```powershell
cd "c:\Projects\Smart Grain Monitor\frontend"
python -m http.server 5500
```
Then visit **[http://localhost:5500](http://localhost:5500)** in Google Chrome, Microsoft Edge, or Firefox.

### Option 2: VS Code Live Server
If you use Visual Studio Code:
1. Install the **Live Server** extension (by Ritwick Dey).
2. Right-click [`frontend/index.html`](file:///c:/Projects/Smart%20Grain%20Monitor/frontend/index.html) and select **"Open with Live Server"**.

### Option 3: Direct File Opening
You can double-click `frontend/index.html` to open it directly in a browser.  
*(Note: Running via a local server like `http://localhost:5500` is recommended to prevent local browser CORS/fetch policy restrictions).*

---

## 🧪 Testing & Simulation (No Hardware Needed)

You can demonstrate and test the complete system without any physical ESP32 or sensors connected:

### 1. Built-in Virtual Sensor Rig & Demo Mode
- Click the **"Simulator"** or **"Demo"** button in the dashboard top navigation bar.
- Use the **Distance Slider** to manually vary the grain surface distance:
  - Slide between **0 cm – 2 cm**: Shows near 100% full (Green LED active).
  - Slide above **7 cm**: Triggers **LOW GRAIN** alarm state (Red LED, visual pulse, audio chime).
- Click **"Auto Fill/Empty Ticker"** to run an automated fill-cycle wave.
- Toggle **"Sync Virtual Readings to Server"** to send simulated readings into the actual SQLite backend!

### 2. Send Simulated Readings via PowerShell / curl
With the backend running, send simulated readings directly into the API:

```powershell
# Normal level reading (e.g. 3.5 cm distance in 9.0 cm container -> ~61% fill)
Invoke-RestMethod -Uri "http://localhost:8000/api/readings" -Method POST -ContentType "application/json" -Body '{"device_id":"ESP32-GRAIN-01","distance_cm":3.5}'

# Low grain level reading (e.g. 7.5 cm distance -> ~16% fill -> LOW alarm)
Invoke-RestMethod -Uri "http://localhost:8000/api/readings" -Method POST -ContentType "application/json" -Body '{"device_id":"ESP32-GRAIN-01","distance_cm":7.5}'

# Sensor error reading (-1.0 sentinel)
Invoke-RestMethod -Uri "http://localhost:8000/api/readings" -Method POST -ContentType "application/json" -Body '{"device_id":"ESP32-GRAIN-01","distance_cm":-1.0}'
```

---

## 🔌 Hardware Setup & Wiring

| Component | Specification |
|-----------|--------------|
| **Microcontroller** | ESP32 DevKit (30-pin or 38-pin) |
| **Distance Sensor** | HC-SR04 Ultrasonic Sensor |
| **Red LED** | 5 mm Red LED + 220 Ω resistor |
| **Green LED** | 5 mm Green LED + 220 Ω resistor |
| **Resistors for Divider** | 1 kΩ and 2 kΩ (or 2.2 kΩ) |

### GPIO Pin Map

| Signal | ESP32 GPIO | Description |
|--------|-----------|-------------|
| HC-SR04 `TRIG` | **GPIO 5** | Trigger pulse output (3.3 V) |
| HC-SR04 `ECHO` | **GPIO 18** | Echo return signal (**via voltage divider**) |
| Red LED | **GPIO 25** | Low level / Error indicator |
| Green LED | **GPIO 26** | Normal level indicator |

### ⚠️ ECHO Voltage Divider (Crucial!)
The HC-SR04 `ECHO` pin outputs 5 V logic, but ESP32 GPIOs accept a maximum of 3.3 V. Use a resistor divider:

```
HC-SR04 ECHO pin ───[ 1 kΩ ]───┬─── GPIO 18 (ESP32)
                               │
                            [ 2 kΩ ]
                               │
                              GND
Vout = 5V × (2kΩ / (1kΩ + 2kΩ)) = 3.33 V (Safe for ESP32)
```

### LED Wiring
```
GPIO 25 ─── [220 Ω] ─── (Anode) Red LED (Cathode) ─── GND
GPIO 26 ─── [220 Ω] ─── (Anode) Green LED (Cathode) ─── GND
```

---

## 📡 ESP32 Firmware Configuration

1. Install [Arduino IDE 2.x](https://www.arduino.cc/en/software).
2. Add ESP32 board support:
   - **File → Preferences → Additional Boards Manager URLs**:
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - **Tools → Board → Boards Manager** → Search `esp32` → Install.
3. Install **ArduinoJson** (Tools → Manage Libraries → search `ArduinoJson` by Benoît Blanchon).
4. Open [`firmware/grain_monitor.ino`](file:///c:/Projects/Smart%20Grain%20Monitor/firmware/grain_monitor.ino) and set your Wi-Fi credentials and PC's local LAN IP:

```cpp
const char* WIFI_SSID     = "Your_WiFi_SSID";
const char* WIFI_PASSWORD = "Your_WiFi_Password";

// Replace with your PC's IPv4 address (find using: ipconfig)
const char* BACKEND_URL   = "http://192.168.1.XX:8000";
const char* DEVICE_ID     = "ESP32-GRAIN-01";
```

### Windows Firewall Configuration (For ESP32 LAN Access)
To allow the ESP32 on your Wi-Fi network to send data to your PC's backend on port 8000, open **PowerShell as Administrator** and run:

```powershell
netsh advfirewall firewall add rule name="FastAPI 8000" dir=in action=allow protocol=TCP localport=8000
```

---

## 📡 API Reference

Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Service uptime and status check |
| `GET` | `/api/status` | Current latest reading, container specs, and LED states |
| `POST` | `/api/readings` | Ingest sensor reading from ESP32 or simulator |
| `GET` | `/api/readings?limit=50` | History log of recent readings (max 500) |
| `GET` | `/api/config` | Current container height and low threshold settings |
| `PUT` / `POST` | `/api/config` | Update container dimensions and threshold |

### Sample POST `/api/readings` Payload
```json
{
  "device_id": "ESP32-GRAIN-01",
  "distance_cm": 4.5,
  "red_led": false,
  "green_led": true
}
```

---

## ❓ Troubleshooting Guide

| Issue | Cause | Solution |
|-------|-------|----------|
| **Dashboard shows "Backend Offline"** | FastAPI server is not running or listening | Start backend in Terminal 1 (`python main.py`). Check [http://localhost:8000/api/health](http://localhost:8000/api/health). |
| **`python main.py` exits immediately** | Missing script execution block | Fixed! Running `python main.py` or `uvicorn main:app --reload` will now start the server. |
| **ESP32 cannot connect to Backend** | Wrong IP in firmware or Windows Firewall blocking port 8000 | Find your PC's IP using `ipconfig`, update `BACKEND_URL` in sketch, and run the firewall command above. |
| **Readings show "SENSOR ERROR"** | ECHO/TRIG pins loose or wrong divider | Verify HC-SR04 connections (TRIG: GPIO 5, ECHO: GPIO 18 through divider). |
| **Empty Chart on first launch** | Database has no readings yet | Click **"Simulator"** on the dashboard or run the PowerShell test command to populate initial readings. |

---

## 📂 Project Structure

```
Smart Grain Monitor/
├── backend/
│   ├── main.py              # FastAPI server, business logic & SQLite persistence
│   ├── requirements.txt     # Python dependencies
│   └── grain_monitor.db     # Auto-generated SQLite database
├── frontend/
│   ├── index.html           # SCADA dashboard interface
│   ├── style.css            # Dark industrial styling & 3D silo visuals
│   └── script.js            # Real-time polling, canvas charting & simulator engine
├── firmware/
│   └── grain_monitor.ino    # ESP32 Arduino C++ firmware
└── README.md                # Documentation & quick start guide
```