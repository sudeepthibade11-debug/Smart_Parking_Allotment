"""
SmartPark - Flask Application
==============================
All API routes and page rendering for the Smart Parking Slot Allocator.
"""

from flask import Flask, render_template, request, jsonify
from datetime import datetime
import re

# Indian vehicle registration: 2-letter state + 2-digit district + 1-3 letters + 4 digits
_VEHICLE_NO_RE = re.compile(
    r'^(AN|AP|AR|AS|BR|CH|CG|DD|DL|DN|GA|GJ|HP|HR|JH|JK|KA|KL|LA|LD'
    r'|MH|ML|MN|MP|MZ|NL|OD|PB|PY|RJ|SK|TN|TG|TR|TS|UK|UP|WB)\d{2}[A-Z]{1,3}\d{4}$'
)

def is_valid_vehicle_no(vehicle_no: str) -> bool:
    return bool(_VEHICLE_NO_RE.match(vehicle_no.strip().upper().replace(' ', '')))
from database import (
    init_db, get_all_slots, get_slot, get_available_slots,
    get_parked_vehicle, get_all_parked_vehicles,
    park_vehicle, exit_vehicle, get_history, get_stats
)
from algorithms.greedy import greedy_allocate, build_recommendation_reasons
from algorithms.priority_queue import build_priority_queue
from algorithms.binary_search import (
    binary_search_slot_by_id, binary_search_vehicle, binary_search_nearest_distance
)

app = Flask(__name__)

# ── Page Routes ──────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/parking")
def parking():
    return render_template("parking.html")

@app.route("/history")
def history():
    return render_template("history.html")

# ── API: Stats ────────────────────────────────────────────────────────────────

@app.route("/api/stats")
def api_stats():
    return jsonify(get_stats())

# ── API: Health check ─────────────────────────────────────────────────────────

@app.route("/api/health")
def api_health():
    """Lightweight liveness probe. Frontend polls this to show SYSTEM ONLINE/OFFLINE."""
    try:
        # Do a real DB round-trip so the health check reflects actual service state
        stats = get_stats()
        return jsonify({
            "status": "ok",
            "service": "SmartPark",
            "timestamp": datetime.now().isoformat(),
            "slots_total": stats["total"],
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# ── API: Slots ────────────────────────────────────────────────────────────────

@app.route("/api/slots")
def api_slots():
    return jsonify(get_all_slots())

@app.route("/api/slots/<slot_id>")
def api_slot_detail(slot_id):
    slot = get_slot(slot_id.upper())
    if not slot:
        return jsonify({"error": f"Slot {slot_id} not found"}), 404
    return jsonify(slot)

# ── API: Allocate (Find Best Slot) ───────────────────────────────────────────

@app.route("/api/allocate", methods=["POST"])
def api_allocate():
    data = request.get_json(force=True)
    vehicle_no   = data.get("vehicle_no", "").strip().upper()
    vehicle_type = data.get("vehicle_type", "car").lower()
    priority     = data.get("priority", "normal").lower()
    preferred_area = data.get("preferred_area", "").strip().upper()

    # Validation
    if not vehicle_no:
        return jsonify({"error": "Vehicle number is required."}), 400
    if not is_valid_vehicle_no(vehicle_no):
        return jsonify({"error": f"'{vehicle_no}' is not a valid Indian vehicle registration number. "
                                  "Format: 2-letter state code + 2-digit district + 1–3 letters + 4 digits "
                                  "(e.g. MH12AB1234)."}), 400
    if vehicle_type not in ("car", "bike", "ev"):
        return jsonify({"error": "Invalid vehicle type. Choose car, bike, or ev."}), 400
    if priority not in ("normal", "senior_citizen", "accessible", "emergency"):
        return jsonify({"error": "Invalid priority level."}), 400

    # Check duplicate
    existing = get_parked_vehicle(vehicle_no)
    if existing:
        return jsonify({"error": f"Vehicle {vehicle_no} is already parked in slot {existing['slot_id']}."}), 409

    available = get_available_slots()
    if not available:
        return jsonify({"error": "No parking slots available. Parking lot is full!"}), 503

    all_slots_list = get_all_slots()

    # ── STEP 1: Binary Search — check if preferred slot requested ─────────
    bs_steps = []
    preferred_slot = None
    if preferred_area:
        preferred_slot, _, bs_steps = binary_search_slot_by_id(all_slots_list, preferred_area)
        if preferred_slot and preferred_slot["status"] == "available":
            # Check compatibility
            from algorithms.greedy import VEHICLE_COMPAT
            compat = VEHICLE_COMPAT.get(preferred_slot["vehicle_type"], {"car","bike","ev"})
            if vehicle_type not in compat:
                preferred_slot = None
                bs_steps.append(f"Preferred slot {preferred_area} incompatible with {vehicle_type}. Ignored.")
            else:
                bs_steps.append(f"Preferred slot {preferred_area} is available and compatible.")
        elif preferred_slot:
            bs_steps.append(f"Preferred slot {preferred_area} is {preferred_slot['status']}. Running allocation.")
            preferred_slot = None
        else:
            bs_steps.append(f"Preferred slot {preferred_area} not found. Running allocation.")

    # ── STEP 2: Priority Queue ────────────────────────────────────────────
    pq, scored_slots, pq_best, pq_steps = build_priority_queue(available, vehicle_type, priority)

    # ── STEP 3: Greedy Selection ──────────────────────────────────────────
    best_slot, greedy_scored, greedy_steps = greedy_allocate(available, vehicle_type, priority)

    # Final decision: preferred > pq_best (should match greedy best)
    final_slot = preferred_slot or best_slot

    if not final_slot:
        return jsonify({"error": "No compatible slot found for your vehicle type."}), 503

    # Build recommendation reasons
    reasons = build_recommendation_reasons(final_slot, vehicle_type, priority)

    # Complexity data
    complexity = {
        "binary_search": {"notation": "O(log n)", "n": len(all_slots_list), "ops": "Slot ID lookup"},
        "priority_queue": {"notation": "O(n log n) build / O(log n) extract", "n": len(available), "ops": "Slot ranking"},
        "greedy": {"notation": "O(n)", "n": len(available), "ops": "Cost minimisation"},
    }

    return jsonify({
        "best_slot": final_slot,
        "vehicle_no": vehicle_no,
        "vehicle_type": vehicle_type,
        "priority": priority,
        "reasons": reasons,
        "algorithm_steps": {
            "binary_search": bs_steps,
            "priority_queue": pq_steps,
            "greedy": greedy_steps,
        },
        "priority_queue_ranked": scored_slots,
        "greedy_scored": greedy_scored,
        "complexity": complexity,
    })

# ── API: Park Vehicle ─────────────────────────────────────────────────────────

@app.route("/api/park", methods=["POST"])
def api_park():
    data = request.get_json(force=True)
    vehicle_no   = data.get("vehicle_no", "").strip().upper()
    vehicle_type = data.get("vehicle_type", "car").lower()
    priority     = data.get("priority", "normal").lower()
    slot_id      = data.get("slot_id", "").strip().upper()
    reasons      = data.get("reasons", [])

    if not vehicle_no or not slot_id:
        return jsonify({"error": "vehicle_no and slot_id are required."}), 400
    if not is_valid_vehicle_no(vehicle_no):
        return jsonify({"error": f"'{vehicle_no}' is not a valid Indian vehicle registration number."}), 400

    slot = get_slot(slot_id)
    if not slot:
        return jsonify({"error": f"Slot {slot_id} not found."}), 404
    if slot["status"] != "available":
        return jsonify({"error": f"Slot {slot_id} is no longer available."}), 409

    reason_text = " | ".join(reasons) if reasons else "Allocated by SmartPark algorithm"
    ok, msg = park_vehicle(vehicle_no, vehicle_type, priority, slot_id, "greedy+pq", reason_text)

    if ok:
        return jsonify({"success": True, "message": msg, "slot": get_slot(slot_id)})
    return jsonify({"error": msg}), 409

# ── API: Exit Vehicle ─────────────────────────────────────────────────────────

@app.route("/api/exit", methods=["POST"])
def api_exit():
    data = request.get_json(force=True)
    vehicle_no = data.get("vehicle_no", "").strip().upper()

    if not vehicle_no:
        return jsonify({"error": "Vehicle number is required."}), 400

    # Binary search for the vehicle
    all_vehicles = get_all_parked_vehicles()
    found_vehicle, idx, bs_steps = binary_search_vehicle(all_vehicles, vehicle_no)

    if not found_vehicle:
        return jsonify({
            "error": f"Vehicle {vehicle_no} is not currently parked.",
            "binary_search_steps": bs_steps
        }), 404

    ok, msg, vehicle_data = exit_vehicle(vehicle_no)
    if ok:
        return jsonify({
            "success": True,
            "message": msg,
            "vehicle": vehicle_data,
            "freed_slot": vehicle_data["slot_id"],
            "duration_mins": vehicle_data["duration_mins"],
            "binary_search_steps": bs_steps,
        })
    return jsonify({"error": msg}), 500

# ── API: Vehicles (currently parked) ─────────────────────────────────────────

@app.route("/api/vehicles")
def api_vehicles():
    return jsonify(get_all_parked_vehicles())

@app.route("/api/vehicles/<vehicle_no>")
def api_vehicle_detail(vehicle_no):
    all_vehicles = get_all_parked_vehicles()
    found, idx, bs_steps = binary_search_vehicle(all_vehicles, vehicle_no.upper())
    if not found:
        return jsonify({"error": f"Vehicle {vehicle_no} not found", "bs_steps": bs_steps}), 404
    return jsonify({"vehicle": found, "bs_steps": bs_steps})

# ── API: History ──────────────────────────────────────────────────────────────

@app.route("/api/history")
def api_history():
    return jsonify(get_history(100))

# ── API: Algorithm demo (for the Algorithms page) ────────────────────────────

@app.route("/api/algorithm-demo", methods=["POST"])
def api_algorithm_demo():
    data = request.get_json(force=True)
    vehicle_type = data.get("vehicle_type", "car")
    priority     = data.get("priority", "normal")
    search_id    = data.get("search_id", "")

    available = get_available_slots()
    all_slots = get_all_slots()

    _, scored_pq, pq_best, pq_steps = build_priority_queue(available, vehicle_type, priority)
    best_greedy, greedy_scored, greedy_steps = greedy_allocate(available, vehicle_type, priority)

    bs_steps = []
    bs_result = None
    if search_id:
        bs_result, _, bs_steps = binary_search_slot_by_id(all_slots, search_id.upper())

    return jsonify({
        "priority_queue": {"steps": pq_steps, "ranked": scored_pq, "best": pq_best},
        "greedy": {"steps": greedy_steps, "scored": greedy_scored, "best": best_greedy},
        "binary_search": {"steps": bs_steps, "result": bs_result},
    })


if __name__ == "__main__":
    init_db()
    print("\n" + "="*50)
    print("  SmartPark is running!")
    print("  Open http://127.0.0.1:5000 in your browser")
    print("="*50 + "\n")
    app.run(debug=True, port=5000)
