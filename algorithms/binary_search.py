"""
SmartPark - Binary Search Implementation
==========================================
Used for:
  1. Searching a slot by ID in a sorted slot list
  2. Searching a vehicle record by vehicle number
  3. Finding the nearest slot >= a target distance

Time Complexity : O(log n)
Space Complexity: O(1)

All lists must be sorted before calling these functions.
"""

from typing import List, Dict, Optional, Tuple


def binary_search_slot_by_id(slots: List[Dict], target_id: str) -> Tuple[Optional[Dict], int, List[str]]:
    """
    Binary search on a list of slots sorted by slot ID (alphabetically).
    Returns (slot_dict or None, index_found, steps_log).
    """
    steps = []
    sorted_slots = sorted(slots, key=lambda s: s["id"])
    ids = [s["id"] for s in sorted_slots]

    lo, hi = 0, len(ids) - 1
    steps.append(f"Binary Search for slot_id='{target_id}' over {len(ids)} slots")
    steps.append(f"Sorted slot IDs: {ids}")

    while lo <= hi:
        mid = (lo + hi) // 2
        steps.append(f"  lo={lo}, hi={hi}, mid={mid} → checking '{ids[mid]}'")

        if ids[mid] == target_id:
            steps.append(f"  FOUND '{target_id}' at index {mid}")
            return sorted_slots[mid], mid, steps
        elif ids[mid] < target_id:
            steps.append(f"  '{ids[mid]}' < '{target_id}' → search RIGHT half")
            lo = mid + 1
        else:
            steps.append(f"  '{ids[mid]}' > '{target_id}' → search LEFT half")
            hi = mid - 1

    steps.append(f"  NOT FOUND: '{target_id}' does not exist")
    return None, -1, steps


def binary_search_vehicle(vehicles: List[Dict], target_no: str) -> Tuple[Optional[Dict], int, List[str]]:
    """
    Binary search on a list of vehicle records sorted by vehicle_no.
    Returns (vehicle_dict or None, index_found, steps_log).
    """
    steps = []
    sorted_vehicles = sorted(vehicles, key=lambda v: v["vehicle_no"])
    nos = [v["vehicle_no"] for v in sorted_vehicles]

    lo, hi = 0, len(nos) - 1
    steps.append(f"Binary Search for vehicle='{target_no}' over {len(nos)} vehicles")

    while lo <= hi:
        mid = (lo + hi) // 2
        steps.append(f"  lo={lo}, hi={hi}, mid={mid} → checking '{nos[mid]}'")

        if nos[mid] == target_no:
            steps.append(f"  FOUND '{target_no}' at index {mid}")
            return sorted_vehicles[mid], mid, steps
        elif nos[mid] < target_no:
            steps.append(f"  '{nos[mid]}' < '{target_no}' → search RIGHT")
            lo = mid + 1
        else:
            steps.append(f"  '{nos[mid]}' > '{target_no}' → search LEFT")
            hi = mid - 1

    steps.append(f"  NOT FOUND: '{target_no}'")
    return None, -1, steps


def binary_search_nearest_distance(slots: List[Dict], target_distance: int) -> Tuple[Optional[Dict], List[str]]:
    """
    Binary search on slots sorted by distance.
    Finds the slot with distance closest to (and >= ) target_distance.
    Useful for preferred-area searches.
    """
    steps = []
    sorted_slots = sorted(slots, key=lambda s: s["distance"])
    distances = [s["distance"] for s in sorted_slots]

    steps.append(f"Binary Search for nearest slot >= {target_distance}m")
    steps.append(f"Sorted distances: {distances}")

    lo, hi = 0, len(distances) - 1
    result_idx = -1

    while lo <= hi:
        mid = (lo + hi) // 2
        steps.append(f"  lo={lo}, hi={hi}, mid={mid} → distance={distances[mid]}m")

        if distances[mid] >= target_distance:
            result_idx = mid
            hi = mid - 1   # try to find a closer one
            steps.append(f"  {distances[mid]}m >= target → record, search LEFT")
        else:
            lo = mid + 1
            steps.append(f"  {distances[mid]}m < target → search RIGHT")

    if result_idx >= 0:
        steps.append(f"  NEAREST slot: {sorted_slots[result_idx]['id']} at {distances[result_idx]}m")
        return sorted_slots[result_idx], steps

    steps.append("  No slot found at or beyond target distance.")
    return None, steps
