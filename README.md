# 🅿️ SmartPark — Intelligent Parking Slot Allocator

A DAA Hackathon project demonstrating smart parking allocation using
**Greedy Algorithm**, **Priority Queue (Min-Heap)**, and **Binary Search**.

---

## Problem

Urban parking lots waste time because drivers manually search for slots.
A smart allocator can instantly find the best slot using algorithmic reasoning.

## Solution

SmartPark takes a vehicle's details (type, priority) and intelligently assigns
the best available slot by running three complementary algorithms:

| Algorithm       | Used For                          | Complexity          |
|-----------------|-----------------------------------|---------------------|
| Greedy          | Minimising allocation cost        | O(n)                |
| Priority Queue  | Ranking slots by suitability      | O(n log n) / O(log n)|
| Binary Search   | Locating slots/vehicles by ID     | O(log n)            |

---

## Features

- 🏗️ **Interactive parking lot** — visual 4×5 grid, click any slot for details
- 🚗 **Animated car movement** — car travels from entrance → slot → exit
- 🧮 **Live algorithm visualization** — step-by-step execution display
- 📊 **Dashboard** — real-time stats: total/available/occupied/reserved
- 📋 **Full parking history** — searchable, stored in SQLite
- 🚨 **Priority handling** — Emergency, Accessible, Senior Citizen, Normal
- ⚡ **EV & Bike slots** — type-compatible assignment
- ⭐ **Priority zones** — closest slots reserved for high-priority vehicles
- 💡 **Recommendation panel** — explains why each slot was chosen

---

## Tech Stack

- **Backend**: Python 3.x + Flask
- **Database**: SQLite (via Python's built-in `sqlite3`)
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Charts/Viz**: Pure JS (no React, no external charting libs)

---

## How to Run

```bash
# 1. Navigate to project folder
cd smart-parking

# 2. Install dependencies (only Flask needed)
pip install flask==3.0.3

# 3. Run the application
python app.py

# 4. Open browser
# http://127.0.0.1:5000
```

---

## Project Structure

```
smart-parking/
├── app.py                  # Flask app & all API routes
├── database.py             # SQLite setup, CRUD helpers, sample data
├── algorithms/
│   ├── greedy.py           # O(n) cost-minimisation greedy
│   ├── priority_queue.py   # Min-heap slot ranker
│   └── binary_search.py    # O(log n) slot/vehicle lookup
├── templates/
│   ├── base.html           # Shared navbar layout
│   ├── index.html          # Dashboard
│   ├── parking.html        # Interactive parking lot + car animation
│   ├── history.html        # Parking history table
│   └── algorithms.html     # Algorithm visualization page
├── static/
│   ├── css/style.css       # Full modern dark-theme UI
│   └── js/
│       ├── main.js         # Core utilities (toast, stats, API)
│       └── parking.js      # Lot rendering, car animation, park/exit
├── database/
│   └── parking.db          # Auto-created SQLite database
└── requirements.txt
```

---

## Demo Flow

1. Open **http://127.0.0.1:5000**
2. Click **"Park a Vehicle"** → enter details → **"Find Best Slot"**
3. Watch algorithms run and slot get highlighted
4. Click **"Confirm & Park"** → car animates to slot → slot turns 🔴
5. Visit **Algorithms** page to see live PQ + Greedy + Binary Search
6. Click **"Exit Vehicle"** → car exits → slot turns 🟢 → history updated
