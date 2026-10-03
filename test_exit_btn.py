"""Test that the Exit button works from both dashboard and parking pages."""
from database import init_db; init_db()
import app as flask_app, json

c = flask_app.app.test_client()
PASS = []; FAIL = []

def check(label, cond, detail=''):
    if cond: PASS.append(label); print(f'  OK  {label}')
    else: FAIL.append(label); print(f'  FAIL {label}  {detail}')

# ── 1. Dashboard has exit-modal + exit-vehicle-no + exitVehicleDash ───────────
print('\n=== DASHBOARD EXIT MODAL ===')
h = c.get('/').data.decode()
check('exit-modal present on dashboard',    'id="exit-modal"' in h)
check('exit-vehicle-no input present',      'id="exit-vehicle-no"' in h)
check('exitVehicleDash() function present', 'exitVehicleDash' in h)
check('Exit Vehicle button calls dash fn',  'onclick="exitVehicleDash()"' in h)

# ── 2. Parking page has exit-quick-modal + exit-vehicle-no ────────────────────
print('\n=== PARKING PAGE EXIT MODAL ===')
h2 = c.get('/parking').data.decode()
check('exit-quick-modal present on parking',   'id="exit-quick-modal"' in h2)
check('exit-vehicle-no input on parking',      'id="exit-vehicle-no"' in h2)
check('exitVehicle() called by parking modal', 'onclick="exitVehicle()"' in h2)

# ── 3. quickExit() handles both pages ─────────────────────────────────────────
print('\n=== PARKING.JS quickExit LOGIC ===')
js = c.get('/static/js/parking.js').data.decode()
check('quickExit detects exit-quick-modal', 'exit-quick-modal' in js and 'getElementById' in js)
check('quickExit detects exit-modal (dash)', 'exit-modal' in js)
check('quickExit fallback direct API call',  "API.post('/api/exit'" in js)
check('quickExit opens correct modal',       "openModal('exit-quick-modal')" in js and "openModal('exit-modal')" in js)

# ── 4. Actual exit API works ───────────────────────────────────────────────────
print('\n=== EXIT API FLOW ===')
# Park a test vehicle first
alloc = json.loads(c.post('/api/allocate', json={'vehicle_no':'EXITBTN01','vehicle_type':'car','priority':'normal'}).data)
check('Allocation succeeded', 'best_slot' in alloc, alloc.get('error'))
if 'best_slot' in alloc:
    slot_id = alloc['best_slot']['id']
    park = json.loads(c.post('/api/park', json={'vehicle_no':'EXITBTN01','vehicle_type':'car','priority':'normal','slot_id':slot_id,'reasons':[]}).data)
    check('Park succeeded', park.get('success') == True, park.get('error'))

    # Exit via the same API the button calls
    ex = json.loads(c.post('/api/exit', json={'vehicle_no':'EXITBTN01'}).data)
    check('Exit succeeded', ex.get('success') == True, ex.get('error'))
    check('freed_slot returned', ex.get('freed_slot') == slot_id)
    check('BS steps present on exit', len(ex.get('binary_search_steps', [])) > 0)
    print(f'  Freed: {ex.get("freed_slot")}, duration: {ex.get("duration_mins")}min')

    # Slot back to available
    slot_data = json.loads(c.get(f'/api/slots/{slot_id}').data)
    check('Slot available after exit', slot_data.get('status') == 'available')

print(f'\n{"="*40}')
print(f'PASSED: {len(PASS)}/{len(PASS)+len(FAIL)}')
if FAIL:
    for f in FAIL: print(f'  FAIL: {f}')
    import sys; sys.exit(1)
else:
    print('ALL EXIT BUTTON TESTS PASSED')
