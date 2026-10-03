from database import init_db; init_db()
import app as flask_app
c = flask_app.app.test_client()
r = c.get('/parking')
html = r.data.decode()

ids = ['parking-lot-wrapper','row-A','row-B','row-C','row-D',
       'car-layer','lot-and-panel','park-modal','map-selector-modal',
       'pm-smart-panel','pm-manual-panel','slot-detail-panel',
       'map-selector-lot','floor-selector']
print("=== HTML ID CHECK ===")
for i in ids:
    found = f'id="{i}"' in html
    print(f'  {"OK " if found else "MISS"} #{i}')

print("\n=== JS FUNCTION CHECK ===")
r2 = c.get('/static/js/parking.js')
js = r2.data.decode()
fns = ['initParkingPage','renderParkingLot','renderMapSelector',
       'openMapSelector','onMapSelClick','confirmMapSelection',
       'slotCardHTML','onModeChange','findBestSlot','confirmManualPark']
for f in fns:
    found = f'function {f}' in js or f'async function {f}' in js
    print(f'  {"OK " if found else "MISS"} {f}()')

print("\n=== CSS CLASS CHECK ===")
r3 = c.get('/static/css/style.css')
css = r3.data.decode()
classes = ['lot-and-panel','parking-lot-wrapper','map-selector-lot',
           'map-selector-modal','parking-slot','floor-stats-bar','floor-selector']
for cl in classes:
    found = f'.{cl}' in css
    print(f'  {"OK " if found else "MISS"} .{cl}')

print("\n=== SCRIPT TAG IN PARKING.HTML ===")
if 'parking.js' in html:
    print("  OK  parking.js script tag found")
else:
    print("  MISS parking.js script tag MISSING!")
if 'main.js' in html:
    print("  OK  main.js script tag found")
else:
    print("  MISS main.js MISSING!")

print("\n=== parking-lot-wrapper CONTEXT ===")
idx = html.find('parking-lot-wrapper')
print(html[max(0,idx-50):idx+200])
