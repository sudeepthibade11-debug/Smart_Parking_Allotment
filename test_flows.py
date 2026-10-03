"""End-to-end test for SmartPark redesign."""
import json, sys
from database import init_db

init_db()
import app as flask_app
c = flask_app.app.test_client()

PASS = []; FAIL = []

def check(label, condition, detail=''):
    if condition:
        PASS.append(label)
        print(f'  OK  {label}')
    else:
        FAIL.append(label)
        print(f'  FAIL {label}  {detail}')

# ── 1. Page renders ──────────────────────────────────────────────────────────
print('\n=== PAGE RENDERS ===')
for route in ['/', '/parking', '/history', '/algorithms']:
    r = c.get(route)
    check(f'GET {route} returns 200', r.status_code == 200)

# ── 2. /api/slots ────────────────────────────────────────────────────────────
print('\n=== SLOTS API ===')
r = c.get('/api/slots')
slots = json.loads(r.data)
avail = [s for s in slots if s['status'] == 'available']
occ   = [s for s in slots if s['status'] == 'occupied']
check('60 total slots (3 floors)', len(slots) == 60)
check('Has available slots', len(avail) > 0)
check('Slot has floor field', 'floor' in slots[0])
check('Slot has priority_zone', 'priority_zone' in slots[0])
print(f'  Available: {len(avail)}, Occupied: {len(occ)}')
print(f'  Sample slot: {slots[0]}')

# ── 3. Smart allocation (no preferred_area) ───────────────────────────────────
print('\n=== SMART ALLOCATION ===')
r = c.post('/api/allocate', json={'vehicle_no':'TST001','vehicle_type':'car','priority':'normal'})
d = json.loads(r.data)
check('Smart alloc returns 200', r.status_code == 200)
check('best_slot present', 'best_slot' in d, d.get('error'))
check('reasons returned', len(d.get('reasons',[])) > 0)
check('pq_ranked returned', len(d.get('priority_queue_ranked',[])) > 0)
check('complexity keys present', 'greedy' in d.get('complexity',{}))
bs_no_pref = d.get('algorithm_steps',{}).get('binary_search',[])
# BS only runs when preferred_area is supplied; empty list is correct here
check('BS steps empty when no preferred_area (correct)', len(bs_no_pref) == 0)
print(f'  best_slot={d["best_slot"]["id"]}, reasons={len(d["reasons"])}, pq_ranked={len(d["priority_queue_ranked"])}')

# ── 4. Manual allocation (preferred_area triggers BS) ─────────────────────────
print('\n=== MANUAL ALLOCATION (preferred_area=A4) ===')
r2 = c.post('/api/allocate', json={'vehicle_no':'TST001','vehicle_type':'car','priority':'normal','preferred_area':'A4'})
d2 = json.loads(r2.data)
check('Manual alloc returns 200', r2.status_code == 200)
check('best_slot returned', 'best_slot' in d2, d2.get('error'))
bs2 = d2.get('algorithm_steps',{}).get('binary_search',[])
check('BS steps present with preferred_area', len(bs2) > 0)
bs_found = any('FOUND' in s for s in bs2)
check('BS found A4 in steps', bs_found, str(bs2))
print(f'  best_slot={d2["best_slot"]["id"]}, BS steps={len(bs2)}')
print(f'  BS found line: {next((s for s in bs2 if "FOUND" in s), "none")}')

# ── 5. Park vehicle ───────────────────────────────────────────────────────────
print('\n=== PARK VEHICLE ===')
slot_id = d2['best_slot']['id']
r3 = c.post('/api/park', json={'vehicle_no':'TST001','vehicle_type':'car','priority':'normal',
                                'slot_id':slot_id,'reasons':d2.get('reasons',[])})
d3 = json.loads(r3.data)
check('Park returns 200', r3.status_code == 200)
check('success=True', d3.get('success') == True, d3.get('error'))
check('Slot status=occupied after park', d3.get('slot',{}).get('status') == 'occupied')
print(f'  Parked {slot_id}: {d3.get("message")}')

# ── 6. Duplicate vehicle rejected ────────────────────────────────────────────
print('\n=== DUPLICATE VEHICLE CHECK ===')
r4 = c.post('/api/allocate', json={'vehicle_no':'TST001','vehicle_type':'car','priority':'normal'})
d4 = json.loads(r4.data)
check('Duplicate vehicle returns 409', r4.status_code == 409)
check('Error message present', 'error' in d4)
print(f'  Error: {d4.get("error")}')

# ── 7. Occupied slot cannot be re-parked ──────────────────────────────────────
print('\n=== OCCUPIED SLOT REJECTION ===')
r5 = c.post('/api/park', json={'vehicle_no':'TST002','vehicle_type':'car','priority':'normal',
                                'slot_id':slot_id,'reasons':[]})
d5 = json.loads(r5.data)
check('Occupied slot returns 409', r5.status_code == 409)
check('Error message present', 'error' in d5)
print(f'  Error: {d5.get("error")}')

# ── 8. Exit vehicle (Binary Search confirmed) ─────────────────────────────────
print('\n=== EXIT VEHICLE ===')
r6 = c.post('/api/exit', json={'vehicle_no':'TST001'})
d6 = json.loads(r6.data)
check('Exit returns 200', r6.status_code == 200)
check('success=True on exit', d6.get('success') == True, d6.get('error'))
check('freed_slot returned', d6.get('freed_slot') == slot_id)
bs6 = d6.get('binary_search_steps', [])
check('BS steps on exit', len(bs6) > 0)
check('BS found vehicle on exit', any('FOUND' in s for s in bs6), str(bs6))
print(f'  Freed: {d6.get("freed_slot")}, duration: {d6.get("duration_mins")}min')
print(f'  BS found: {next((s for s in bs6 if "FOUND" in s), "none")}')

# ── 9. Slot available again ───────────────────────────────────────────────────
print('\n=== SLOT AVAILABILITY RESTORED ===')
r7 = c.get(f'/api/slots/{slot_id}')
d7 = json.loads(r7.data)
check(f'Slot {slot_id} available after exit', d7.get('status') == 'available')

# ── 10. History record ────────────────────────────────────────────────────────
print('\n=== HISTORY RECORD ===')
r8 = c.get('/api/history')
hist = json.loads(r8.data)
rec = [h for h in hist if h['vehicle_no'] == 'TST001']
check('TST001 in history', len(rec) > 0)
if rec:
    check('exit_time recorded', rec[0].get('exit_time') is not None)

# ── 11. Bike compat ───────────────────────────────────────────────────────────
print('\n=== VEHICLE TYPE COMPATIBILITY ===')
r9 = c.post('/api/allocate', json={'vehicle_no':'BIKE01','vehicle_type':'bike','priority':'normal'})
d9 = json.loads(r9.data)
check('Bike gets compatible slot', r9.status_code == 200 and 'best_slot' in d9)
if d9.get('best_slot'):
    vt = d9['best_slot']['vehicle_type']
    check('Bike slot type is bike or all', vt in ('bike','all'), vt)
    print(f'  Bike assigned to: {d9["best_slot"]["id"]} (type={vt})')

# ── 12. EV compat ─────────────────────────────────────────────────────────────
r10 = c.post('/api/allocate', json={'vehicle_no':'EV01','vehicle_type':'ev','priority':'normal'})
d10 = json.loads(r10.data)
check('EV gets compatible slot', r10.status_code == 200 and 'best_slot' in d10)
if d10.get('best_slot'):
    vt = d10['best_slot']['vehicle_type']
    check('EV slot type is ev or all', vt in ('ev','all'), vt)
    print(f'  EV assigned to: {d10["best_slot"]["id"]} (type={vt})')

# ── 13. Emergency priority ────────────────────────────────────────────────────
print('\n=== PRIORITY HANDLING ===')
r11 = c.post('/api/allocate', json={'vehicle_no':'EMRG01','vehicle_type':'car','priority':'emergency'})
d11 = json.loads(r11.data)
check('Emergency gets a slot', r11.status_code == 200 and 'best_slot' in d11)
if d11.get('best_slot'):
    print(f'  Emergency assigned: {d11["best_slot"]["id"]}, priority_zone={d11["best_slot"]["priority_zone"]}')

# ── 14. Algorithm demo ────────────────────────────────────────────────────────
print('\n=== ALGORITHM DEMO ENDPOINT ===')
r12 = c.post('/api/algorithm-demo', json={'vehicle_type':'car','priority':'normal','search_id':'B2'})
d12 = json.loads(r12.data)
check('Algo demo returns 200', r12.status_code == 200)
check('PQ best returned', d12.get('priority_queue',{}).get('best') is not None)
check('Greedy best returned', d12.get('greedy',{}).get('best') is not None)
bs12 = d12.get('binary_search',{}).get('steps',[])
check('BS demo search returned steps', len(bs12) > 0)
print(f'  PQ best={d12["priority_queue"]["best"]["id"]}, Greedy best={d12["greedy"]["best"]["id"]}')
print(f'  BS B2 result: {next((s for s in bs12 if "FOUND" in s or "NOT FOUND" in s),"none")}')

# ── 15. Invalid vehicle number ────────────────────────────────────────────────
print('\n=== ERROR HANDLING ===')
r13 = c.post('/api/allocate', json={'vehicle_no':'','vehicle_type':'car','priority':'normal'})
check('Empty vehicle_no returns 400', r13.status_code == 400)
r14 = c.post('/api/allocate', json={'vehicle_no':'XX','vehicle_type':'truck','priority':'normal'})
check('Invalid type returns 400', r14.status_code == 400)
r15 = c.post('/api/exit', json={'vehicle_no':'NOTPARKED'})
check('Exit unparked vehicle returns 404', r15.status_code == 404)

# ── 16. parking.html no longer has preferred-area input ──────────────────────
print('\n=== TEMPLATE VERIFICATION ===')
r16 = c.get('/parking')
html = r16.data.decode()
check('preferred-area input REMOVED from modal', 'id="preferred-area"' not in html)
check('park-mode radio buttons present', 'name="park-mode"' in html)
check('map-selector-modal present', 'id="map-selector-modal"' in html)
check('pm-smart-panel present', 'id="pm-smart-panel"' in html)
check('pm-manual-panel present', 'id="pm-manual-panel"' in html)
check('find-slot-btn present', 'id="find-slot-btn"' in html)
check('confirm-manual-btn present', 'id="confirm-manual-btn"' in html)
check('Binary Search mention present', 'Binary Search' in html)
check('Floor selector present', 'floor-selector' in html)

# ── Summary ───────────────────────────────────────────────────────────────────
print(f'\n{"="*50}')
print(f'PASSED: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    print(f'FAILED: {len(FAIL)}')
    for f in FAIL:
        print(f'  - {f}')
    sys.exit(1)
else:
    print('ALL TESTS PASSED')
