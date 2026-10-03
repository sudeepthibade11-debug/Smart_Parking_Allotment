from database import init_db; init_db()
import app as flask_app, json
c = flask_app.app.test_client()

tests = [
    ('TG07T2489',  False, 'Telangana TG — should be VALID'),
    ('TG09AA1234', False, 'Telangana TG — should be VALID'),
    ('TS01AB5678', False, 'Telangana TS — should be VALID'),
    ('MH12AB1234', False, 'Maharashtra  — should be VALID'),
    ('AP28BH4444', False, 'Andhra Pradesh — should be VALID'),
    ('KA05CD5678', False, 'Karnataka — should be VALID'),
    ('ABCDEF1234', True,  'Fake — should be BLOCKED'),
    ('XX99YY1234', True,  'Fake — should be BLOCKED'),
    ('HELLO',      True,  'Nonsense — should be BLOCKED'),
]

print('=== TG + ALL STATE VALIDATION ===')
all_ok = True
for vno, should_block, label in tests:
    r = c.post('/api/allocate', json={'vehicle_no': vno, 'vehicle_type': 'car', 'priority': 'normal'})
    blocked = (r.status_code == 400)
    result  = 'OK ' if blocked == should_block else 'FAIL'
    if result == 'FAIL': all_ok = False
    status_txt = 'BLOCKED' if blocked else 'VALID'
    print(f'  {result}  {vno:15} [{status_txt}]  {label}')

print()
print('ALL PASSED' if all_ok else 'SOME FAILED')
