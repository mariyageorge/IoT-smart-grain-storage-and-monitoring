/*
 * ═══════════════════════════════════════════════════════════════════════
 *  Smart Grain Storage Monitoring System — ESP32 Firmware
 *  File   : grain_monitor.ino
 *  Target : Generic ESP32 development board (Arduino IDE 2.x)
 *
 *  Hardware wiring:
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │ HC-SR04 TRIG  → GPIO 5  (3.3 V signal, direct)                  │
 *  │ HC-SR04 ECHO  → Voltage divider → GPIO 18  (see note below)     │
 *  │ Red  LED anode → GPIO 25 → 220 Ω resistor → LED cathode → GND   │
 *  │ Green LED anode → GPIO 26 → 220 Ω resistor → LED cathode → GND  │
 *  │ HC-SR04 VCC   → 5 V (ESP32 VIN / external 5 V rail)             │
 *  │ HC-SR04 GND   → GND                                              │
 *  └──────────────────────────────────────────────────────────────────┘
 *
 *  VOLTAGE DIVIDER for HC-SR04 ECHO (5 V → 3.3 V):
 *  ┌──────────────────────────────────────────────────────────────────┐
 *  │  HC-SR04 ECHO pin                                                │
 *  │       │                                                           │
 *  │      [R1 = 1kΩ]   ← top resistor                                │
 *  │       │                                                           │
 *  │       ├──────────────── GPIO 18 (ESP32 INPUT)                    │
 *  │       │                                                           │
 *  │      [R2 = 2kΩ]   ← bottom resistor                             │
 *  │       │                                                           │
 *  │      GND                                                          │
 *  │                                                                   │
 *  │  Vout = Vin × R2/(R1+R2) = 5 V × 2k/(1k+2k) = 3.33 V ✓         │
 *  │  Use nearest standard values: 1 kΩ + 2 kΩ (or 2.2 kΩ)          │
 *  └──────────────────────────────────────────────────────────────────┘
 *
 *  Libraries required (Arduino IDE Library Manager):
 *   — WiFi.h        (bundled with ESP32 Arduino core)
 *   — HTTPClient.h  (bundled with ESP32 Arduino core)
 *   — ArduinoJson   (install via Library Manager: "ArduinoJson" by Benoît Blanchon)
 *
 *  Setup steps:
 *   1. Install ESP32 board support:
 *      File → Preferences → Additional Boards Manager URLs →
 *      add: https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *      Then: Tools → Board → Boards Manager → search "esp32" → install
 *   2. Select board: Tools → Board → esp32 → "ESP32 Dev Module"
 *   3. Install ArduinoJson library.
 *   4. Fill in WIFI_SSID, WIFI_PASSWORD, and BACKEND_URL below.
 *   5. BACKEND_URL must be your computer's LAN IP (NOT localhost).
 *      Example: "http://192.168.1.42:8000"
 *   6. Upload and open Serial Monitor at 115200 baud.
 * ═══════════════════════════════════════════════════════════════════════
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

/* ─── USER CONFIG — edit these values ───────────────────────────────── */
const char* WIFI_SSID       = "Mathilel";
const char* WIFI_PASSWORD   = "george2371";
// Use your computer's LAN IP address, NOT localhost or 127.0.0.1
const char* BACKEND_URL     = "http://192.168.1.8:8000";
const char* DEVICE_ID       = "ESP32-GRAIN-01";
const float CONTAINER_HEIGHT_CM = 9.0f;   // Physical container height in cm
const float LOW_THRESHOLD_CM    = 2.0f;   // Below 2.0 cm grain depth is LOW (distance >= 7.0 cm)
const float LOW_THRESHOLD_PCT   = 22.2f;  // (2.0 / 9.0) * 100 = 22.22%
/* ────────────────────────────────────────────────────────────────────── */

/* ─── GPIO Pins ─────────────────────────────────────────────────────── */
#define PIN_TRIG    5
#define PIN_ECHO    18
#define PIN_RED_LED 25
#define PIN_GRN_LED 26

/* ─── Timing ────────────────────────────────────────────────────────── */
#define MEASUREMENT_INTERVAL_MS  5000    // time between readings (ms)
#define WIFI_CONNECT_TIMEOUT_MS  15000   // max wait for Wi-Fi (ms)
#define HTTP_TIMEOUT_MS          8000    // HTTP request timeout (ms)
#define ECHO_TIMEOUT_US          30000   // ~5 m max range pulse timeout

/* ─── Sensor error sentinel (must match backend SENSOR_ERROR_DISTANCE) */
#define SENSOR_ERROR_DISTANCE    -1.0f

/* ─── LED logic ─────────────────────────────────────────────────────── */
// Red  ON  → grain LOW or SENSOR ERROR
// Green ON  → grain NORMAL
enum GrainStatus { STATUS_NORMAL, STATUS_LOW, STATUS_ERROR };

/* ══════════════════════════════════════════════════════════════════════
   connectWiFi() — with timeout and retry feedback on Serial
   ══════════════════════════════════════════════════════════════════════ */
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  Serial.print(" ");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_CONNECT_TIMEOUT_MS) {
      Serial.println(" TIMEOUT");
      return false;
    }
    Serial.print(".");
    delay(500);
  }
  Serial.println();
  Serial.print("[WiFi] Connected! IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

/* ══════════════════════════════════════════════════════════════════════
   measureDistance() — HC-SR04 single-shot measurement
   Returns distance in cm, or SENSOR_ERROR_DISTANCE on timeout/error.
   ══════════════════════════════════════════════════════════════════════ */
float measureDistance() {
  // 1. Send a 10 µs TRIG pulse
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(4);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  // 2. Measure ECHO pulse width
  unsigned long pulseDuration = pulseIn(PIN_ECHO, HIGH, ECHO_TIMEOUT_US);

  if (pulseDuration == 0) {
    Serial.println("[Sensor] ECHO timeout — no object detected or wiring error");
    return SENSOR_ERROR_DISTANCE;
  }

  // 3. Convert: speed of sound ≈ 0.034 cm/µs; divide by 2 for one-way
  float distance = (float)pulseDuration * 0.034f / 2.0f;

  // 4. Sanity check: HC-SR04 range is 2 cm–400 cm
  if (distance < 2.0f || distance > 400.0f) {
    Serial.printf("[Sensor] Reading out of range: %.1f cm\n", distance);
    return SENSOR_ERROR_DISTANCE;
  }

  return distance;
}

/* ══════════════════════════════════════════════════════════════════════
   controlLEDs() — set LED state based on grain status
   ══════════════════════════════════════════════════════════════════════ */
void controlLEDs(bool redOn, bool greenOn) {
  digitalWrite(PIN_RED_LED, redOn  ? HIGH : LOW);
  digitalWrite(PIN_GRN_LED, greenOn ? HIGH : LOW);
}

/* ══════════════════════════════════════════════════════════════════════
   postReading() — POST JSON payload to FastAPI /api/readings
   Returns true on HTTP 201, false otherwise.
   ══════════════════════════════════════════════════════════════════════ */
bool postReading(float distanceCm, bool redLed, bool greenLed) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Not connected — skipping POST");
    return false;
  }

  /* Build JSON payload */
  StaticJsonDocument<256> doc;
  doc["device_id"]   = DEVICE_ID;
  doc["distance_cm"] = distanceCm;
  doc["red_led"]     = redLed;
  doc["green_led"]   = greenLed;
  // timestamp is optional; the server fills it in if absent

  String body;
  serializeJson(doc, body);

  String url = String(BACKEND_URL) + "/api/readings";

  HTTPClient http;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(HTTP_TIMEOUT_MS);

  Serial.print("[HTTP] POST to ");
  Serial.print(url);
  Serial.print(" → ");
  Serial.println(body);

  int statusCode = http.POST(body);

  if (statusCode == 201) {
    String response = http.getString();
    Serial.print("[HTTP] 201 Created: ");
    Serial.println(response);

    // Sync LEDs with backend calculation
    StaticJsonDocument<512> resDoc;
    DeserializationError err = deserializeJson(resDoc, response);
    if (!err && resDoc.containsKey("red_led") && resDoc.containsKey("green_led")) {
      bool srvRed = resDoc["red_led"].as<bool>();
      bool srvGreen = resDoc["green_led"].as<bool>();
      controlLEDs(srvRed, srvGreen);
    }

    http.end();
    return true;
  } else {
    Serial.printf("[HTTP] Error %d: %s\n", statusCode, http.getString().c_str());
    http.end();
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════
   setup()
   ══════════════════════════════════════════════════════════════════════ */
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("══════════════════════════════════════════════");
  Serial.println(" Smart Grain Storage Monitoring System");
  Serial.println(" ESP32 Firmware v1.0");
  Serial.println("══════════════════════════════════════════════");

  /* GPIO setup */
  pinMode(PIN_TRIG,    OUTPUT);
  pinMode(PIN_ECHO,    INPUT);
  pinMode(PIN_RED_LED, OUTPUT);
  pinMode(PIN_GRN_LED, OUTPUT);

  /* LEDs off initially */
  digitalWrite(PIN_RED_LED, LOW);
  digitalWrite(PIN_GRN_LED, LOW);
  digitalWrite(PIN_TRIG,    LOW);

  /* Start-up LED blink to confirm GPIO works */
  for (int i = 0; i < 3; i++) {
    digitalWrite(PIN_RED_LED, HIGH);
    digitalWrite(PIN_GRN_LED, HIGH);
    delay(150);
    digitalWrite(PIN_RED_LED, LOW);
    digitalWrite(PIN_GRN_LED, LOW);
    delay(150);
  }

  /* Connect Wi-Fi */
  if (!connectWiFi()) {
    // Signal Wi-Fi failure with rapid red blink — device will retry in loop()
    Serial.println("[WiFi] Initial connection failed. Will retry in loop.");
    for (int i = 0; i < 10; i++) {
      digitalWrite(PIN_RED_LED, HIGH); delay(100);
      digitalWrite(PIN_RED_LED, LOW);  delay(100);
    }
  }

  Serial.println("[Setup] Complete. Starting measurements.");
}

/* ══════════════════════════════════════════════════════════════════════
   loop()
   ══════════════════════════════════════════════════════════════════════ */
void loop() {
  unsigned long loopStart = millis();

  /* ── 1. Wi-Fi reconnection ────────────────────────────────────────── */
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connection lost. Reconnecting…");
    controlLEDs(true, false);    // Red = error / disconnected
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      delay(5000);               // back-off before next attempt
      return;
    }
  }

  /* ── 2. Measure distance ─────────────────────────────────────────── */
  float distance = measureDistance();

  Serial.print("[Sensor] Distance: ");
  if (distance == SENSOR_ERROR_DISTANCE) {
    Serial.println("SENSOR ERROR");
  } else {
    Serial.printf("%.1f cm\n", distance);
  }

  /* ── 3. Determine LED state (local, immediate feedback) ──────────── */
  bool redOn   = false;
  bool greenOn = false;

  if (distance == SENSOR_ERROR_DISTANCE) {
    redOn   = true;
    greenOn = false;
  } else {
    // Grain Depth = Container Height - Distance
    float grainDepth = CONTAINER_HEIGHT_CM - distance;
    if (grainDepth < 0.0f) grainDepth = 0.0f;
    if (grainDepth > CONTAINER_HEIGHT_CM) grainDepth = CONTAINER_HEIGHT_CM;
    float fillPct = (grainDepth / CONTAINER_HEIGHT_CM) * 100.0f;

    // LOW alert if grain depth is below 2.0 cm
    if (grainDepth <= LOW_THRESHOLD_CM) {
      redOn   = true;   // Low grain warning (<= 2 cm)
      greenOn = false;
    } else {
      redOn   = false;
      greenOn = true;   // Normal grain level (> 2 cm)
    }
  }

  controlLEDs(redOn, greenOn);
  Serial.printf("[LED State] %s --> RED LED (GPIO 25): %s | GREEN LED (GPIO 26): %s\n",
                redOn ? "LOW / ALERT" : "NORMAL",
                redOn ? "HIGH (ON)" : "LOW (OFF)",
                greenOn ? "HIGH (ON)" : "LOW (OFF)");

  /* ── 4. POST reading to FastAPI ──────────────────────────────────── */
  bool ok = postReading(distance, redOn, greenOn);
  if (!ok) {
    Serial.println("[Main] POST failed — data not stored this cycle.");
    // Flash both LEDs briefly to signal upload failure
    controlLEDs(false, false);
    delay(200);
    controlLEDs(redOn, greenOn);
  }

  /* ── 5. Wait until next measurement interval ─────────────────────── */
  unsigned long elapsed = millis() - loopStart;
  if (elapsed < MEASUREMENT_INTERVAL_MS) {
    delay(MEASUREMENT_INTERVAL_MS - elapsed);
  }
}
