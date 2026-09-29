/* STAFF / ADMIN / SUPER ADMIN screens.
   REAL (backend): Handover for approved claims.  Everything else here is MOCK sample data for now,
   except CSV export and Print, which really work in the browser. */

// ---------- Dashboard (MOCK numbers, richer layout) ----------
V.dash = () => {
  const go_ = (n, l, page) => `<div class="box stat" style="cursor:pointer" onclick="go('${page}')"><b>${n}</b><span>${l}</span></div>`;
  return head('Dashboard', 'How lost and found is going across the school.') +
    grid([stat(84, 'Items this term'), stat('71%', 'Returned to owners'), stat('1.8 days', 'Average time to return'), stat(6, 'Waiting for owners')]) +
    `<div class="cols even"><div><h2>Returns per month</h2>${bars([['May', 8], ['Jun', 12], ['Jul', 9], ['Aug', 15], ['Sep', 21]])}</div>` +
    `<div><h2>Items by category</h2>${card(donut([['Electronics', 32, '#0e7c7b'], ['Wallet', 22, '#e9a23b'], ['Bag', 18, '#5b6fb0'], ['Keys', 14, '#b3372f'], ['Other', 14, '#3f8f5a']]))}</div></div>` +
    '<h2>Needs attention</h2>' + grid([go_(3, 'Items to receive', 'queue'), go_(2, 'Claims to verify', 'claims'), go_(3, 'Expiring soon', 'expiry'), go_(5, 'Open alerts', 'alerts')]);
};

// ---------- Alerts & to-do ----------
M.alerts = [
  {sev: 'High', title: 'Items waiting to be received', text: '3 items have waited more than 3 days.', go: 'queue', done: false},
  {sev: 'High', title: 'Blocked login attempts', text: 'Too many failed logins for one account.', go: 'audit', done: false},
  {sev: 'Medium', title: 'Claims waiting for verification', text: '2 claims have waited more than 2 days.', go: 'claims', done: false},
  {sev: 'Medium', title: 'Items expiring soon', text: '3 items pass the storage period this week.', go: 'expiry', done: false},
  {sev: 'Low', title: 'Shelf almost full', text: 'Shelf C1 is full.', go: 'storage', done: false}
];
function doneAlert(i) { M.alerts[i].done = !M.alerts[i].done; toast(M.alerts[i].done ? 'Marked as done' : 'Marked as open'); render(); }
V.alerts = () => {
  const f = ui('al', 'All');
  const list = M.alerts.map((a, i) => ({...a, i})).filter(a => f === 'All' || a.sev === f);
  return head('Alerts & to-do', 'Everything that needs attention in one list.') + chips('al', ['All', 'High', 'Medium', 'Low'], 'All') +
    list.map(a => `<div class="tag${a.done ? ' done' : ''}"><div class="row"><div>${badge(a.sev, a.sev === 'High' ? 'no' : a.sev === 'Low' ? 'ok' : '')} <b>${a.title}</b><div class="meta">${a.text}</div></div><div>${btn('Open', `go('${a.go}')`, 'sec')} ${btn(a.done ? 'Reopen' : 'Done', `doneAlert(${a.i})`, 'sec')}</div></div></div>`).join('');
};

// ---------- Handover (REAL for approved claims) ----------
const ID_TYPES = ['Student ID', 'Driver license', 'Passport', 'Employee ID', 'Other'];
function hoUpdate(id) { const ok = [1, 2, 3].every(n => document.getElementById(`hoC${id}_${n}`).checked); document.getElementById('hoBtn' + id).disabled = !ok; }
async function doHandover(id) {
  if (!id) { toast('This is a sample. Real claims appear here.'); return; }
  try { await api('handover_claim', {id, id_type: document.getElementById('hoId' + id).value}); toast('Item returned'); await loadClaims(); render(); }
  catch (e) { toast(e.message); }
}
const handoverCard = (id, who, item, code, answers, sample) =>
  `<div class="box" style="margin-bottom:14px"><div class="row"><div><b>${esc(item)}</b><div class="meta">${esc(code || '-')}</div><div class="meta"><span>Owner</span> <b>${esc(who)}</b></div></div>${sample ? badge('Sample') : badge('Approved', 'ok')}</div>` +
  (answers ? `<div class="box" style="margin:12px 0;background:#fafbfb"><span class="meta">Claimant's answers</span><div style="white-space:pre-line">${esc(answers)}</div></div>` : '') +
  ['Owner showed the pickup pass', 'Photo ID matches the owner', 'Answers match the item'].map((t, n) => `<label class="chk"><input type="checkbox" id="hoC${id}_${n + 1}" onchange="hoUpdate(${id})"> <span>${t}</span></label>`).join('') +
  `<div class="two" style="margin-top:12px">${field('ID shown', `<select id="hoId${id}">${opts(ID_TYPES)}</select>`)}<div></div></div>` +
  `<div class="btnrow"><button class="btn" id="hoBtn${id}" disabled onclick="doHandover(${id})">Complete handover</button></div></div>`;
V.handover = () => {
  const list = AUTH.claimsQueue.filter(c => c.status === 'approved');
  return head('Handover', 'Check the ID and hand the item to its owner.') +
    (list.length ? list.map(c => handoverCard(c.id, c.claimantName, c.itemTitle, c.itemCode, c.answers, false)).join('')
      : note('No approved claims are waiting for handover.', 'teal') + handoverCard(0, 'Aiko Tanaka', 'Silver earphones', 'LF-2026-0148', 'White case with a star sticker', true));
};

// ---------- Storage map (MOCK) ----------
const SHELF_BASE = {A1: 6, A2: 4, A3: 8, A4: 3, B1: 5, B2: 2, B3: 7, B4: 9, C1: 10, C2: 3, C3: 6, C4: 4};
V.storage = () => {
  const sel = ui('shelf', ''), q = String(ui('scode', '')).trim().toUpperCase();
  const hit = q ? M.items.find(i => i.code === q) : null;
  const tiles = Object.keys(SHELF_BASE).map(s => {
    const n = SHELF_BASE[s], pct = n * 10;
    return `<button class="shelf ${sel === s ? 'sel' : ''} ${hit && hit.shelf === s ? 'hit' : ''}" onclick="setUi('shelf','${sel === s ? '' : s}')"><b>${s}</b><div class="meta">${n} / 10</div>${prog(pct, pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : '')}</button>`;
  }).join('');
  const onShelf = M.items.filter(i => i.shelf === sel);
  return head('Storage map', 'See which shelves are full and where an item is.') +
    `<div class="toolbar"><input placeholder="Item code" value="${esc(ui('scode', ''))}" onchange="setUi('scode',this.value)">${q ? (hit ? `<span class="pill">${esc(hit.code)} → ${esc(hit.shelf)}</span>` : '<span class="pill no">No item with this code</span>') : ''}</div>` +
    `<div class="shelfgrid">${tiles}</div>` +
    (sel ? `<h2>Items on this shelf</h2>${onShelf.length ? table(['Code', 'Item', 'Place', 'Days'], onShelf.map(i => [esc(i.code), esc(i.t), esc(i.p), i.days])) : '<div class="box meta">This shelf has no listed items.</div>'}` : '');
};

// ---------- All items (MOCK; CSV export is real) ----------
const S_LABEL = {2: 'At office', 3: 'Matched', 4: 'Verified', 5: 'Returned'};
function downloadCsv(name, rows) {
  const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], {type: 'text/csv;charset=utf-8'}));
    a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('CSV downloaded');
  } catch (e) { toast('Could not create the file'); }
}
const exportItemsCsv = () => downloadCsv('items.csv', [['Code', 'Item', 'Category', 'Place', 'Date', 'Status', 'Shelf']].concat(M.items.map(i => [i.code, i.t, i.c, i.p, i.d, S_LABEL[i.s], i.shelf])));
V.allitems = () => {
  const f = ui('ai', 'All'), q = String(ui('aiq', '')).toLowerCase();
  const list = M.items.filter(i => (f === 'All' || S_LABEL[i.s] === f) && (!q || (i.t + i.code + i.p).toLowerCase().includes(q)));
  return head('All items', 'Every item in your organization.') +
    `<div class="toolbar">${chips('ai', ['All', 'At office', 'Matched', 'Verified', 'Returned'], 'All')}<input class="grow" placeholder="Search items" value="${esc(ui('aiq', ''))}" onchange="setUi('aiq',this.value)">${btn('Export CSV', 'exportItemsCsv()', 'sec')}${btn('Print labels', "toast('Labels sent to the printer')", 'sec')}</div>` +
    table(['', 'Code', 'Item', 'Category', 'Place', 'Date', 'Status', 'Shelf', ''], list.map(i => ['<input type="checkbox">', esc(i.code), esc(i.t), esc(i.c), esc(i.p), esc(i.d), badge(S_LABEL[i.s], i.s === 5 ? 'ok' : ''), esc(i.shelf), btn('History', `U.hist='${i.code}';go('itemhistory')`, 'sec')]), 'No items match.');
};

// ---------- Match review (MOCK) ----------
M.review = [
  {id: 1, lost: 'Black wallet · Aiko T.', found: 'Black leather wallet · LF-2026-0144', score: 92, why: ['Same category', 'Same place', 'Same day', 'Similar description'], st: 'Pending'},
  {id: 2, lost: 'Earphones · Ken M.', found: 'Silver earphones · LF-2026-0148', score: 71, why: ['Same category', 'Same place', 'Date within 2 days'], st: 'Pending'},
  {id: 3, lost: 'Keys · Sara I.', found: 'House keys · LF-2026-0142', score: 44, why: ['Same category', 'Same day'], st: 'Pending'}
];
function decideReview(id, st) { M.review.find(r => r.id === id).st = st; toast(st === 'Confirmed' ? 'Match confirmed' : 'Match rejected'); render(); }
function linkManual() {
  openModal(`<h1 style="font-size:20px">Link manually</h1><p class="sub">Choose the lost report and the found item that belong together.</p>` +
    field('Lost report', `<select>${opts(M.review.map(r => r.lost))}</select>`) + field('Found item', `<select>${opts(M.items.map(i => i.t + ' · ' + i.code))}</select>`) +
    `<button class="btn" onclick="closeModal();toast('Items linked')">Link items</button> <button class="btn sec" onclick="closeModal()">Cancel</button>`);
}
V.matchreview = () => {
  const t = ui('mr', 'Pending');
  return head('Match review', 'Check what the system suggests before owners see it.') + `<div class="toolbar">${tabs('mr', ['Pending', 'Confirmed', 'Rejected'], 'Pending')}<span class="grow"></span>${btn('Link manually', 'linkManual()', 'sec')}</div>` +
    (M.review.filter(r => r.st === t).map(r => {
      const cls = r.score >= 80 ? '' : r.score >= 60 ? 'mid' : 'low';
      return `<div class="box" style="margin-bottom:14px"><div class="row"><div class="cmp" style="flex:1"><div><span class="meta">Lost report</span><br><b>${esc(r.lost)}</b></div><div><span class="meta">Found item</span><br><b>${esc(r.found)}</b></div></div><div style="text-align:center;margin-left:18px"><div class="score ${cls}">${r.score}%</div><div class="meta">Confidence</div></div></div>` +
        `<div class="pillrow">${r.why.map(w => `<span class="pill">${w}</span>`).join('')}</div>` + (t === 'Pending' ? `<div class="btnrow">${btn('Confirm', `decideReview(${r.id},'Confirmed')`)}${btn('Reject', `decideReview(${r.id},'Rejected')`, 'bad')}</div>` : '') + '</div>';
    }).join('') || '<div class="box meta">Nothing here yet.</div>');
};

// ---------- Item history (MOCK) ----------
V.itemhistory = () => {
  const code = ui('hist', M.items[0].code), it = M.items.find(i => i.code === code) || M.items[0];
  const ev = [['Reported', `${it.by} · ${it.d}`, 'on'], ['Received at office', `Sara Ito · ${it.d}`, 'on'], ['Matched', it.d, 'on'], ['Claim approved', `Sara Ito · ${it.d}`, 'on'], ['Returned', it.d, 'on']].slice(0, Math.max(2, it.s));
  return head('Item history', 'Who touched this item and when.') + `<div class="toolbar"><select onchange="setUi('hist',this.value)">${M.items.map(i => `<option value="${i.code}" ${i.code === it.code ? 'selected' : ''}>${i.code} · ${i.t}</option>`).join('')}</select></div>` +
    `<div class="cols"><div>${card('<h2 style="margin-top:0">Timeline</h2>' + timeline(ev))}</div><div>${card(`<b>${esc(it.t)}</b><div class="meta">${esc(it.c)} · ${esc(it.p)}</div><div class="meta"><span>Shelf</span> <b>${esc(it.shelf)}</b></div>${qrSvg(it.code, 120)}<div style="text-align:center"><b>${esc(it.code)}</b></div><div class="btnrow" style="justify-content:center">${btn('Print label', "toast('Label sent to the printer')", 'sec')}</div>`)}</div></div>`;
};

// ---------- Expiry queue + Disposal records (MOCK) ----------
const STORAGE_DAYS = 90;
V.expiry = () => {
  const f = ui('ex', 'All');
  const all = M.items.filter(i => i.s < 5).sort((a, b) => b.days - a.days);
  const soon = all.filter(i => i.days < STORAGE_DAYS && STORAGE_DAYS - i.days <= 30), over = all.filter(i => i.days >= STORAGE_DAYS);
  const list = f === 'All' ? all : f === 'Expired' ? over : soon;
  return head('Expiry queue', 'Items that stay unclaimed for too long.') + grid([stat(soon.length, 'Expiring soon'), stat(over.length, 'Expired'), stat(STORAGE_DAYS, 'Days kept')]) +
    `<div class="toolbar">${chips('ex', ['All', 'Expiring soon', 'Expired'], 'All')}</div>` +
    table(['Item', 'Shelf', 'Days kept', 'Time left', 'Actions'], list.map(i => [`<b>${esc(i.t)}</b><div class="meta">${esc(i.code)}</div>`, esc(i.shelf), i.days, prog(i.days / STORAGE_DAYS * 100, i.days >= STORAGE_DAYS ? 'bad' : STORAGE_DAYS - i.days <= 30 ? 'warn' : ''),
      `${btn('Notify owner', "toast('Owner notified')", 'sec')} ${btn('Extend 30 days', `extendItem('${i.code}')`, 'sec')} ${btn('Dispose', `U.disp='${i.code}';go('disposal')`, 'bad')}`]), 'Nothing to show.');
};
function extendItem(code) { const i = M.items.find(x => x.code === code); if (i) { i.days = Math.max(0, i.days - 30); toast('Storage extended'); render(); } }
function recordDisposal() {
  const code = document.getElementById('dpItem').value, i = M.items.find(x => x.code === code);
  if (!i) return;
  M.disposal.unshift({code: i.code, t: i.t, method: document.getElementById('dpMethod').value, date: 'Today', by: S.currentUser.name, reason: (document.getElementById('dpReason').value || '-')});
  M.items = M.items.filter(x => x.code !== code); U.disp = ''; toast('Disposal recorded'); render();
}
V.disposal = () => {
  const cands = M.items.filter(i => i.s < 5);
  return head('Disposal records', 'Every item that left the office without its owner.') +
    (cands.length ? card(`<h2 style="margin-top:0">Record a disposal</h2><div class="two">${field('Item', `<select id="dpItem">${cands.map(i => `<option value="${i.code}" ${ui('disp', '') === i.code ? 'selected' : ''}>${i.code} · ${i.t}</option>`).join('')}</select>`)}${field('Method', `<select id="dpMethod">${opts(['Donated', 'Handed to police', 'Recycled', 'Disposed'])}</select>`)}</div>${field('Reason', '<input id="dpReason" placeholder="e.g. Storage period over">')}${btn('Record disposal', 'recordDisposal()')}`, 'margin-bottom:16px') : '') +
    '<h2>History</h2>' + table(['Code', 'Item', 'Method', 'Date', 'By', 'Reason'], M.disposal.map(d => [esc(d.code), esc(d.t), d.method, d.date, esc(d.by), esc(d.reason)]));
};

// ---------- Roles & permissions, Staff activity (MOCK) ----------
function setRole(i, r) { M.people[i].role = r; toast('Role updated'); render(); }
V.roles = () => {
  const yes = '✓', no = '—';
  const caps = [['Report items', 1, 1, 1, 0], ['Receive found items', 0, 1, 1, 0], ['Verify claims and hand over', 0, 1, 1, 0], ['Manage users and roles', 0, 0, 1, 0], ['View audit log', 0, 0, 1, 0], ['Change settings', 0, 0, 1, 0], ['Manage organizations', 0, 0, 0, 1]];
  return head('Roles & permissions', 'Decide who can do what.') + `<div class="toolbar"><span class="grow"></span>${btn('Invite staff', "openModal('<h1 style=\"font-size:20px\">Invite staff</h1><p class=\"sub\">We will send an invitation by email.</p>'+field('Email','<input type=\"email\" placeholder=\"name@example.com\">')+'<button class=\"btn\" onclick=\"closeModal();toast(\\'Invitation sent\\')\">Send invitation</button>')", 'sec')}</div>` +
    table(['Name', 'Email', 'Role', 'Member since', ''], M.people.map((p, i) => [`<b>${esc(p.name)}</b>`, esc(p.email), `<select onchange="setRole(${i},this.value)">${['member', 'staff', 'admin'].map(r => `<option value="${r}" ${p.role === r ? 'selected' : ''}>${ROLE_NAMES[r]}</option>`).join('')}</select>`, p.since, btn('Remove access', "toast('Access removed')", 'bad')])) +
    '<h2>What each role can do</h2><div class="matrix">' + table(['Permission', 'Member', 'Staff', 'Org admin', 'Super admin'], caps.map(c => [c[0]].concat(c.slice(1).map(v => v ? yes : no)))) + '</div>';
};
V.staffactivity = () => {
  const rows = [['Sara Ito', 24, 18, 31], ['Ravi Perera', 17, 12, 20], ['Mr. Yamada', 6, 4, 9]], max = 31;
  return head('Staff activity', 'How much each person handled this term.') + grid(rows.map(r => card(`<b>${r[0]}</b><div class="meta"><span>Items received</span> <b>${r[1]}</b></div><div class="meta"><span>Items returned</span> <b>${r[2]}</b></div><div class="meta"><span>Claims verified</span> <b>${r[3]}</b></div>${prog(r[3] / max * 100)}`))) +
    '<h2>Details</h2>' + table(['Staff', 'Items received', 'Items returned', 'Claims verified'], rows.map(r => [`<b>${r[0]}</b>`, r[1], r[2], r[3]])) +
    '<h2>Latest actions</h2>' + timeline([['Item received at office', 'Sara Ito · 11:40', 'on'], ['Claim approved', 'Ravi Perera · 10:05', 'on'], ['Item handed over', 'Sara Ito · Yesterday', '']]);
};

// ---------- Reports + Hotspot map (MOCK; CSV and Print are real) ----------
const REPORT = {'September 2026': [21, 15, 71], 'August 2026': [15, 9, 60], 'July 2026': [9, 6, 67]};
const CAT_ROWS = [['Electronics', 27, 20], ['Wallet', 18, 15], ['Bag', 15, 9], ['Keys', 12, 8], ['Other', 12, 5]];
function exportReportCsv() { downloadCsv('report.csv', [['Category', 'Reported', 'Returned', 'Return rate']].concat(CAT_ROWS.map(r => [r[0], r[1], r[2], Math.round(r[2] / r[1] * 100) + '%']))); }
V.reports = () => {
  const m = ui('rm', 'September 2026'), d = REPORT[m];
  return head('Reports', 'A summary you can save or print.') + `<div class="toolbar"><select onchange="setUi('rm',this.value)">${opts(Object.keys(REPORT), m)}</select><span class="grow"></span>${btn('Export CSV', 'exportReportCsv()', 'sec')}${btn('Print / PDF', 'window.print()', 'sec')}</div>` +
    grid([stat(d[0], 'Items reported'), stat(d[1], 'Items returned'), stat(d[2] + '%', 'Return rate')]) + '<h2>By category</h2>' +
    table(['Category', 'Reported', 'Returned', 'Return rate'], CAT_ROWS.map(r => [r[0], r[1], r[2], prog(r[2] / r[1] * 100)]));
};
const HOT = {Library: 14, Gym: 11, Cafeteria: 9, 'Room 302': 6, Entrance: 4};
V.hotspots = () => head('Hotspot map', 'Where and when items get lost the most.') + mapSvg(HOT, 'heat', 'hz') + '<div class="cols even"><div><h2>Ranking</h2>' +
  Object.entries(HOT).sort((a, b) => b[1] - a[1]).map(e => `<div class="heatrow"><span>${e[0]}</span>${prog(e[1] / 14 * 100, e[1] > 10 ? 'bad' : e[1] > 6 ? 'warn' : '')}<b>${e[1]}</b></div>`).join('') +
  `</div><div><h2>Time of day</h2>${bars([['8-10', 5], ['10-12', 9], ['12-14', 18], ['14-16', 12], ['16-18', 7]])}</div></div>` + note('Most items are lost around lunchtime. Consider a reminder in the cafeteria.', 'teal');

// ---------- Settings (MOCK, richer) + Thank-you rules ----------
M.cats = ['Wallet', 'Bag', 'Electronics', 'ID card', 'Keys', 'Other'];
M.zones = ZONES.map(z => z.id);
M.idTypes = ['Student ID', 'Driver license', 'Passport', 'Employee ID'];
function addSetting(k) { const i = document.getElementById('add_' + k), v = (i.value || '').trim(); if (v) { M[k].push(v); toast('Setting saved'); render(); } }
function rmSetting(k, i) { M[k].splice(i, 1); toast('Setting saved'); render(); }
const listEditor = (title, key, ph) => card(`<h2 style="margin-top:0">${title}</h2><div class="pillrow">${M[key].map((x, i) => `<span class="pill">${esc(x)} <a href="#" onclick="rmSetting('${key}',${i});return false" style="color:inherit;text-decoration:none">✕</a></span>`).join('')}</div><div class="toolbar"><input id="add_${key}" placeholder="${ph}">${btn('Add', `addSetting('${key}')`)}</div>`);
V.settings = () => {
  const t = ui('st', 'General');
  let body;
  if (t === 'General') body = card('<div class="sw"><span>Storage period<div class="meta">Days before unclaimed items expire</div></span><select onchange="toast(\'Setting saved\')"><option>30</option><option selected>90</option><option>180</option></select></div>' +
    sw('Thank-you points', 'Owners can thank finders after a return') + sw('Hide sensitive items from browsing', 'Wallets, IDs, phones') + sw('Require ID at handover') + sw('Warn owners before items expire', 'Sent 7 days before the end'), 'max-width:640px');
  else if (t === 'Categories') body = listEditor('Item categories', 'cats', 'New category');
  else if (t === 'Places & shelves') body = listEditor('Places on the map', 'zones', 'New place') + '<div style="height:14px"></div>' + card('<h2 style="margin-top:0">Shelves</h2><p class="meta">Rows A to C, four shelves each, ten items per shelf.</p>' + btn('Add a shelf row', "toast('Shelf row added')", 'sec'));
  else body = listEditor('Accepted ID types', 'idTypes', 'New ID type');
  return head('Settings', 'Rules for your organization.') + tabs('st', ['General', 'Categories', 'Places & shelves', 'ID types'], 'General') + body;
};
V.rewardrules = () => head('Thank-you rules', 'Thank-yous are always voluntary and come from the owner.') +
  card(sw('Enable thank-you messages', 'Owners can write a message after a return') + sw('Allow small gifts', 'Gift card codes only', false) + sw('Show badges to finders', 'Badges appear on the finder profile'), 'max-width:640px;margin-bottom:16px') +
  '<h2>Points</h2>' + table(['Rule', 'Points'], [['Item handed to the office', '<input type="number" value="5" style="width:80px">'], ['Item returned to its owner', '<input type="number" value="10" style="width:80px">'], ['Thank-you received', '<input type="number" value="5" style="width:80px">']]) +
  `<div class="btnrow">${btn('Save changes', "toast('Settings saved')")}</div>`;

// ---------- SUPER ADMIN (MOCK) ----------
V.platform = () => head('Platform statistics', 'All organizations on the service.') +
  grid([stat(3, 'Organizations'), stat(396, 'Users'), stat(153, 'Items this term'), stat('64%', 'Average return rate')]) + '<h2>Items per organization</h2>' + bars(M.orgs.map(o => [o.name.split(' ')[0], Math.round(o.items / 4)])) +
  '<h2>Details</h2>' + table(['Name', 'Type', 'Users', 'Items', 'Return rate', 'Status'], M.orgs.map(o => [`<b>${o.name}</b>`, o.type, o.users, o.items, prog(o.rate), badge('Active', 'ok')]));
const SYS = [
  ['Sep 29 09:12', 'Yokohama Demo School', 'aiko@example.com', 'Login blocked (too many attempts)', 'Security'],
  ['Sep 29 08:55', 'Yokohama Demo School', 'aiko@example.com', 'Failed login', 'Security'],
  ['Sep 28 16:20', 'Harbor Mart', 'Harbor Admin', 'Membership approved', 'Admin'],
  ['Sep 28 14:02', 'Nexa Systems', 'Nexa Admin', 'Item handed over', 'Admin'],
  ['Sep 27 10:31', 'Yokohama Demo School', 'Sara Ito', 'Claim approved', 'Admin']
];
V.sysaudit = () => {
  const f = ui('sy', 'All');
  return head('System audit', 'Important events across all organizations.') + chips('sy', ['All', 'Security', 'Admin'], 'All') +
    table(['Time', 'Organization', 'User', 'Action'], SYS.filter(r => f === 'All' || r[4] === f).map(r => [r[0], r[1], esc(r[2]), r[3]]));
};
