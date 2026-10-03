from database import init_db; init_db()
import app as flask_app
c = flask_app.app.test_client()
r = c.get('/parking')
h = r.data.decode()
print('HTTP:', r.status_code)
ids = ['viz-steps','bs-steps-wrapper','bs-steps-panel',
       'slot-detail-panel','vehicles-list','park-modal','exit-quick-modal']
for i in ids:
    tag = f'id="{i}"'
    print(f'  {"OK " if tag in h else "MISS"} #{i}')
print('Algorithm Activity card hidden:', 'Algorithm Activity' not in h)
print('div display:none wrapper present:', 'display:none' in h and 'viz-steps' in h)
