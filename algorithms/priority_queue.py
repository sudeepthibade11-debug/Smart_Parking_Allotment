"""
SmartPark - Priority Queue for Slot Ranking
============================================
Uses Python's heapq (min-heap) to maintain a priority-ordered list of
available parking slots.

Time Complexity : O(n log n) to build, O(log n) per extraction
Space Complexity: O(n)
"""

import heapq
from typing import List, Dict, Optional, Tuple

PRIORITY_RANK = {
    "emergency":      0,
    "accessible":     1,
    "senior_citizen": 2,
    "normal":         3,
}

VEHICLE_COMPAT = {
    "all":  {"car", "bike", "ev"},
    "car":  {"car"},
    "bike": {"bike"},
    "ev":   {"ev"},
}


def _priority_score(slot: Dict, vehicle_type: str, priority: str) -> float:
    compat = VEHICLE_COMPAT.get(slot["vehicle_type"], {"car", "bike", "ev"})
    if vehicle_type not in compat:
        return float('inf')
    score = float(slot["distance"])
    if slot.get("priority_zone") and PRIORITY_RANK.get(priority, 3) <= 2:
        score -= 30.0
    return score


class ParkingPriorityQueue:
    def __init__(self):
        self._heap: List[Tuple] = []
        self._entry_count = 0

    def push(self, slot: Dict, score: float):
        heapq.heappush(self._heap, (score, self._entry_count, slot))
        self._entry_count += 1

    def pop(self) -> Optional[Dict]:
        if self._heap:
            _, _, slot = heapq.heappop(self._heap)
            return slot
        return None

    def peek(self) -> Optional[Dict]:
        if self._heap:
            return self._heap[0][2]
        return None

    def size(self) -> int:
        return len(self._heap)

    def get_scored_list(self) -> List[Dict]:
        result = []
        for score, _, slot in sorted(self._heap, key=lambda x: x[0]):
            result.append({**slot, "pq_score": round(score, 2)})
        return result


def build_priority_queue(
    available_slots: List[Dict],
    vehicle_type: str,
    priority: str,
) -> Tuple["ParkingPriorityQueue", List[Dict], List[str]]:
    pq = ParkingPriorityQueue()
    steps = []
    steps.append(f"Building Priority Queue for vehicle_type={vehicle_type}, priority={priority}")

    excluded = 0
    for slot in available_slots:
        score = _priority_score(slot, vehicle_type, priority)
        if score == float('inf'):
            excluded += 1
            steps.append(f"  EXCLUDED {slot['id']} — incompatible type ({slot['vehicle_type']})")
        else:
            pq.push(slot, score)
            steps.append(f"  ENQUEUED {slot['id']} — score={round(score,2)}")

    steps.append(f"Priority Queue built: {pq.size()} slots queued, {excluded} excluded")

    scored = pq.get_scored_list()
    best = pq.pop()
    if best:
        steps.append(f"EXTRACTED best slot: {best['id']} (lowest score = highest priority)")
    else:
        steps.append("No compatible slots available in queue.")

    return pq, scored, best, steps
