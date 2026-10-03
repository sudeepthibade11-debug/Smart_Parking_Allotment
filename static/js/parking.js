/* ============================================================
   SmartPark – parking.js  (3-floor redesign)
   Floor 1: rows A–D  |  Floor 2: rows E–H  |  Floor 3: rows I–L
   Floor label shown on every slot detail, modal, badge, toast.
   Vehicle number validated against Indian registration format.
   ============================================================ */

// ── Indian Vehicle Registration Validation ────────────────────────────────────
// Format: <2-letter state code> <2-digit district> <1-3 letter series> <4 digits>
// Examples: MH12AB1234  KA05CD567  DL3CAB1234  TN22XY4321
// Valid state codes (all 36 states/UTs):
const VALID_STATE_CODES = new Set([
  'AN','AP','AR','AS','BR','CH','CG','DD','DL','DN',
  'GA','GJ','HP','HR','JH','JK','KA','KL','LA','LD',
  'MH','ML','MN','MP','MZ','NL','OD','OD','PB','PY','RJ',
  'SK','TN','TG','TR','TS','UK','UP','WB'
]);

// Regex: 2 letters + 2 digits + 1-3 letters + 4 digits
const VEHICLE_NO_REGEX = /^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{4})$/;

function validateVehicleNoValue(val) {
  // Returns { valid: bool, message: string, type: 'ok'|'error'|'warning' }
  const v = val.trim().toUpperCase().replace(/\s+/g, '');

  if (!v) return { valid: false, message: '', type: 'empty' };
  if (v.length < 6)  return { valid: false, message: 'Keep typing… (e.g. MH12AB1234)', type: 'warning' };

  const match = VEHICLE_NO_REGEX.exec(v);
  if (!match) {
    return {
      valid: false,
      message: 'Invalid format. Expected: 2-letter state + 2-digit district + 1–3 letters + 4 digits (e.g. MH12AB1234)',
      type: 'error'
    };
  }

  const stateCode = match[1];
  if (!VALID_STATE_CODES.has(stateCode)) {
    return {
      valid: false,
      message: `"${stateCode}" is not a valid Indian state/UT code.`,
      type: 'error'
    };
  }

  return {
    valid: true,
    message: `Valid Indian vehicle number (${stateCode} — ${stateCodeName(stateCode)})`,
    type: 'ok'
  };
}

function stateCodeName(code) {
  const names = {
    AN:'Andaman & Nicobar',AP:'Andhra Pradesh',AR:'Arunachal Pradesh',AS:'Assam',
    BR:'Bihar',CH:'Chandigarh',CG:'Chhattisgarh',DD:'Daman & Diu',DL:'Delhi',
    DN:'Dadra & Nagar Haveli',GA:'Goa',GJ:'Gujarat',HP:'Himachal Pradesh',
    HR:'Haryana',JH:'Jharkhand',JK:'Jammu & Kashmir',KA:'Karnataka',KL:'Kerala',
    LA:'Ladakh',LD:'Lakshadweep',MH:'Maharashtra',ML:'Meghalaya',MN:'Manipur',
    MP:'Madhya Pradesh',MZ:'Mizoram',NL:'Nagaland',OD:'Odisha',PB:'Punjab',
    PY:'Puducherry',RJ:'Rajasthan',SK:'Sikkim',TN:'Tamil Nadu',TG:'Telangana',
    TR:'Tripura',TS:'Telangana',UK:'Uttarakhand',UP:'Uttar Pradesh',WB:'West Bengal'
  };
  return names[code] || code;
}

// Live feedback on the input field
function validateVehicleNo(input) {
  const result  = validateVehicleNoValue(input.value);
  const feedback = document.getElementById('vno-feedback');
  if (!feedback) return;

  if (result.type === 'empty') {
    feedback.innerHTML = '';
    input.classList.remove('vno-valid','vno-invalid','vno-warn');
    return;
  }
  if (result.type === 'warning') {
    feedback.innerHTML = `<span class="vno-msg vno-msg-warn">${result.message}</span>`;
    input.classList.remove('vno-valid','vno-invalid'); input.classList.add('vno-warn');
    return;
  }
  if (result.type === 'error') {
    feedback.innerHTML = `<span class="vno-msg vno-msg-error">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      ${result.message}</span>`;
    input.classList.remove('vno-valid','vno-warn'); input.classList.add('vno-invalid');
    return;
  }
  // ok
  feedback.innerHTML = `<span class="vno-msg vno-msg-ok">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    ${result.message}</span>`;
  input.classList.remove('vno-invalid','vno-warn'); input.classList.add('vno-valid');
}


// ── State ─────────────────────────────────────────────────────────────────────
let allSlots       = [];
let selectedSlot   = null;
let pendingVehicle = null;
let manualSlotId   = null;
let mapSelSlotId   = null;
let carParked      = {};
let animating      = false;
let currentFloor   = 1;

// ── Floor / row config ────────────────────────────────────────────────────────
const FLOOR_ROWS = {
  1: { rows: ['A','B','C','D'], zone1: 'Zone A', zone2: 'Zone B', label: 'Floor 1' },
  2: { rows: ['E','F','G','H'], zone1: 'Zone C', zone2: 'Zone D', label: 'Floor 2' },
  3: { rows: ['I','J','K','L'], zone1: 'Zone E', zone2: 'Zone F', label: 'Floor 3' },
};

function floorLabel(floor) {
  return `Floor ${floor}`;
}
function rowFloor(rowLabel) {
  for (const [f, cfg] of Object.entries(FLOOR_ROWS)) {
    if (cfg.rows.includes(rowLabel)) return parseInt(f);
  }
  return 1;
}

// ── Car SVG ───────────────────────────────────────────────────────────────────
function carSVG(color = '#38bdf8') {
  return `<svg viewBox="0 0 40 24" xmlns="http://www.w3.org/2000/svg" class="car-svg" style="width:34px;height:20px">
    <rect x="4" y="6" width="32" height="14" rx="4" fill="${color}"/>
    <rect x="8" y="3" width="24" height="9" rx="3" fill="${color}" opacity="0.8"/>
    <rect x="10" y="4" width="20" height="7" rx="2" fill="#0d1117" opacity="0.5"/>
    <circle cx="9"  cy="20" r="3" fill="#1c2128" stroke="#aaa" stroke-width="1"/>
    <circle cx="31" cy="20" r="3" fill="#1c2128" stroke="#aaa" stroke-width="1"/>
    <circle cx="9"  cy="6"  r="3" fill="#1c2128" stroke="#aaa" stroke-width="1"/>
    <circle cx="31" cy="6"  r="3" fill="#1c2128" stroke="#aaa" stroke-width="1"/>
    <rect x="2"  y="9" width="5" height="3" rx="1" fill="#e3b341" opacity="0.9"/>
    <rect x="33" y="9" width="5" height="3" rx="1" fill="#f85149" opacity="0.7"/>
  </svg>`;
}

// ── Special badges ────────────────────────────────────────────────────────────
function slotSpecialIcon(slot) {
  let b = '';
  if (slot.priority_zone)            b += '<span class="slot-priority-star">⭐</span>';
  if (slot.vehicle_type === 'ev')    b += '<span class="slot-ev-badge">EV</span>';
  if (slot.vehicle_type === 'bike')  b += '<span class="slot-bike-badge">🏍</span>';
  return b;
}

// ── Slot card HTML ────────────────────────────────────────────────────────────
function slotCardHTML(slot, context = 'main') {
  const special    = slotSpecialIcon(slot);
  const compat     = { all:'Car/Bike/EV', car:'Car', bike:'Bike', ev:'EV/Car' }[slot.vehicle_type] || slot.vehicle_type;
  const idPrefix   = context === 'main' ? 'slot-' : 'sel-slot-';
  const clickFn    = context === 'main' ? `onSlotClick('${slot.id}')` : `onMapSelClick('${slot.id}')`;

  let silhouette = '';
  if (slot.status === 'occupied') {
    const c = { car:'#f85149', bike:'#e3b341', ev:'#bc8cff' }[slot._parked_type || 'car'] || '#f85149';
    silhouette = `<div class="slot-car-silhouette">${carSVG(c)}</div>`;
  }

  return `
    <div class="parking-slot ${slot.status}" data-id="${slot.id}"
         id="${idPrefix}${slot.id}"
         title="${slot.id} · ${floorLabel(slot.floor)} · ${slot.distance}m · ${compat}"
         onclick="${clickFn}">
      <div class="slot-top-row">${special}</div>
      ${silhouette}
      <span class="slot-id">${slot.id}</span>
      <span class="slot-dist">${slot.distance}m</span>
    </div>`;
}

// ── Render the parking lot for the active floor ───────────────────────────────
function renderParkingLot(slots) {
  allSlots = slots;
  const cfg    = FLOOR_ROWS[currentFloor];
  const rows   = cfg.rows;                        // e.g. ['A','B','C','D']
  const byRow  = {};
  rows.forEach(r => byRow[r] = []);

  // Only use slots for this floor
  slots.filter(s => (s.floor || 1) === currentFloor)
       .forEach(s => { if (byRow[s.row_label]) byRow[s.row_label].push(s); });
  rows.forEach(r => byRow[r].sort((a, b) => a.slot_number - b.slot_number));

  // Inject into the 4 row divs (reused for all floors)
  const rowIds = ['row-A','row-B','row-C','row-D'];
  rows.forEach((row, i) => {
    const el = document.getElementById(rowIds[i]);
    if (el) el.innerHTML = byRow[row].map(s => slotCardHTML(s, 'main')).join('');
  });

  // Update zone labels
  setEl('zone-a-label', cfg.zone1);
  setEl('zone-b-label', cfg.zone2);

  // Update floor badge inside the map
  const lbl = document.getElementById('floor-map-label');
  if (lbl) {
    lbl.querySelector('span').textContent = cfg.label;
  }

  // Update floor button sub-labels for ALL floors
  Object.entries(FLOOR_ROWS).forEach(([f, c]) => {
    const fSlots = allSlots.filter(s => (s.floor || 1) === parseInt(f));
    const occ    = fSlots.filter(s => s.status === 'occupied').length;
    const sub    = document.getElementById(`floor-${f}-sub`);
    if (sub) sub.textContent = `${fSlots.length} slots · ${occ} occupied`;
  });

  // Update stats bar with current-floor numbers
  const floorSlots = allSlots.filter(s => (s.floor || 1) === currentFloor);
  const avail = floorSlots.filter(s => s.status === 'available').length;
  const occ   = floorSlots.filter(s => s.status === 'occupied').length;
  setEl('fs-total', allSlots.length);          // total across all floors
  setEl('fs-avail', avail);
  setEl('fs-occ',   occ);
  setEl('fs-res',   floorSlots.filter(s => s.status === 'reserved').length);
}

// ── Floor selector ────────────────────────────────────────────────────────────
function selectFloor(floor) {
  currentFloor = floor;
  document.querySelectorAll('.floor-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.floor) === floor));

  // Clear selected slot highlight when switching floor
  selectedSlot = null;
  document.getElementById('slot-detail-panel').innerHTML = `
    <div class="slot-hint-msg">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5"/>
      </svg>
      <span>Click any slot on ${floorLabel(floor)} to view details</span>
    </div>`;
  hideEl('slot-action-area');

  renderParkingLot(allSlots);

  // Re-place parked cars for the new floor
  Object.keys(carParked).forEach(slotId => {
    const s = allSlots.find(x => x.id === slotId);
    if (s && (s.floor || 1) === floor) {
      placeCarOnSlot(slotId, carParked[slotId].color);
    }
  });
}

// ── Render map-selector modal ─────────────────────────────────────────────────
function renderMapSelector() {
  const container = document.getElementById('map-selector-lot');
  if (!container) return;

  let html = '';
  Object.entries(FLOOR_ROWS).forEach(([f, cfg]) => {
    const fNum   = parseInt(f);
    const fSlots = allSlots.filter(s => (s.floor || 1) === fNum);
    const byRow  = {};
    cfg.rows.forEach(r => byRow[r] = []);
    fSlots.forEach(s => { if (byRow[s.row_label]) byRow[s.row_label].push(s); });
    cfg.rows.forEach(r => byRow[r].sort((a, b) => a.slot_number - b.slot_number));

    const avail = fSlots.filter(s => s.status === 'available').length;
    html += `<div class="map-sel-floor-header">
               <span class="map-sel-floor-name">${cfg.label}</span>
               <span class="map-sel-floor-meta">${fSlots.length} slots · ${avail} available</span>
             </div>`;
    html += '<div class="map-selector-entrance">▼ ENTRANCE</div>';
    html += '<div class="map-selector-road"></div>';

    cfg.rows.forEach((row, ri) => {
      html += `<div class="map-selector-row-label">Row ${row} — ${cfg.label}</div>`;
      html += `<div class="parking-row" style="justify-content:center;gap:0.5rem;margin-bottom:0.25rem">`;
      html += byRow[row].map(s => slotCardHTML(s, 'selector')).join('');
      html += '</div>';
      if (ri === 1) html += '<div class="map-selector-road"></div>';
    });
    html += '<div class="map-selector-road"></div>';
    html += '<div class="map-selector-exit">▲ EXIT</div>';
    if (fNum < 3) html += '<div class="map-sel-floor-divider"></div>';
  });

  container.innerHTML = html;
}

// ── Slot click on main map ────────────────────────────────────────────────────
function onSlotClick(slotId) {
  const slot = allSlots.find(s => s.id === slotId);
  if (!slot) return;

  if (selectedSlot && selectedSlot !== slotId) {
    const prev   = allSlots.find(s => s.id === selectedSlot);
    const prevEl = document.getElementById(`slot-${selectedSlot}`);
    if (prevEl && prev) prevEl.className = `parking-slot ${prev.status}`;
  }
  selectedSlot = slotId;
  const el = document.getElementById(`slot-${slotId}`);
  if (el) el.className = `parking-slot ${slot.status} selected`;
  showSlotDetail(slot);
}

// ── Slot detail panel ─────────────────────────────────────────────────────────
function showSlotDetail(slot) {
  const panel      = document.getElementById('slot-detail-panel');
  const actionArea = document.getElementById('slot-action-area');
  if (!panel) return;

  const compat = { all:'Car / Bike / EV', car:'Car only', bike:'Bike only', ev:'EV / Car' }[slot.vehicle_type] || slot.vehicle_type;
  const statusBadge = {
    available: '<span class="badge badge-green">Available</span>',
    occupied:  '<span class="badge badge-red">Occupied</span>',
    reserved:  '<span class="badge badge-yellow">Reserved</span>',
  }[slot.status] || slot.status;

  // Floor badge shown prominently at top
  const floorBadge = `<span class="slot-floor-pill">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
    </svg>
    ${floorLabel(slot.floor)}
  </span>`;

  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.65rem">
      <div class="slot-detail-big-id">${slot.id}</div>
      ${floorBadge}
    </div>
    <div class="slot-detail-row"><span class="slot-detail-key">Status</span>${statusBadge}</div>
    <div class="slot-detail-row"><span class="slot-detail-key">Floor</span><strong style="color:var(--cyan)">${floorLabel(slot.floor)}</strong></div>
    <div class="slot-detail-row"><span class="slot-detail-key">Zone</span>${slot.row_label}</div>
    <div class="slot-detail-row"><span class="slot-detail-key">Distance</span>${slot.distance}m from entrance</div>
    <div class="slot-detail-row"><span class="slot-detail-key">Compatible</span>${compat}</div>
    <div class="slot-detail-row"><span class="slot-detail-key">Priority Zone</span>${slot.priority_zone ? '⭐ Yes' : 'No'}</div>`;

  if (slot.status === 'available') {
    actionArea.style.display = '';
    actionArea.innerHTML = `
      <button class="btn btn-primary" style="width:100%"
              onclick="selectSlotForParking('${slot.id}')">
        Select This Slot — ${floorLabel(slot.floor)}
      </button>`;
  } else if (slot.status === 'occupied') {
    actionArea.style.display = '';
    actionArea.innerHTML = `
      <div class="occupied-slot-info">
        <div style="color:var(--red);font-weight:700;margin-bottom:0.3rem">Slot Occupied · ${floorLabel(slot.floor)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">Cannot select an occupied slot</div>
      </div>`;
  } else {
    actionArea.style.display = 'none';
  }
  panel.classList.add('fade-in');
}

// ── "Select This Slot" from detail panel ──────────────────────────────────────
function selectSlotForParking(slotId) {
  manualSlotId = slotId;
  openParkModal();
  document.querySelector('input[name="park-mode"][value="manual"]').checked = true;
  onModeChange('manual');
  applyManualSlotToModal(slotId);
}

function getParkedVehicleForSlot(slotId) {
  const vEl = document.querySelector(`[data-slot="${slotId}"]`);
  return vEl ? vEl.outerHTML : '<div style="font-size:0.82rem;color:var(--text-secondary)">Loading…</div>';
}

// ── Park Modal ────────────────────────────────────────────────────────────────
function openParkModal() {
  resetParkForm();
  openModal('park-modal');
}
function closeParkModal() {
  closeModal('park-modal');
  mapSelSlotId = null;
}
function resetParkForm() {
  ['vehicle-no'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  ['vehicle-type','priority'].forEach(id => { const e = document.getElementById(id); if (e) e.selectedIndex = 0; });
  const smartRadio = document.querySelector('input[name="park-mode"][value="smart"]');
  if (smartRadio) { smartRadio.checked = true; onModeChange('smart'); }
  hideEl('alloc-result');
  hideEl('confirm-park-btn');
  hideEl('manual-selected-display');
  hideEl('confirm-manual-btn');
  hideEl('map-sel-confirm-btn');
  pendingVehicle = null;
  if (!manualSlotId) clearManualSlot();
}
function onModeChange(mode) {
  const smartPanel = document.getElementById('pm-smart-panel');
  const manualPanel= document.getElementById('pm-manual-panel');
  const optSmart   = document.getElementById('mode-opt-smart');
  const optManual  = document.getElementById('mode-opt-manual');
  if (mode === 'smart') {
    smartPanel.style.display  = '';
    manualPanel.style.display = 'none';
    optSmart?.classList.add('mode-option-active');
    optManual?.classList.remove('mode-option-active');
  } else {
    smartPanel.style.display  = 'none';
    manualPanel.style.display = '';
    optSmart?.classList.remove('mode-option-active');
    optManual?.classList.add('mode-option-active');
    if (manualSlotId) applyManualSlotToModal(manualSlotId);
  }
}

// ── Smart Mode: Find Best Slot ────────────────────────────────────────────────
async function findBestSlot() {
  const vehicleNo   = document.getElementById('vehicle-no')?.value.trim().toUpperCase();
  const vehicleType = document.getElementById('vehicle-type')?.value;
  const priority    = document.getElementById('priority')?.value;
  if (!vehicleNo) { showToast('error', 'Missing Info', 'Enter a vehicle number.'); return; }

  // Validate format before hitting the API
  const validation = validateVehicleNoValue(vehicleNo);
  if (!validation.valid) {
    showToast('error', 'Invalid Vehicle Number', validation.message);
    const inp = document.getElementById('vehicle-no');
    if (inp) { inp.classList.add('vno-invalid'); inp.focus(); }
    return;
  }

  const btn = document.getElementById('find-slot-btn');
  setLoading(btn, true, 'Analysing…');
  try {
    const data = await API.post('/api/allocate', { vehicle_no: vehicleNo, vehicle_type: vehicleType, priority });
    if (data.error) { showToast('error', 'Allocation Failed', data.error); return; }

    pendingVehicle = {
      vehicle_no: vehicleNo, vehicle_type: vehicleType, priority,
      slot_id: data.best_slot.id, reasons: data.reasons,
    };

    renderAllocResult(data);
    showEl('alloc-result');
    showEl('confirm-park-btn');

    // Auto-switch to the slot's floor so it's visible on the map
    const bestFloor = data.best_slot.floor || 1;
    if (bestFloor !== currentFloor) selectFloor(bestFloor);
    highlightSlot(data.best_slot.id);

  } catch(e) { showToast('error', 'Network Error', 'Could not reach server.');
  } finally  { setLoading(btn, false, 'Find Best Slot'); }
}

// ── Allocation result card ────────────────────────────────────────────────────
function renderAllocResult(data) {
  const el   = document.getElementById('alloc-result');
  if (!el) return;
  const slot = data.best_slot;
  const avail= (data.priority_queue_ranked||[]).length;
  const cx   = data.complexity || {};

  const pqRows = (data.priority_queue_ranked||[]).slice(0,8).map((s,i) => `
    <tr>
      <td>${i+1}</td>
      <td><strong style="color:${i===0?'var(--green)':'inherit'}">${s.id}</strong>${i===0?' ★':''}</td>
      <td style="font-family:'Courier New'">${s.pq_score}</td>
      <td>${s.distance}m</td>
      <td style="font-size:0.7rem;color:var(--text-muted)">${floorLabel(s.floor||1)}</td>
    </tr>`).join('');

  const reasonsHTML = (data.reasons||[]).map(r => `<li>${r}</li>`).join('');

  el.innerHTML = `
    <div class="result-slot-card mb-2 slide-up">
      <div class="result-tag">Recommended Slot</div>
      <div class="result-slot-id">${slot.id}</div>
      <div class="result-slot-meta">
        <strong style="color:var(--cyan)">${floorLabel(slot.floor)}</strong>
        &bull; Zone ${slot.row_label} &bull; ${slot.distance}m from entrance
        &bull; ${slot.priority_zone ? '⭐ Priority Zone' : 'Standard Zone'}
      </div>
    </div>
    <div class="algo-flow-box mb-2">
      <div class="algo-flow-title">Smart Allocation Flow</div>
      <div class="algo-flow-steps">
        <div class="afs-item done"><span class="afs-num">1</span><span>${allSlots.length} total slots (all floors)</span></div>
        <div class="afs-arrow">↓</div>
        <div class="afs-item done"><span class="afs-num">2</span><span>${avail} compatible available</span></div>
        <div class="afs-arrow">↓</div>
        <div class="afs-item done"><span class="afs-num">3</span><span>Priority Queue ranked</span><span class="afs-badge">${cx.priority_queue?.notation||'O(n log n)'}</span></div>
        <div class="afs-arrow">↓</div>
        <div class="afs-item done"><span class="afs-num">4</span><span>Greedy cost selected</span><span class="afs-badge">${cx.greedy?.notation||'O(n)'}</span></div>
        <div class="afs-arrow">↓</div>
        <div class="afs-item best"><span class="afs-num">✓</span><span>Best: <strong>${slot.id}</strong> on <strong>${floorLabel(slot.floor)}</strong></span></div>
      </div>
    </div>
    <div class="recommendation-box mb-2">
      <div class="rec-title">Why slot ${slot.id} · ${floorLabel(slot.floor)}?</div>
      <ul>${reasonsHTML}</ul>
    </div>
    <div class="card" style="padding:0.85rem;margin-bottom:0">
      <div class="card-title" style="font-size:0.78rem;margin-bottom:0.5rem">Priority Queue Ranking (top ${Math.min(8,avail)})</div>
      <div style="overflow-x:auto">
        <table class="pq-table">
          <thead><tr><th>#</th><th>Slot</th><th>Score</th><th>Dist</th><th>Floor</th></tr></thead>
          <tbody>${pqRows}</tbody>
        </table>
      </div>
    </div>`;
}

// ── Smart Mode: Confirm Park ──────────────────────────────────────────────────
async function confirmPark() {
  if (!pendingVehicle || animating) return;
  const btn = document.getElementById('confirm-park-btn');
  setLoading(btn, true, 'Parking…');
  try {
    const data = await API.post('/api/park', {
      vehicle_no:   pendingVehicle.vehicle_no,
      vehicle_type: pendingVehicle.vehicle_type,
      priority:     pendingVehicle.priority,
      slot_id:      pendingVehicle.slot_id,
      reasons:      pendingVehicle.reasons,
    });
    if (data.error) { showToast('error', 'Parking Failed', data.error); return; }

    const slot = allSlots.find(s => s.id === pendingVehicle.slot_id);
    closeModal('park-modal');
    showToast('success', 'Vehicle Parked',
      `${pendingVehicle.vehicle_no} → ${pendingVehicle.slot_id} · ${floorLabel(slot?.floor || currentFloor)}`);
    await animateCarEntry(pendingVehicle.slot_id, pendingVehicle.vehicle_type);
    updateSlotUI(pendingVehicle.slot_id, 'occupied');
    refreshStats();
    refreshVehicleList();
    runAlgoVizSteps();
    pendingVehicle = null;
  } catch(e) { showToast('error', 'Network Error', 'Could not reach server.');
  } finally  { setLoading(btn, false, 'Confirm & Park'); }
}

// ── Manual Mode: Open map selector ───────────────────────────────────────────
async function openMapSelector() {
  mapSelSlotId = null;
  hideEl('map-sel-chosen');
  hideEl('map-sel-confirm-btn');
  if (!allSlots || allSlots.length === 0) {
    try { allSlots = await API.get('/api/slots'); } catch(_) {}
  }
  renderMapSelector();
  const mapModal = document.getElementById('map-selector-modal');
  if (mapModal) { mapModal.style.zIndex = '300'; mapModal.classList.add('show'); }
}

// ── Manual Mode: Slot click inside map selector ───────────────────────────────
function onMapSelClick(slotId) {
  const slot = allSlots.find(s => s.id === slotId);
  if (!slot) return;

  if (slot.status !== 'available') {
    document.getElementById('map-sel-badge').textContent = slot.id;
    document.getElementById('map-sel-meta').innerHTML =
      `<span class="badge badge-red">Occupied</span> · ${floorLabel(slot.floor)} · Cannot be selected`;
    showEl('map-sel-chosen');
    hideEl('map-sel-confirm-btn');
    document.querySelectorAll('#map-selector-lot .parking-slot').forEach(e => e.classList.remove('selected'));
    const el = document.getElementById(`sel-slot-${slotId}`);
    if (el) { el.classList.add('selected'); setTimeout(() => el.classList.remove('selected'), 1200); }
    return;
  }

  document.querySelectorAll('#map-selector-lot .parking-slot').forEach(e => e.classList.remove('selected'));
  const el = document.getElementById(`sel-slot-${slotId}`);
  if (el) el.classList.add('selected');

  mapSelSlotId = slotId;
  const compat = { all:'Car/Bike/EV', car:'Car only', bike:'Bike only', ev:'EV/Car' }[slot.vehicle_type] || slot.vehicle_type;
  document.getElementById('map-sel-badge').textContent = slotId;
  document.getElementById('map-sel-meta').innerHTML =
    `<span class="badge badge-green">Available</span> · <strong style="color:var(--cyan)">${floorLabel(slot.floor)}</strong> · Zone ${slot.row_label} · ${slot.distance}m · ${compat}`;
  showEl('map-sel-chosen');
  showEl('map-sel-confirm-btn');
}

// ── Manual Mode: Confirm selection ───────────────────────────────────────────
function confirmMapSelection() {
  if (!mapSelSlotId) return;
  manualSlotId = mapSelSlotId;
  const mapModal = document.getElementById('map-selector-modal');
  if (mapModal) mapModal.classList.remove('show');
  applyManualSlotToModal(manualSlotId);
}

// ── Manual Mode: Show slot in park modal ──────────────────────────────────────
function applyManualSlotToModal(slotId) {
  const slot = allSlots.find(s => s.id === slotId);
  if (!slot) return;
  const compat = { all:'Car/Bike/EV', car:'Car only', bike:'Bike only', ev:'EV/Car' }[slot.vehicle_type] || slot.vehicle_type;

  document.getElementById('manual-slot-badge').textContent = slotId;
  document.getElementById('manual-slot-meta').innerHTML =
    `<span class="badge badge-green">Available</span> · <strong style="color:var(--cyan)">${floorLabel(slot.floor)}</strong> · Zone ${slot.row_label} · ${slot.distance}m · ${compat}`;

  const bsBox = document.getElementById('bs-explain-box');
  if (bsBox) {
    bsBox.innerHTML = `
      <div class="bs-explain-inner">
        <div class="bs-explain-title">Binary Search — Internal Validation</div>
        <div class="bs-flow">
          <div class="bs-flow-step">User selected <strong>${slotId}</strong> on <strong>${floorLabel(slot.floor)}</strong></div>
          <div class="bs-flow-arrow">↓</div>
          <div class="bs-flow-step">Slot ID passed to Binary Search on sorted slot index</div>
          <div class="bs-flow-arrow">↓</div>
          <div class="bs-flow-step highlight"><strong>${slotId}</strong> found at ${floorLabel(slot.floor)} — availability confirmed ✓</div>
          <div class="bs-flow-arrow">↓</div>
          <div class="bs-flow-step success">Slot validated and ready for assignment</div>
        </div>
        <div class="bs-complexity-tag">Binary Search · <span style="font-family:'Courier New'">O(log n)</span></div>
      </div>`;
  }

  showEl('manual-selected-display');
  showEl('confirm-manual-btn');

  // Switch to the slot's floor and highlight it on the main map
  if ((slot.floor || 1) !== currentFloor) selectFloor(slot.floor || 1);
  highlightSlot(slotId);
}

function clearManualSlot() {
  manualSlotId = null;
  hideEl('manual-selected-display');
  hideEl('confirm-manual-btn');
  if (selectedSlot) {
    const s  = allSlots.find(x => x.id === selectedSlot);
    const el = document.getElementById(`slot-${selectedSlot}`);
    if (el && s) el.className = `parking-slot ${s.status}`;
  }
}

// ── Manual Mode: Confirm Park ─────────────────────────────────────────────────
async function confirmManualPark() {
  if (!manualSlotId || animating) return;
  const vehicleNo   = document.getElementById('vehicle-no')?.value.trim().toUpperCase();
  const vehicleType = document.getElementById('vehicle-type')?.value;
  const priority    = document.getElementById('priority')?.value;
  if (!vehicleNo) { showToast('error', 'Missing Info', 'Enter a vehicle number.'); return; }

  // Validate format
  const validation = validateVehicleNoValue(vehicleNo);
  if (!validation.valid) {
    showToast('error', 'Invalid Vehicle Number', validation.message);
    const inp = document.getElementById('vehicle-no');
    if (inp) { inp.classList.add('vno-invalid'); inp.focus(); }
    return;
  }

  const btn = document.getElementById('confirm-manual-btn');
  setLoading(btn, true, 'Validating & Parking…');
  try {
    const allocData = await API.post('/api/allocate', {
      vehicle_no: vehicleNo, vehicle_type: vehicleType, priority,
      preferred_area: manualSlotId,
    });
    if (allocData.error) { showToast('error', 'Validation Failed', allocData.error); return; }

    const bsSteps   = allocData.algorithm_steps?.binary_search || [];
    const finalSlot = allocData.best_slot;
    showBSSteps(bsSteps);

    const parkData = await API.post('/api/park', {
      vehicle_no: vehicleNo, vehicle_type: vehicleType, priority,
      slot_id: finalSlot.id, reasons: allocData.reasons,
    });
    if (parkData.error) { showToast('error', 'Parking Failed', parkData.error); return; }

    closeModal('park-modal');
    showToast('success', 'Vehicle Parked',
      `${vehicleNo} → ${finalSlot.id} · ${floorLabel(finalSlot.floor)}`);
    await animateCarEntry(finalSlot.id, vehicleType);
    updateSlotUI(finalSlot.id, 'occupied');
    refreshStats();
    refreshVehicleList();
    showManualAlgoFlow(manualSlotId, bsSteps, finalSlot);
    manualSlotId = null;
  } catch(e) { showToast('error', 'Network Error', 'Could not reach server.');
  } finally  { setLoading(btn, false, 'Confirm & Park'); }
}

// ── Algorithm visualization ───────────────────────────────────────────────────
const VIZ_STEPS_DATA = [
  { title: 'Scanning Available Slots',    desc: 'All available slots across all 3 floors collected from DB' },
  { title: 'Applying Vehicle Constraints',desc: 'Incompatible slot types filtered out' },
  { title: 'Building Priority Queue',     desc: 'Min-heap constructed — O(n log n)' },
  { title: 'Applying Greedy Selection',   desc: 'Cost function minimised across candidates — O(n)' },
  { title: 'Best Slot Identified',        desc: 'Optimal slot on optimal floor confirmed' },
  { title: 'Vehicle Routed to Slot',      desc: 'Car animation dispatched to assigned slot' },
];
function runAlgoVizSteps() {
  const c = document.getElementById('viz-steps');
  if (!c) return;
  c.innerHTML = VIZ_STEPS_DATA.map((s, i) => `
    <div class="viz-step" id="viz-step-${i}">
      <div>
        <div class="viz-step-num">${i+1}</div>
        ${i < VIZ_STEPS_DATA.length-1 ? '<div class="viz-step-line-v"></div>' : ''}
      </div>
      <div class="viz-step-content"><h4>${s.title}</h4><p>${s.desc}</p></div>
    </div>`).join('');
  let i = 0;
  const tick = () => {
    if (i > 0) document.getElementById(`viz-step-${i-1}`)?.classList.replace('active','done');
    document.getElementById(`viz-step-${i}`)?.classList.add('active');
    i++;
    if (i <= VIZ_STEPS_DATA.length) setTimeout(tick, 650);
  };
  tick();
}
function showManualAlgoFlow(slotId, bsSteps, slot) {
  const c = document.getElementById('viz-steps');
  if (!c) return;
  const fLbl = floorLabel(slot?.floor || 1);
  const steps = [
    { title: `User selected ${slotId}`,    desc: `Slot on ${fLbl} chosen via visual parking map` },
    { title: 'Binary Search initiated',     desc: `Searching sorted slot index for "${slotId}" — O(log n)` },
    { title: `${slotId} found`,             desc: bsSteps.find(s=>s.includes('FOUND')) || `Slot at ${fLbl} located` },
    { title: 'Availability verified',       desc: 'Status confirmed as available in database' },
    { title: `${slotId} · ${fLbl} assigned`,desc: 'Slot validated and assigned to vehicle' },
  ];
  c.innerHTML = steps.map((s, i) => `
    <div class="viz-step" id="viz-step-${i}">
      <div>
        <div class="viz-step-num">${i+1}</div>
        ${i < steps.length-1 ? '<div class="viz-step-line-v"></div>' : ''}
      </div>
      <div class="viz-step-content"><h4>${s.title}</h4><p>${s.desc}</p></div>
    </div>`).join('');
  let i = 0;
  const tick = () => {
    if (i > 0) document.getElementById(`viz-step-${i-1}`)?.classList.replace('active','done');
    document.getElementById(`viz-step-${i}`)?.classList.add('active');
    i++;
    if (i <= steps.length) setTimeout(tick, 650);
  };
  tick();
}
function showBSSteps(steps) {
  const panel = document.getElementById('bs-steps-panel');
  if (!panel || !steps.length) return;
  panel.innerHTML = steps.map(s =>
    `<div class="algo-step-line ${s.includes('FOUND')?'success':s.includes('NOT FOUND')?'excluded':''}">${s}</div>`
  ).join('');
  showEl('bs-steps-wrapper');
}

// ── Highlight slot on map ─────────────────────────────────────────────────────
function highlightSlot(slotId) {
  document.querySelectorAll('#parking-lot-wrapper .parking-slot.selected').forEach(el => {
    const s = allSlots.find(x => x.id === el.dataset.id);
    if (s) el.className = `parking-slot ${s.status}`;
  });
  const el = document.getElementById(`slot-${slotId}`);
  if (el) { el.classList.add('selected'); el.scrollIntoView({ behavior:'smooth', block:'nearest' }); }
}

// ── Update slot UI after park/exit ────────────────────────────────────────────
function updateSlotUI(slotId, status) {
  const el = document.getElementById(`slot-${slotId}`);
  if (el) {
    el.className = `parking-slot ${status}`;
    const sil = el.querySelector('.slot-car-silhouette');
    if (status === 'available' && sil) sil.remove();
    if (status === 'occupied' && !sil) {
      const d = document.createElement('div');
      d.className = 'slot-car-silhouette';
      d.innerHTML = carSVG('#f85149');
      el.appendChild(d);
    }
  }
  const s = allSlots.find(x => x.id === slotId);
  if (s) s.status = status;
}

// ── Exit vehicle ──────────────────────────────────────────────────────────────
async function exitVehicle() {
  const input     = document.getElementById('exit-vehicle-no');
  const vehicleNo = input?.value.trim().toUpperCase();
  if (!vehicleNo) { showToast('error', 'Missing Info', 'Enter a vehicle number.'); return; }
  const btn = document.getElementById('exit-btn');
  setLoading(btn, true, 'Processing…');
  try {
    const data = await API.post('/api/exit', { vehicle_no: vehicleNo });
    if (data.error) { showToast('error', 'Exit Failed', data.error); return; }

    const freedSlot = allSlots.find(s => s.id === data.freed_slot);
    showToast('success', 'Vehicle Exited',
      `${vehicleNo} freed ${data.freed_slot} · ${floorLabel(freedSlot?.floor || 1)} — ${formatDuration(data.duration_mins)}`);
    await animateCarExit(data.freed_slot);
    updateSlotUI(data.freed_slot, 'available');
    refreshStats();
    refreshVehicleList();
    if (input) input.value = '';
    closeModal('exit-quick-modal');
    showBSSteps(data.binary_search_steps || []);
  } catch(e) { showToast('error', 'Network Error', 'Could not reach server.');
  } finally  { setLoading(btn, false, 'Exit Vehicle'); }
}

// ── quickExit (from vehicle list) ─────────────────────────────────────────────
async function quickExit(vehicleNo) {
  const exitQuickModal = document.getElementById('exit-quick-modal');
  const exitDashModal  = document.getElementById('exit-modal');
  if (exitQuickModal) {
    const input = document.getElementById('exit-vehicle-no');
    if (input) input.value = vehicleNo;
    openModal('exit-quick-modal');
  } else if (exitDashModal) {
    const input = document.getElementById('exit-vehicle-no');
    if (input) input.value = vehicleNo;
    openModal('exit-modal');
  } else {
    if (!confirm(`Exit vehicle ${vehicleNo}?`)) return;
    try {
      const data = await API.post('/api/exit', { vehicle_no: vehicleNo });
      if (data.error) { showToast('error', 'Exit Failed', data.error); return; }
      const freedSlot = allSlots.find(s => s.id === data.freed_slot);
      showToast('success', 'Vehicle Exited',
        `${vehicleNo} freed ${data.freed_slot} · ${floorLabel(freedSlot?.floor || 1)}`);
      updateSlotUI(data.freed_slot, 'available');
      refreshStats();
      refreshVehicleList();
    } catch(e) { showToast('error', 'Error', 'Could not reach server.'); }
  }
}

// ── Car Animation ─────────────────────────────────────────────────────────────
function getSlotPos(slotId) {
  const slotEl  = document.getElementById(`slot-${slotId}`);
  const wrapper = document.getElementById('parking-lot-wrapper');
  if (!slotEl || !wrapper) return null;
  const wRect = wrapper.getBoundingClientRect();
  const sRect = slotEl.getBoundingClientRect();
  return { x: sRect.left - wRect.left + sRect.width/2 - 17, y: sRect.top - wRect.top + sRect.height/2 - 10 };
}
function getEntrancePos() {
  const w = document.getElementById('parking-lot-wrapper');
  return w ? { x: w.offsetWidth/2 - 17, y: 10 } : { x:100, y:0 };
}
function getExitPos() {
  const w = document.getElementById('parking-lot-wrapper');
  return w ? { x: w.offsetWidth/2 - 17, y: w.offsetHeight - 40 } : { x:100, y:500 };
}
function createCar(slotId, color) {
  const layer = document.getElementById('car-layer');
  let car = document.getElementById(`car-${slotId}`);
  if (car) car.remove();
  car = document.createElement('div');
  car.id = `car-${slotId}`;
  car.style.cssText = 'position:absolute;pointer-events:none;transition:top 0.65s cubic-bezier(.4,0,.2,1),left 0.65s cubic-bezier(.4,0,.2,1);';
  car.innerHTML = carSVG(color);
  if (layer) layer.appendChild(car);
  return car;
}
function moveCar(car, pos, delay = 0) {
  return new Promise(r => setTimeout(() => { car.style.left = pos.x+'px'; car.style.top = pos.y+'px'; setTimeout(r, 700); }, delay));
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function animateCarEntry(slotId, vehicleType) {
  animating = true;
  const colors = { car:'#38bdf8', bike:'#22c55e', ev:'#a78bfa' };
  const car      = createCar(slotId, colors[vehicleType] || '#38bdf8');
  const entrance = getEntrancePos();
  const slotPos  = getSlotPos(slotId);
  car.style.left = entrance.x+'px'; car.style.top = entrance.y+'px';
  car.style.opacity = '0';
  await sleep(80);
  car.style.transition = 'opacity 0.3s,top 0.65s cubic-bezier(.4,0,.2,1),left 0.65s cubic-bezier(.4,0,.2,1)';
  car.style.opacity = '1';
  if (slotPos) {
    const roadY = slotPos.y - 30;
    await moveCar(car, { x:entrance.x, y:roadY }, 120);
    await moveCar(car, { x:slotPos.x, y:roadY }, 100);
    await moveCar(car, slotPos, 100);
  }
  carParked[slotId] = { element: car, color: colors[vehicleType] || '#38bdf8' };
  animating = false;
}
async function animateCarExit(slotId) {
  animating = true;
  const car     = document.getElementById(`car-${slotId}`);
  if (!car) { animating = false; return; }
  const exitPos = getExitPos();
  const slotPos = getSlotPos(slotId);
  const roadY   = exitPos.y - 50;
  if (slotPos) await moveCar(car, { x:slotPos.x, y:roadY }, 50);
  await moveCar(car, { x:exitPos.x, y:roadY }, 100);
  await moveCar(car, exitPos, 100);
  car.style.transition = 'opacity 0.4s';
  car.style.opacity = '0';
  await sleep(450);
  car.remove();
  delete carParked[slotId];
  animating = false;
}

// ── Place pre-parked car instantly ────────────────────────────────────────────
function placeCarOnSlot(slotId, color = '#38bdf8') {
  const pos = getSlotPos(slotId);
  if (!pos) return;
  let car = document.getElementById(`car-${slotId}`);
  if (!car) {
    const layer = document.getElementById('car-layer');
    car = document.createElement('div');
    car.id = `car-${slotId}`;
    car.style.cssText = 'position:absolute;pointer-events:none;';
    car.innerHTML = carSVG(color);
    if (layer) layer.appendChild(car);
  }
  car.style.left = pos.x+'px'; car.style.top = pos.y+'px';
  carParked[slotId] = { element: car, color };
}

// ── Currently parked vehicles list ────────────────────────────────────────────
async function refreshVehicleList() {
  const container = document.getElementById('vehicles-list');
  if (!container) return;
  try {
    const vehicles = await API.get('/api/vehicles');
    if (!vehicles.length) {
      container.innerHTML = `<div class="empty-state" style="padding:1rem">
        <div class="empty-icon" style="font-size:2rem;opacity:0.3">P</div>
        <h3>No vehicles currently parked</h3></div>`;
      return;
    }
    container.innerHTML = vehicles.map(v => {
      // find floor from allSlots cache; fallback to 1
      const slotData = allSlots.find(s => s.id === v.slot_id);
      const fLbl = floorLabel(slotData?.floor || v.floor || 1);
      return `<div class="vehicle-card mb-1 fade-in" data-slot="${v.slot_id}">
        ${vehicleIcon(v.vehicle_type)}
        <div class="vehicle-info">
          <div class="vehicle-no">${v.vehicle_no}</div>
          <div class="vehicle-meta">${v.vehicle_type.toUpperCase()} · ${priorityLabel(v.priority)} · ${formatTime(v.entry_time)}</div>
          <div class="vehicle-floor-tag">${fLbl}</div>
        </div>
        <span class="vehicle-slot-badge" style="cursor:pointer" onclick="onSlotClick('${v.slot_id}')">${v.slot_id}</span>
        <button class="btn btn-danger btn-sm" onclick="quickExit('${v.vehicle_no}')">Exit</button>
      </div>`;
    }).join('');
  } catch(e) { console.warn('Vehicle list refresh failed', e); }
}

// ── Override refreshStats to also update floor sub-labels ─────────────────────
const _origRefreshStats = window.refreshStats;
async function refreshStats() {
  if (typeof _origRefreshStats === 'function') await _origRefreshStats();
  try {
    const stats = await API.get('/api/stats');
    setEl('fs-total', stats.total);
    setEl('fs-avail', stats.available);
    setEl('fs-occ',   stats.occupied);
    setEl('fs-res',   stats.reserved);
  } catch(_) {}
}

// ── Utility ───────────────────────────────────────────────────────────────────
function showEl(id)  { const e = document.getElementById(id); if (e) e.style.display = ''; }
function hideEl(id)  { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
function setEl(id,v) { const e = document.getElementById(id); if (e) e.textContent = v; }
function setLoading(btn, loading, label) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? `<span class="spinner"></span> ${label}` : label;
}

// ── Page init ─────────────────────────────────────────────────────────────────
async function initParkingPage() {
  try {
    const slots    = await API.get('/api/slots');
    allSlots       = slots;
    renderParkingLot(slots);

    const vehicles = await API.get('/api/vehicles');
    const colors   = { car:'#38bdf8', bike:'#22c55e', ev:'#a78bfa' };
    for (const v of vehicles) {
      await sleep(80);
      const s = allSlots.find(x => x.id === v.slot_id);
      if (s) s._parked_type = v.vehicle_type;
      // Only place car on current floor
      if ((s?.floor || 1) === currentFloor) {
        placeCarOnSlot(v.slot_id, colors[v.vehicle_type] || '#38bdf8');
      }
    }
    refreshVehicleList();
  } catch(e) { showToast('error', 'Load Failed', 'Could not load parking data.'); }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('parking-lot-wrapper')) initParkingPage();
  hideEl('alloc-result');
  hideEl('confirm-park-btn');
  hideEl('bs-steps-wrapper');
  hideEl('manual-selected-display');
  hideEl('confirm-manual-btn');
  hideEl('slot-action-area');
});
