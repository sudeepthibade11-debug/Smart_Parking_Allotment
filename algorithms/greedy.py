"""
SmartPark – Greedy Slot Allocation Algorithm
=============================================
Strategy: At each decision step, pick the locally optimal (best) available slot
without backtracking.

Cost function per slot:
  cost = w_dist * distance
       + w_type * type_mismatch_penalty
       + w_prio * priority_bonus (negative = better)

The slot with the LOWEST cost wins.

Time Complexity: O(n)  – single pass over n available slots
Space Complexity: O(1) – no extra data structure needed
"""

from typing import List, Dict, Optional, Tuple


# ── Weights (tunable) ────────────────────────────────────────────────────────
W_DISTANCE = 1.0      # cost per metre from entrance
W_TYPE_MISMATCH = 200 # heavy penalty if slot type doesn't fit vehicle
W_PRIORITY = 50       # bonus reduction for high-priority vehicles in priority zones


PRIORITY_RANK = {
    "emergency":      0,
    "accessible":     1,
    "senior_citizen": 2,
    "normal":         3,
}

VEHICLE_COMPAT = {
    # slot_type → set of compatible vehicle types
    "all":  {"car", "bike", "ev"},
    "car":  {"car"},
    "bike": {"bike"},
    "ev":   {"ev"},
}


def _slot_cost(slot: Dict, vehicle_type: str, priority: str) -> float:
    """Compute the greedy cost for a single slot."""
    cost = W_DISTANCE * slot["distance"]

    # Type compatibility penalty
    compatible_types = VEHICLE_COMPAT.get(slot["vehicle_type"], {"car", "bike", "ev"})
    if vehicle_type not in compatible_types:
        cost += W_TYPE_MISMATCH

    # Priority zone bonus: reduce cost for high-priority vehicles
    if slot.get("priority_zone") and PRIORITY_RANK.get(priority, 3) <= 2:
        cost -= W_PRIORITY

    return cost


def greedy_allocate(
    available_slots: List[Dict],
    vehicle_type: str,
    priority: str,
) -> Tuple[Optional[Dict], List[Dict], List[str]]:
    """
    Run greedy allocation and return:
      - best_slot     : the chosen slot dict (or None)
      - scored_slots  : all slots with their cost scores (for display)
      - steps         : human-readable explanation steps
    """
    steps = []
    steps.append(f"GREEDY START — vehicle_type={vehicle_type}, priority={priority}")
    steps.append(f"Total available slots to evaluate: {len(available_slots)}")

    if not available_slots:
        return None, [], steps + ["No available slots found."]

    scored = []
    for slot in available_slots:
        cost = _slot_cost(slot, vehicle_type, priority)
        scored.append({**slot, "cost": round(cost, 2)})
        steps.append(
            f"  Slot {slot['id']} | dist={slot['distance']}m | "
            f"type={slot['vehicle_type']} | cost={round(cost,2)}"
        )

    # Greedy selection: pick the minimum cost slot
    best = min(scored, key=lambda s: s["cost"])

    steps.append(f"GREEDY SELECTION → {best['id']} with lowest cost={best['cost']}")
    return best, scored, steps


def build_recommendation_reasons(best_slot: Dict, vehicle_type: str, priority: str) -> List[str]:
    """Return human-readable reasons why this slot was chosen."""
    reasons = []
    reasons.append(f"✓ Closest compatible available slot ({best_slot['distance']}m from entrance)")

    compat = VEHICLE_COMPAT.get(best_slot["vehicle_type"], {"car", "bike", "ev"})
    if vehicle_type in compat:
        reasons.append(f"✓ Slot type '{best_slot['vehicle_type']}' is fully compatible with your {vehicle_type}")
    else:
        reasons.append(f"⚠ No perfectly typed slot available — nearest compatible used")

    if best_slot.get("priority_zone") and PRIORITY_RANK.get(priority, 3) <= 2:
        reasons.append(f"✓ Priority zone assigned for '{priority.replace('_',' ').title()}' vehicle")

    reasons.append(f"✓ Greedy algorithm selected minimum-cost slot (cost={best_slot.get('cost', 'N/A')})")
    reasons.append(f"✓ Lowest allocation cost among all {len(reasons)} evaluated slots")
    return reasons
