/* Lost & Found — shared helpers, mock data, menus and page gating for the extra screens.
   Loaded AFTER app.js (it uses V, NAV, S, AUTH, render, go, head, stat, field, opts ... from app.js).
   Screens that still use mock data are marked "MOCK" in the file that defines them. */

// ---------- small UI state (filters, tabs, selected item) ----------
const U = {};
const ui = (k, d) => (k in U ? U[k] : d);
const setUi = (k, v) => { U[k] = v; render(); };

// ---------- building blocks ----------
const badge = (t, kind = '') => `<span class="badge ${kind}">${t}</span>`;
const chips = (key, list, def) => `<div class="chips">${list.map(c => `<button class="${ui(key, def) === c ? 'on' : ''}" onclick="setUi('${key}','${c}')">${c}</button>`).join('')}</div>`;
const tabs = (key, list, def) => `<div class="seg tabrow">${list.map(c => `<button class="${ui(key, def) === c ? 'on' : ''}" onclick="setUi('${key}','${c}')">${c}</button>`).join('')}</div>`;
const table = (heads, rows, empty = 'Nothing here yet.') => `<table><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${heads.length}" class="meta">${empty}</td></tr>`}</table>`;
const card = (inner, style = '') => `<div class="box"${style ? ` style="${style}"` : ''}>${inner}</div>`;
const grid = (arr, cols) => `<div class="grid"${cols ? ` style="grid-template-columns:${cols}"` : ''}>${arr.join('')}</div>`;
const note = (html, kind = 'amber') => `<div class="box note ${kind}">${html}</div>`;
const timeline = ev => `<ul class="tl">${ev.map(e => `<li class="${e[2] || ''}"><b>${e[0]}</b><span class="meta">${e[1]}</span></li>`).join('')}</ul>`;
const prog = (pct, kind = '') => `<div class="prog ${kind}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
const bars = data => `<div class="box" style="padding-bottom:36px"><div class="bars">${data.map(x => `<div style="height:${x[1] * 6}px"><span>${x[0]} · ${x[1]}</span></div>`).join('')}</div></div>`;
const donut = parts => { let a = 0; const st = parts.map(p => { const s = a; a += p[1]; return `${p[2]} ${s}% ${a}%`; }); return `<div class="donutbox"><div class="donut" style="background:conic-gradient(${st.join(',')})"></div><div style="flex:1;min-width:150px">${parts.map(p => `<div class="lg"><i style="background:${p[2]}"></i><span>${p[0]}</span><b>${p[1]}%</b></div>`).join('')}</div></div>`; };
const kindBadge = k => badge(k === 'lost' ? 'Lost' : 'Found', k === 'lost' ? 'no' : 'ok');
const statusName = s => STEPS[Math.max(0, Math.min(4, s - 1))];
const btn = (label, js, cls = '') => `<button class="btn ${cls}" onclick="${js}">${label}</button>`;
const sw = (label, sub, on = true) => `<div class="sw"><span>${label}${sub ? `<div class="meta">${sub}</div>` : ''}</span><input type="checkbox"${on ? ' checked' : ''} onchange="toast('Setting saved')"></div>`;

// ---------- mock QR (visual only; real QR codes come in the QR phase) ----------
function qrSvg(text, size = 132) {
  const n = 21; let h = 7;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296);
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7" fill="#111"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3" fill="#111"/>`;
  let cells = '';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const inF = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
    if (!inF && rnd() > 0.52) cells += `<rect x="${x}" y="${y}" width="1" height="1" fill="#111"/>`;
  }
  return `<svg class="qrsvg" viewBox="-1 -1 23 23" width="${size}" height="${size}" role="img" aria-label="QR code"><rect x="-1" y="-1" width="23" height="23" fill="#fff"/>${cells}${finder(0, 0)}${finder(14, 0)}${finder(0, 14)}</svg>`;
}

// ---------- mock campus map ----------
const ZONES = [
  {id: 'Library', x: 30, y: 30, w: 190, h: 120},
  {id: 'Gym', x: 250, y: 30, w: 170, h: 120},
  {id: 'Cafeteria', x: 450, y: 30, w: 160, h: 120},
  {id: 'Room 302', x: 30, y: 190, w: 190, h: 130},
  {id: 'Entrance', x: 250, y: 220, w: 360, h: 100}
];
/** counts: {zoneId: n}; mode 'pins' draws numbered pins, 'heat' shades zones red by count; onclick sets ui('zone'). */
function mapSvg(counts = {}, mode = 'pins', clickKey = 'zone', fn = '') {
  const max = Math.max(1, ...Object.values(counts));
  const zones = ZONES.map(z => {
    const n = counts[z.id] || 0;
    const fill = mode === 'heat' ? `rgba(179,55,47,${(0.08 + 0.6 * n / max).toFixed(2)})` : (ui(clickKey, '') === z.id ? '#d7ecea' : '#ffffff');
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2;
    return `<g class="zone" onclick="${fn ? `${fn}('${z.id}')` : `setUi('${clickKey}','${ui(clickKey, '') === z.id ? '' : z.id}')`}"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="12" fill="${fill}" stroke="#c9d1d1" stroke-width="2"/>` +
      `<text x="${z.x + 12}" y="${z.y + 22}" font-size="14" font-weight="700" fill="#345">${z.id}</text>` +
      (n ? `<circle cx="${cx}" cy="${cy + 8}" r="17" fill="${mode === 'heat' ? '#b3372f' : '#0e7c7b'}"/><text x="${cx}" y="${cy + 14}" font-size="15" font-weight="700" fill="#fff" text-anchor="middle">${n}</text>` : '') + `</g>`;
  }).join('');
  return `<div class="mapbox"><svg viewBox="0 0 640 350" role="img" aria-label="Campus map">${zones}</svg></div>`;
}

// ---------- MOCK DATA ----------
const M = {
  items: [
    {code: 'LF-2026-0148', t: 'Silver earphones', c: 'Electronics', p: 'Room 302', d: 'Sep 26', kind: 'found', s: 2, shelf: 'A2', days: 3, by: 'Aiko T.'},
    {code: 'LF-2026-0147', t: 'Umbrella (navy)', c: 'Other', p: 'Entrance', d: 'Sep 25', kind: 'found', s: 2, shelf: 'B1', days: 4, by: 'Ken M.'},
    {code: 'LF-2026-0146', t: 'Student ID holder', c: 'ID card', p: 'Cafeteria', d: 'Sep 27', kind: 'found', s: 3, shelf: 'A4', days: 2, by: 'Mr. Yamada'},
    {code: 'LF-2026-0145', t: 'Water bottle', c: 'Other', p: 'Gym', d: 'Sep 21', kind: 'found', s: 2, shelf: 'C2', days: 8, by: 'Sara I.'},
    {code: 'LF-2026-0144', t: 'Black wallet', c: 'Wallet', p: 'Library', d: 'Sep 24', kind: 'found', s: 3, shelf: 'A1', days: 5, by: 'Ravi P.'},
    {code: 'LF-2026-0143', t: 'Blue backpack', c: 'Bag', p: 'Gym', d: 'Sep 22', kind: 'found', s: 5, shelf: 'B3', days: 7, by: 'Aiko T.'},
    {code: 'LF-2026-0142', t: 'House keys', c: 'Keys', p: 'Entrance', d: 'Sep 20', kind: 'found', s: 4, shelf: 'A3', days: 9, by: 'Ken M.'},
    {code: 'LF-2026-0141', t: 'Calculator', c: 'Electronics', p: 'Room 302', d: 'Aug 30', kind: 'found', s: 2, shelf: 'C4', days: 31, by: 'Sara I.'},
    {code: 'LF-2026-0140', t: 'Gray hoodie', c: 'Other', p: 'Library', d: 'Jul 02', kind: 'found', s: 2, shelf: 'C1', days: 89, by: 'Ravi P.'},
    {code: 'LF-2026-0139', t: 'Blue notebook', c: 'Other', p: 'Cafeteria', d: 'Jun 28', kind: 'found', s: 2, shelf: 'C3', days: 93, by: 'Mr. Yamada'}
  ],
  notes: [
    {id: 1, type: 'Matches', title: 'Possible match found', text: 'Your Black wallet may match an item found at the Library.', time: '10 min ago', unread: true, go: 'matches'},
    {id: 2, type: 'Claims', title: 'Claim approved', text: 'Bring your photo ID to the office to collect your item.', time: '2 hours ago', unread: true, go: 'pickup'},
    {id: 3, type: 'Claims', title: 'Question from staff', text: 'Staff sent you a message about your claim.', time: 'Yesterday', unread: true, go: 'messages'},
    {id: 4, type: 'Thanks', title: 'Thank-you received', text: 'The owner of the blue backpack thanked you.', time: '2 days ago', unread: false, go: 'rewards'},
    {id: 5, type: 'Storage', title: 'Storage period ending', text: 'One of your items will expire in 5 days.', time: '3 days ago', unread: false, go: 'myitems'}
  ],
  matches: [
    {id: 1, mine: {t: 'Black wallet', p: 'Library', d: 'Sep 24'}, found: {t: 'Black leather wallet', p: 'Library', d: 'Sep 24', code: 'LF-2026-0144'}, score: 92, why: ['Same category', 'Same place', 'Same day', 'Similar description']},
    {id: 2, mine: {t: 'Earphones', p: 'Room 302', d: 'Sep 25'}, found: {t: 'Silver earphones', p: 'Room 302', d: 'Sep 26', code: 'LF-2026-0148'}, score: 71, why: ['Same category', 'Same place', 'Date within 2 days']},
    {id: 3, mine: {t: 'Keys', p: 'Gym', d: 'Sep 20'}, found: {t: 'House keys', p: 'Entrance', d: 'Sep 20', code: 'LF-2026-0142'}, score: 44, why: ['Same category', 'Same day']}
  ],
  threads: [
    {id: 1, item: 'Silver earphones', with: 'Office staff', msgs: [['staff', 'Hello! Can you tell us the colour of the case?', '09:12'], ['me', 'It is white with a star sticker.', '09:20'], ['staff', 'Thank you. That matches. Please bring your ID.', '09:31']]},
    {id: 2, item: 'Black wallet', with: 'Office staff', msgs: [['staff', 'We received your claim and will check it today.', 'Yesterday']]}
  ],
  people: [
    {name: 'Aiko Tanaka', email: 'aiko@example.com', role: 'member', since: 'Apr 2026'},
    {name: 'Ken Mori', email: 'ken@example.com', role: 'member', since: 'Apr 2026'},
    {name: 'Sara Ito', email: 'sara@example.com', role: 'staff', since: 'May 2026'},
    {name: 'Ravi Perera', email: 'ravi@example.com', role: 'staff', since: 'May 2026'},
    {name: 'Mr. Yamada', email: 'yamada@example.com', role: 'admin', since: 'Mar 2026'}
  ],
  disposal: [
    {code: 'LF-2026-0121', t: 'Gray scarf', method: 'Donated', date: 'Sep 02', by: 'Mr. Yamada', reason: 'Storage period over'},
    {code: 'LF-2026-0117', t: 'USB stick', method: 'Handed to police', date: 'Aug 20', by: 'Sara Ito', reason: 'Possible personal data'}
  ],
  orgs: [
    {name: 'Yokohama Demo School', type: 'School', users: 240, items: 84, rate: 71, status: 'Active'},
    {name: 'Harbor Mart', type: 'Store', users: 36, items: 22, rate: 58, status: 'Active'},
    {name: 'Nexa Systems', type: 'Company', users: 120, items: 47, rate: 64, status: 'Active'}
  ]
};

// ---------- menus (groups start with an id beginning with '#') ----------
NAV.member = [['#1', 'Main'], ['home', 'Home'], ['notifications', 'Notifications'],
  ['#2', 'Lost & found'], ['report', 'Report an item'], ['myitems', 'My items'], ['matches', 'Possible matches'], ['browse', 'Found items'], ['foundmap', 'Map view'],
  ['#3', 'Pickup & thanks'], ['pickup', 'Pickup pass'], ['history', 'Return history'], ['rewards', 'Thanks & rewards'],
  ['#4', 'Account'], ['messages', 'Messages'], ['community', 'Community'], ['profile', 'Profile & privacy'], ['tour', 'How it works']];
NAV.staff = [['#1', 'Front desk'], ['queue', 'Work queue'], ['scan', 'Scan item'], ['register', 'Register found item'], ['claims', 'Verify claims'], ['handover', 'Handover'], ['storage', 'Storage map'],
  ['#2', 'Account'], ['notifications', 'Notifications'], ['messages', 'Messages'], ['profile', 'Profile & privacy']];
NAV.admin = [['#1', 'Overview'], ['dash', 'Dashboard'], ['alerts', 'Alerts & to-do'],
  ['#2', 'Front desk'], ['queue', 'Work queue'], ['claims', 'Verify claims'], ['register', 'Register found item'], ['scan', 'Scan item'], ['handover', 'Handover'], ['storage', 'Storage map'], ['report', 'Report an item'],
  ['#3', 'Items & matching'], ['allitems', 'All items'], ['matchreview', 'Match review'], ['itemhistory', 'Item history'], ['foundmap', 'Map view'],
  ['#4', 'Unclaimed items'], ['expiry', 'Expiry queue'], ['disposal', 'Disposal records'],
  ['#5', 'People'], ['users', 'Users'], ['roles', 'Roles & permissions'], ['staffactivity', 'Staff activity'],
  ['#6', 'Insights & security'], ['reports', 'Reports'], ['hotspots', 'Hotspot map'], ['audit', 'Audit log'],
  ['#7', 'Settings'], ['settings', 'Settings'], ['rewardrules', 'Thank-you rules'], ['notifications', 'Notifications'], ['profile', 'Profile & privacy']];
NAV.super = [['#1', 'Platform'], ['orgs', 'Organizations'], ['platform', 'Platform statistics'], ['sysaudit', 'System audit'], ['profile', 'Profile & privacy']];

// ---------- page gating + what to load when a page opens ----------
const PAGE_ROLES = {
  notifications: ['member', 'staff', 'admin'], myitems: ['member'], matches: ['member'], foundmap: ['member', 'staff', 'admin'], pickup: ['member'],
  rewards: ['member'], history: ['member'], messages: ['member', 'staff', 'admin'], profile: ['member', 'staff', 'admin', 'super'], tour: ['member'], item: ['member', 'staff', 'admin'],
  handover: ['staff', 'admin'], storage: ['staff', 'admin'],
  alerts: ['admin'], allitems: ['admin'], matchreview: ['admin'], itemhistory: ['admin'], expiry: ['admin'], disposal: ['admin'], roles: ['admin'],
  staffactivity: ['admin'], reports: ['admin'], hotspots: ['admin'], rewardrules: ['admin'], platform: ['super'], sysaudit: ['super']
};
const NEEDS_MEMBERSHIP = ['notifications', 'myitems', 'matches', 'foundmap', 'pickup', 'rewards', 'history', 'messages', 'tour', 'item'];
const PAGE_OPEN = {
  myitems: () => loadState().then(render),
  matches: () => loadState().then(render),
  pickup: () => loadState().then(render),
  history: () => loadState().then(render),
  foundmap: () => loadBrowseItems().then(render),
  handover: () => loadClaims().then(render)
};
const _go = go;
go = function (v) {
  const roles = PAGE_ROLES[v];
  if (roles && S.currentUser && !roles.includes(S.currentUser.role)) return;
  if (S.currentUser && S.currentUser.role === 'member' && NEEDS_MEMBERSHIP.includes(v) && S.currentUser.membershipStatus !== 'approved') { S.view = 'community'; render(); return; }
  if (v === 'report' && S.view !== 'report') resetWizard();
  _go(v);
  if (S.view === v && PAGE_OPEN[v]) { try { const r = PAGE_OPEN[v](); if (r && r.catch) r.catch(e => toast(e.message)); } catch (e) { toast(e.message); } }
};

// ---------- opening an item detail ----------
function openItem(id, src) { U.item = {id, src}; go('item'); }
