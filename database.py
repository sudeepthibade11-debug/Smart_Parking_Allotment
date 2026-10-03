"""
SmartPark - Database Setup and Management
SQLite database initialization, schema creation, and sample data population.
"""

import sqlite3
import os
from datetime import datetime, timedelta
import random

DB_PATH = os.path.join(os.path.dirname(__file__), 'database', 'parking.db')


def get_connection():
    """Get a database connection with row factory for dict-like access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    """Initialize the database schema and populate with sample data."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = get_connection()
    c = conn.cursor()

    # ── Parking Slots Table ──────────────────────────────────────────────────
    c.execute('''
        CREATE TABLE IF NOT EXISTS parking_slots (
            id          TEXT PRIMARY KEY,
            row_label   TEXT NOT NULL,
            slot_number INTEGER NOT NULL,
            status      TEXT NOT NULL DEFAULT 'available',  -- available | occupied | reserved
            vehicle_type TEXT NOT NULL DEFAULT 'all',       -- all | car | bike | ev
            distance    INTEGER NOT NULL,                   -- metres from entrance
            priority_zone INTEGER NOT NULL DEFAULT 0,       -- 1 = priority zone
            floor       INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL
        )
    ''')

    # ── Vehicles (currently parked) Table ────────────────────────────────────
    c.execute('''
        CREATE TABLE IF NOT EXISTS parked_vehicles (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_no   TEXT NOT NULL UNIQUE,
            vehicle_type TEXT NOT NULL,
            priority     TEXT NOT NULL DEFAULT 'normal',
            slot_id      TEXT NOT NULL,
            entry_time   TEXT NOT NULL,
            FOREIGN KEY (slot_id) REFERENCES parking_slots(id)
        )
    ''')

    # ── Parking History Table ────────────────────────────────────────────────
    c.execute('''
        CREATE TABLE IF NOT EXISTS parking_history (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_no    TEXT NOT NULL,
            vehicle_type  TEXT NOT NULL,
            priority      TEXT NOT NULL,
            slot_id       TEXT NOT NULL,
            entry_time    TEXT NOT NULL,
            exit_time     TEXT,
            duration_mins INTEGER,
            algorithm_used TEXT,
            reason        TEXT
        )
    ''')

    conn.commit()

    # Populate slots only if table is empty
    c.execute("SELECT COUNT(*) FROM parking_slots")
    if c.fetchone()[0] == 0:
        _create_slots(c)
        conn.commit()

    # Populate sample parked vehicles only if table is empty
    c.execute("SELECT COUNT(*) FROM parked_vehicles")
    if c.fetchone()[0] == 0:
        _populate_sample_vehicles(c)
        conn.commit()

    conn.close()
    print(f"[SmartPark] Database ready at {DB_PATH}")


def _create_slots(c):
    """
    Create 60 parking slots across 3 floors.
    Floor 1: rows A–D (original 20 slots)
    Floor 2: rows E–H (20 slots, distances reset from entrance on that floor)
    Floor 3: rows I–L (20 slots)
    """
    now = datetime.now().isoformat()

    slot_configs = [
        # floor, row, num, vehicle_type, distance, priority_zone
        # ── FLOOR 1 ──────────────────────────────────────────────
        (1, "A", 1, "all",  10, 1),
        (1, "A", 2, "all",  15, 1),
        (1, "A", 3, "ev",   20, 0),
        (1, "A", 4, "all",  25, 0),
        (1, "A", 5, "bike", 30, 0),
        (1, "B", 1, "all",  40, 0),
        (1, "B", 2, "all",  45, 0),
        (1, "B", 3, "all",  50, 0),
        (1, "B", 4, "ev",   55, 0),
        (1, "B", 5, "all",  60, 0),
        (1, "C", 1, "all",  70, 0),
        (1, "C", 2, "bike", 75, 0),
        (1, "C", 3, "all",  80, 0),
        (1, "C", 4, "all",  85, 0),
        (1, "C", 5, "all",  90, 0),
        (1, "D", 1, "all",  100, 0),
        (1, "D", 2, "all",  105, 0),
        (1, "D", 3, "all",  110, 0),
        (1, "D", 4, "bike", 115, 0),
        (1, "D", 5, "all",  120, 0),
        # ── FLOOR 2 ──────────────────────────────────────────────
        (2, "E", 1, "all",  10, 1),
        (2, "E", 2, "ev",   15, 1),
        (2, "E", 3, "all",  20, 0),
        (2, "E", 4, "all",  25, 0),
        (2, "E", 5, "bike", 30, 0),
        (2, "F", 1, "all",  40, 0),
        (2, "F", 2, "all",  45, 0),
        (2, "F", 3, "ev",   50, 0),
        (2, "F", 4, "all",  55, 0),
        (2, "F", 5, "all",  60, 0),
        (2, "G", 1, "all",  70, 0),
        (2, "G", 2, "all",  75, 0),
        (2, "G", 3, "bike", 80, 0),
        (2, "G", 4, "all",  85, 0),
        (2, "G", 5, "all",  90, 0),
        (2, "H", 1, "all",  100, 0),
        (2, "H", 2, "ev",   105, 0),
        (2, "H", 3, "all",  110, 0),
        (2, "H", 4, "all",  115, 0),
        (2, "H", 5, "bike", 120, 0),
        # ── FLOOR 3 ──────────────────────────────────────────────
        (3, "I", 1, "ev",   10, 1),
        (3, "I", 2, "ev",   15, 1),
        (3, "I", 3, "all",  20, 0),
        (3, "I", 4, "all",  25, 0),
        (3, "I", 5, "all",  30, 0),
        (3, "J", 1, "all",  40, 0),
        (3, "J", 2, "bike", 45, 0),
        (3, "J", 3, "all",  50, 0),
        (3, "J", 4, "ev",   55, 0),
        (3, "J", 5, "all",  60, 0),
        (3, "K", 1, "all",  70, 0),
        (3, "K", 2, "all",  75, 0),
        (3, "K", 3, "all",  80, 0),
        (3, "K", 4, "bike", 85, 0),
        (3, "K", 5, "all",  90, 0),
        (3, "L", 1, "all",  100, 0),
        (3, "L", 2, "all",  105, 0),
        (3, "L", 3, "ev",   110, 0),
        (3, "L", 4, "all",  115, 0),
        (3, "L", 5, "all",  120, 0),
    ]

    for floor, row, num, vtype, dist, pzone in slot_configs:
        slot_id = f"{row}{num}"
        c.execute('''
            INSERT INTO parking_slots
            (id, row_label, slot_number, status, vehicle_type, distance, priority_zone, floor, created_at)
            VALUES (?, ?, ?, 'available', ?, ?, ?, ?, ?)
        ''', (slot_id, row, num, vtype, dist, pzone, floor, now))


def _populate_sample_vehicles(c):
    """Pre-park sample vehicles across all 3 floors."""
    now = datetime.now()

    samples = [
        # Floor 1
        ("MH12AB1234", "car",  "normal",          "B3", now - timedelta(hours=2)),
        ("KA05CD5678", "bike", "normal",           "C2", now - timedelta(hours=1)),
        ("DL01EV9999", "ev",   "normal",           "A3", now - timedelta(minutes=45)),
        ("TN22XY4321", "car",  "senior_citizen",   "A1", now - timedelta(hours=3)),
        # Floor 2
        ("MH14ZZ0001", "car",  "accessible",       "E1", now - timedelta(minutes=30)),
        ("GJ01AA7777", "ev",   "normal",           "F3", now - timedelta(hours=1, minutes=15)),
        # Floor 3
        ("AP09BB3333", "car",  "normal",           "I3", now - timedelta(hours=4)),
        ("TS07CC5555", "ev",   "normal",           "I1", now - timedelta(minutes=20)),
    ]

    for vno, vtype, priority, slot_id, entry in samples:
        entry_str = entry.isoformat()
        c.execute('''
            INSERT INTO parked_vehicles (vehicle_no, vehicle_type, priority, slot_id, entry_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (vno, vtype, priority, slot_id, entry_str))
        c.execute("UPDATE parking_slots SET status='occupied' WHERE id=?", (slot_id,))
        c.execute('''
            INSERT INTO parking_history
            (vehicle_no, vehicle_type, priority, slot_id, entry_time, exit_time, duration_mins, algorithm_used, reason)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, 'greedy', 'Sample data – pre-parked vehicle')
        ''', (vno, vtype, priority, slot_id, entry_str))


# ── CRUD helpers used by app.py ──────────────────────────────────────────────

def get_all_slots():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM parking_slots ORDER BY row_label, slot_number").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_slot(slot_id: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM parking_slots WHERE id=?", (slot_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_available_slots():
    conn = get_connection()
    rows = conn.execute(
        "SELECT * FROM parking_slots WHERE status='available' ORDER BY distance"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_parked_vehicle(vehicle_no: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM parked_vehicles WHERE vehicle_no=?", (vehicle_no,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_all_parked_vehicles():
    conn = get_connection()
    rows = conn.execute(
        "SELECT pv.*, ps.distance, ps.row_label, ps.slot_number "
        "FROM parked_vehicles pv JOIN parking_slots ps ON pv.slot_id=ps.id"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def park_vehicle(vehicle_no, vehicle_type, priority, slot_id, algorithm_used, reason):
    conn = get_connection()
    now = datetime.now().isoformat()
    try:
        conn.execute('''
            INSERT INTO parked_vehicles (vehicle_no, vehicle_type, priority, slot_id, entry_time)
            VALUES (?, ?, ?, ?, ?)
        ''', (vehicle_no, vehicle_type, priority, slot_id, now))

        conn.execute("UPDATE parking_slots SET status='occupied' WHERE id=?", (slot_id,))

        conn.execute('''
            INSERT INTO parking_history
            (vehicle_no, vehicle_type, priority, slot_id, entry_time, algorithm_used, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (vehicle_no, vehicle_type, priority, slot_id, now, algorithm_used, reason))

        conn.commit()
        return True, "Vehicle parked successfully."
    except sqlite3.IntegrityError:
        return False, f"Vehicle {vehicle_no} is already parked."
    finally:
        conn.close()


def exit_vehicle(vehicle_no: str):
    conn = get_connection()
    vehicle = conn.execute(
        "SELECT * FROM parked_vehicles WHERE vehicle_no=?", (vehicle_no,)
    ).fetchone()

    if not vehicle:
        conn.close()
        return False, f"Vehicle {vehicle_no} is not currently parked.", None

    vehicle = dict(vehicle)
    exit_time = datetime.now()
    entry_time = datetime.fromisoformat(vehicle['entry_time'])
    duration_mins = int((exit_time - entry_time).total_seconds() / 60)

    conn.execute(
        "UPDATE parking_slots SET status='available' WHERE id=?", (vehicle['slot_id'],)
    )
    conn.execute(
        "DELETE FROM parked_vehicles WHERE vehicle_no=?", (vehicle_no,)
    )
    conn.execute('''
        UPDATE parking_history
        SET exit_time=?, duration_mins=?
        WHERE vehicle_no=? AND exit_time IS NULL
    ''', (exit_time.isoformat(), duration_mins, vehicle_no))

    conn.commit()
    conn.close()
    return True, f"Vehicle {vehicle_no} exited successfully.", {**vehicle, 'duration_mins': duration_mins}


def get_history(limit=100):
    conn = get_connection()
    rows = conn.execute('''
        SELECT * FROM parking_history
        ORDER BY entry_time DESC
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_stats():
    conn = get_connection()
    total   = conn.execute("SELECT COUNT(*) FROM parking_slots").fetchone()[0]
    occupied = conn.execute("SELECT COUNT(*) FROM parking_slots WHERE status='occupied'").fetchone()[0]
    reserved = conn.execute("SELECT COUNT(*) FROM parking_slots WHERE status='reserved'").fetchone()[0]
    available = total - occupied - reserved

    today = datetime.now().date().isoformat()
    today_vehicles = conn.execute(
        "SELECT COUNT(*) FROM parking_history WHERE entry_time LIKE ?", (f"{today}%",)
    ).fetchone()[0]

    avg_duration = conn.execute(
        "SELECT AVG(duration_mins) FROM parking_history WHERE duration_mins IS NOT NULL"
    ).fetchone()[0]

    conn.close()
    return {
        "total": total,
        "available": available,
        "occupied": occupied,
        "reserved": reserved,
        "today_vehicles": today_vehicles,
        "avg_duration": round(avg_duration or 0, 1),
        "utilization": round((occupied / total * 100) if total else 0, 1),
    }


if __name__ == "__main__":
    init_db()
