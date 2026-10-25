"""
Smart Grain Storage Monitoring System — FastAPI Backend
Author  : College Demo Project
Database: SQLite (aiosqlite)
"""

from __future__ import annotations

import sqlite3
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, Optional

# pyrefly: ignore[missing-import]
import aiosqlite
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# ─────────────────────────────────────────────────────────────
# Constants & defaults
# ─────────────────────────────────────────────────────────────

DB_PATH = "grain_monitor.db"

DEFAULT_CONFIG = {
    "container_height_cm": 9.0,   # full container height in cm
    "low_threshold_pct": 22.2,    # 2.0 cm out of 9.0 cm → LOW status when depth <= 2 cm
    "device_id": "ESP32-GRAIN-01",
}

SENSOR_ERROR_DISTANCE = -1.0        # sentinel value from firmware


# ─────────────────────────────────────────────────────────────
# Database helpers
# ─────────────────────────────────────────────────────────────

def _init_db_sync() -> None:
    """Create tables synchronously at startup (blocking is fine here)."""
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    # Readings table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS readings (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id     TEXT    NOT NULL,
            distance_cm   REAL    NOT NULL,
            fill_pct      REAL,
            grain_status  TEXT    NOT NULL,
            red_led       INTEGER NOT NULL DEFAULT 0,
            green_led     INTEGER NOT NULL DEFAULT 0,
            timestamp     TEXT    NOT NULL
        )
    """)

    # Config table (single-row key-value store)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )
    """)

    # Seed defaults if missing
    for key, value in DEFAULT_CONFIG.items():
        cur.execute(
            "INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)",
            (key, str(value)),
        )

    conn.commit()
    conn.close()


async def get_config_dict(db: aiosqlite.Connection) -> dict:
    async with db.execute("SELECT key, value FROM config") as cur:
        rows = await cur.fetchall()
    cfg: dict = {row[0]: row[1] for row in rows}
    return cfg


# ─────────────────────────────────────────────────────────────
# Lifespan (startup / shutdown)
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    _init_db_sync()
    print("Database initialised:", DB_PATH)
    yield
    print("Backend shutting down.")


# ─────────────────────────────────────────────────────────────
# App instance
# ─────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart Grain Storage Monitoring System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # permissive for local demo
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────

class ReadingIn(BaseModel):
    """Payload posted by the ESP32 firmware."""

    device_id: str = Field(..., min_length=1, max_length=64)
    distance_cm: float = Field(...)
    red_led: bool = False
    green_led: bool = False
    timestamp: Optional[str] = None

    @field_validator("distance_cm")
    @classmethod
    def validate_distance(cls, v: float) -> float:
        if v != SENSOR_ERROR_DISTANCE and not (0.0 < v <= 500.0):
            raise ValueError(
                f"distance_cm must be between 0 and 500 or equal to {SENSOR_ERROR_DISTANCE} (error sentinel)"
            )
        return round(v, 2)


class ReadingOut(BaseModel):
    id: int
    device_id: str
    distance_cm: float
    fill_pct: Optional[float]
    grain_status: str
    red_led: bool
    green_led: bool
    timestamp: str


class ConfigOut(BaseModel):
    container_height_cm: float
    low_threshold_pct: float
    device_id: str


class ConfigIn(BaseModel):
    container_height_cm: Optional[float] = Field(None, gt=0, le=1000)
    low_threshold_pct: Optional[float] = Field(None, ge=0, le=100)


class StatusOut(BaseModel):
    device_id: str
    grain_status: str
    distance_cm: Optional[float]
    fill_pct: Optional[float]
    red_led: bool
    green_led: bool
    last_reading_ts: Optional[str]
    container_height_cm: float
    low_threshold_pct: float


class HealthOut(BaseModel):
    status: str
    timestamp: str
    uptime_s: float


# ─────────────────────────────────────────────────────────────
# Business logic
# ─────────────────────────────────────────────────────────────

_start_time = time.monotonic()


def compute_grain_info(
    distance_cm: float,
    container_height_cm: float,
    low_threshold_pct: float,
) -> tuple:
    """
    Returns (fill_pct, grain_status, red_led, green_led).
    fill_pct  : 0-100 rounded to 1 dp, or None on sensor error
    grain_status: 'LOW' | 'NORMAL' | 'SENSOR ERROR'
    """
    if distance_cm == SENSOR_ERROR_DISTANCE:
        return None, "SENSOR ERROR", True, False

    grain_depth_cm = container_height_cm - distance_cm
    grain_depth_cm = max(0.0, min(grain_depth_cm, container_height_cm))

    fill_pct = round((grain_depth_cm / container_height_cm) * 100.0, 1)

    if fill_pct < low_threshold_pct:
        return fill_pct, "LOW", True, False
    return fill_pct, "NORMAL", False, True


# ─────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────

@app.get("/api/health", response_model=HealthOut, tags=["System"])
async def health():
    return HealthOut(
        status="ok",
        timestamp=datetime.now(timezone.utc).isoformat(),
        uptime_s=round(time.monotonic() - _start_time, 2),
    )


@app.get("/api/status", response_model=StatusOut, tags=["Monitoring"])
async def get_status():
    async with aiosqlite.connect(DB_PATH) as db:
        cfg = await get_config_dict(db)
        container_h = float(cfg["container_height_cm"])
        low_thresh = float(cfg["low_threshold_pct"])
        dev_id = cfg["device_id"]

        async with db.execute(
            "SELECT distance_cm, fill_pct, grain_status, red_led, green_led, timestamp "
            "FROM readings ORDER BY id DESC LIMIT 1"
        ) as cur:
            row = await cur.fetchone()

    if row is None:
        return StatusOut(
            device_id=dev_id,
            grain_status="NO DATA",
            distance_cm=None,
            fill_pct=None,
            red_led=False,
            green_led=False,
            last_reading_ts=None,
            container_height_cm=container_h,
            low_threshold_pct=low_thresh,
        )

    distance_cm, fill_pct, grain_status, red_led, green_led, ts = row
    return StatusOut(
        device_id=dev_id,
        grain_status=grain_status,
        distance_cm=distance_cm,
        fill_pct=fill_pct,
        red_led=bool(red_led),
        green_led=bool(green_led),
        last_reading_ts=ts,
        container_height_cm=container_h,
        low_threshold_pct=low_thresh,
    )


@app.post("/api/readings", response_model=ReadingOut, status_code=201, tags=["Monitoring"])
@app.post("/api/reading", response_model=ReadingOut, status_code=201, include_in_schema=False)
async def post_reading(payload: ReadingIn):
    ts = payload.timestamp or datetime.now(timezone.utc).isoformat()

    async with aiosqlite.connect(DB_PATH) as db:
        cfg = await get_config_dict(db)
        container_h = float(cfg["container_height_cm"])
        low_thresh = float(cfg["low_threshold_pct"])

        fill_pct, grain_status, red_led, green_led = compute_grain_info(
            payload.distance_cm, container_h, low_thresh
        )

        async with db.execute(
            """
            INSERT INTO readings
                (device_id, distance_cm, fill_pct, grain_status, red_led, green_led, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.device_id,
                payload.distance_cm,
                fill_pct,
                grain_status,
                int(red_led),
                int(green_led),
                ts,
            ),
        ) as cur:
            row_id = cur.lastrowid
        await db.commit()

    return ReadingOut(
        id=row_id,
        device_id=payload.device_id,
        distance_cm=payload.distance_cm,
        fill_pct=fill_pct,
        grain_status=grain_status,
        red_led=red_led,
        green_led=green_led,
        timestamp=ts,
    )


@app.get("/api/readings", response_model=List[ReadingOut], tags=["Monitoring"])
@app.get("/api/reading", response_model=List[ReadingOut], include_in_schema=False)
async def get_readings(limit: int = 50):
    if limit < 1 or limit > 500:
        raise HTTPException(status_code=400, detail="limit must be 1-500")

    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id, device_id, distance_cm, fill_pct, grain_status, red_led, green_led, timestamp "
            "FROM readings ORDER BY id DESC LIMIT ?",
            (limit,),
        ) as cur:
            rows = await cur.fetchall()

    return [
        ReadingOut(
            id=r[0],
            device_id=r[1],
            distance_cm=r[2],
            fill_pct=r[3],
            grain_status=r[4],
            red_led=bool(r[5]),
            green_led=bool(r[6]),
            timestamp=r[7],
        )
        for r in rows
    ]


@app.get("/api/config", response_model=ConfigOut, tags=["Configuration"])
async def get_config():
    async with aiosqlite.connect(DB_PATH) as db:
        cfg = await get_config_dict(db)
    return ConfigOut(
        container_height_cm=float(cfg["container_height_cm"]),
        low_threshold_pct=float(cfg["low_threshold_pct"]),
        device_id=cfg["device_id"],
    )


@app.put("/api/config", response_model=ConfigOut, tags=["Configuration"])
@app.post("/api/config", response_model=ConfigOut, tags=["Configuration"])
async def update_config(payload: ConfigIn):
    async with aiosqlite.connect(DB_PATH) as db:
        if payload.container_height_cm is not None:
            await db.execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES ('container_height_cm', ?)",
                (str(payload.container_height_cm),),
            )
        if payload.low_threshold_pct is not None:
            await db.execute(
                "INSERT OR REPLACE INTO config (key, value) VALUES ('low_threshold_pct', ?)",
                (str(payload.low_threshold_pct),),
            )
        await db.commit()
        cfg = await get_config_dict(db)

    return ConfigOut(
        container_height_cm=float(cfg["container_height_cm"]),
        low_threshold_pct=float(cfg["low_threshold_pct"]),
        device_id=cfg["device_id"],
    )


if __name__ == "__main__":
    import uvicorn
    print("Starting Smart Grain Monitor FastAPI Backend on http://0.0.0.0:8000 ...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

