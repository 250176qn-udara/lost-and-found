/* MEMBER screens.
   REAL (talks to the PHP backend): Report wizard, My items, Item detail (+ claim form), Home cards, Pickup pass, Return history.
   MOCK (sample data for now): Notifications, Possible-match scores, Messages, Thanks & rewards, Profile toggles, Map counts fallback. */

// ---------- Home: keep the working page and add "Action needed", quick actions, community stats and activity ----------
const actionCard = (title, itemName, help, label, js, kind) =>
  `<div class="box note ${kind}"><div class="row"><div><b>${title}</b><div class="meta">${esc(itemName)}</div><div class="meta">${help}</div></div>${btn(label, js)}</div></div>`;

const _homeBase = V.home;
V.home = () => {
  const cards = [];
  AUTH.myClaims.filter(c => c.status === 'approved').forEach(c =>
    cards.push(actionCard('Claim approved', c.itemTitle, 'Bring your photo ID to the office.', 'Open pickup pass', "go('pickup')", 'teal')));
  AUTH.myItems.filter(i => i.kind === 'lost' && i.status === 3 && i.matchedItemId).forEach(i =>
    cards.push(actionCard('Possible match found', i.title, 'Check if this is your item.', 'Review match', "go('matches')", 'amber')));
  AUTH.myItems.filter(i => i.status === 5 && i.kind === 'lost').slice(0, 1).forEach(i =>
    cards.push(actionCard('Say thanks', i.title, 'Optional. Thank the person who found it.', 'Send thanks', "go('rewards')", 'teal')));
  const quick = `<div class="btnrow" style="margin:0 0 16px">${btn('I lost something', "S.kind='lost';go('report')")}${btn('I found something', "S.kind='found';go('report')", 'sec')}</div>`;
  const acts = '<h2>Action needed</h2>' + (cards.length ? cards.join('') : '<div class="box meta">You are all caught up.</div>');
  const comm = '<h2>Community</h2>' + grid([stat(21, 'Returned this month'), stat('71%', 'Community return rate'), stat(3, 'Items you helped return')]);
  const feed = '<h2>Recent activity</h2>' + M.notes.slice(0, 3).map(n =>
    `<div class="tag"><div class="row"><div><b>${n.title}</b><div class="meta">${n.text}</div></div><span class="meta">${n.time}</span></div></div>`).join('') +
    `<div class="btnrow">${btn('See all notifications', "go('notifications')", 'sec')}</div>`;
  let html = _homeBase();
  html = html.includes('<h2>Your items</h2>') ? html.replace('<h2>Your items</h2>', quick + acts + comm + '<h2>Your items</h2>') : html + quick + acts + comm;
  return html + feed;
};

// ---------- Notifications (MOCK) ----------
M.notesStaff = [
  {id: 11, type: 'Front desk', title: 'New found item to receive', text: 'A member reported an item that needs to be received at the office.', time: '5 min ago', unread: true, go: 'queue'},
  {id: 12, type: 'Front desk', title: 'Claim waiting for verification', text: 'A claim is waiting for a staff check.', time: '1 hour ago', unread: true, go: 'claims'},
  {id: 13, type: 'Storage', title: 'Items expiring soon', text: 'Three items will pass the storage period this week.', time: 'Yesterday', unread: false, go: 'queue'}
];
const notesFor = () => (S.role === 'member' ? M.notes : M.notesStaff);
function readNote(id) { const n = notesFor().find(x => x.id === id); if (n) { n.unread = false; go(n.go); } }
function readAll() { notesFor().forEach(n => n.unread = false); render(); }
const prefRow = (label) => [label, '<input type="checkbox" checked onchange="toast(\'Setting saved\')">', '<input type="checkbox" onchange="toast(\'Setting saved\')">'];
V.notifications = () => {
  const f = ui('nf', 'All');
  const list = notesFor().filter(n => f === 'All' || n.unread);
  return head('Notifications', 'Everything that needs your attention.') + tabs('nf', ['All', 'Unread'], 'All') +
    (list.length ? list.map(n => `<div class="tag" style="cursor:pointer" onclick="readNote(${n.id})"><div class="row"><div><span class="dot ${n.unread ? '' : 'off'}"></span><b>${n.title}</b><div class="meta">${n.text}</div></div><span class="meta">${n.time}</span></div></div>`).join('') : '<div class="box meta">No notifications.</div>') +
    `<div class="btnrow">${btn('Mark all as read', 'readAll()', 'sec')}</div>` +
    '<h2>Notification settings</h2>' + table(['Event', 'In-app', 'Email'], [prefRow('Matches'), prefRow('Claims'), prefRow('Thanks'), prefRow('Storage reminders')]);
};

// ---------- My items (REAL) ----------
V.myitems = () => {
  const f = ui('mi', 'All'), q = String(ui('miq', '')).toLowerCase();
  const list = AUTH.myItems.filter(i =>
    (f === 'All' || (f === 'Lost' && i.kind === 'lost') || (f === 'Found' && i.kind === 'found') || (f === 'Returned' && i.status === 5)) &&
    (!q || (i.title + ' ' + i.place).toLowerCase().includes(q)));
  return head('My items', 'Everything you reported, with its progress.') +
    `<div class="toolbar">${chips('mi', ['All', 'Lost', 'Found', 'Returned'], 'All')}<input class="grow" placeholder="Search my items" value="${esc(ui('miq', ''))}" onchange="setUi('miq',this.value)"></div>` +
    (list.length ? list.map(i =>
      `<div class="tag${i.status === 5 ? ' done' : ''}"><div class="row"><div><b>${esc(i.title)}</b><div class="meta">${esc(i.place)}${i.date ? ' · ' + esc(i.date) : ''}</div></div><div>${kindBadge(i.kind)} ${badge(statusName(i.status), i.status === 5 ? 'ok' : '')}</div></div>${stepper(i.status)}<div class="btnrow">${btn('Details', `openItem(${i.id},'mine')`, 'sec')}</div></div>`).join('')
      : '<div class="box meta">No items match this filter.</div>') +
    `<div class="btnrow">${btn('Report an item', "go('report')")}</div>`;
};

// ---------- Item detail + claim form (REAL data; claim goes to the backend) ----------
function findItem() {
  const r = U.item || {};
  if (r.src === 'mine') { const i = AUTH.myItems.find(x => x.id === r.id); if (i) return {...i, src: 'mine'}; }
  if (r.src === 'found') { const i = AUTH.foundItems.find(x => x.id === r.id); if (i) return {...i, kind: 'found', src: 'found'}; }
  if (r.src === 'mock') { const m = M.items.find(x => x.code === r.id); if (m) return {id: m.code, title: m.t, category: m.c, place: m.p, date: m.d, kind: m.kind, status: m.s, shelf: m.shelf, code: m.code, src: 'mock'}; }
  return null;
}
async function sendClaim(id) {
  const a = (document.getElementById('clAns').value || '').trim(), err = document.getElementById('clErr');
  err.textContent = '';
  if (!a) { err.textContent = 'Please answer the verification questions.'; return; }
  try { await api('request_claim', {found_item_id: id, answers: a}); toast('Claim sent'); await loadState(); go('home'); }
  catch (e) { err.textContent = e.message; }
}
V.item = () => {
  const it = findItem();
  if (!it) return head('Item details', 'This item is not available.') + `<div class="btnrow">${btn('Back', "go(S.role==='member'?'myitems':FIRST[S.role])", 'sec')}</div>`;
  const row = (l, v) => v ? `<div class="row" style="margin:6px 0"><span class="meta">${l}</span><b>${esc(v)}</b></div>` : '';
  const photo = it.hasPhoto ? `<img src="api/index.php?action=item_photo&id=${it.id}" alt="" style="width:100%;max-height:260px;object-fit:cover;border-radius:12px;margin-bottom:12px">`
    : `<div class="thumb" style="background:${COLORS[String(it.id).length % 5]};height:150px;border-radius:12px;margin-bottom:12px;position:relative">${esc(it.title[0])}</div>`;
  const s = it.status || 1, when = it.date || '-';
  const events = [['Reported', when, 'on'], ['Received at office', s >= 2 ? when : '-', s >= 2 ? 'on' : ''], ['Matched', s >= 3 ? when : '-', s >= 3 ? 'on' : ''], ['Verified', s >= 4 ? when : '-', s >= 4 ? 'on' : ''], ['Returned', s >= 5 ? when : '-', s >= 5 ? 'on' : '']];
  const matchCard = it.matchedItemId ? card(`<h2 style="margin-top:0">Suggested match</h2><b>${esc(it.matchedTitle || '')}</b><div class="meta">${esc(it.matchedPlace || '')}${it.matchedDate ? ' · ' + esc(it.matchedDate) : ''}</div><div class="btnrow">${btn('Review match', "go('matches')", 'sec')}</div>`) : '';
  const claim = it.src === 'found' ? card(`<h2 style="margin-top:0">Claim this item</h2><p class="meta">Answer so staff can check that it is yours.</p>${field('Describe the item (colour, marks, contents)', '<textarea id="clAns" rows="3"></textarea>')}${field('Extra proof (optional)', '<input type="file" accept="image/*">')}<div id="clErr" style="color:var(--red);margin-bottom:12px"></div>${btn('Send claim', `sendClaim(${it.id})`)}`) : '';
  const own = it.src === 'mine' && s < 5 ? `<div class="btnrow">${btn('Edit report', "toast('Editing comes in the next step')", 'sec')}${btn('Cancel report', "toast('Ask staff to cancel a report')", 'bad')}</div>` : '';
  return head(esc(it.title), 'Item details') + `<div class="cols"><div>${card(photo + row('Type', it.kind === 'lost' ? 'Lost' : 'Found') + row('Category', it.category) + row('Place', it.place) + row('Date', it.date) + row('Shelf', it.shelf) + row('Item code', it.code) + (it.description ? `<p class="meta" style="white-space:pre-line">${esc(it.description)}</p>` : '') + own)}${claim}</div>` +
    `<div>${card('<h2 style="margin-top:0">Progress</h2>' + stepper(s) + timeline(events))}${matchCard}</div></div>` +
    `<div class="btnrow">${btn('Back', "go(S.role==='member'?'myitems':FIRST[S.role])", 'sec')}</div>`;
};

// ---------- Possible matches (real matches from the server, plus sample scores when there are none) ----------
V.matches = () => {
  const real = AUTH.myItems.filter(i => i.kind === 'lost' && i.matchedItemId).map(i => ({
    mine: {t: i.title, p: i.place, d: i.date || '-'}, found: {t: i.matchedTitle, p: i.matchedPlace, d: i.matchedDate || '-'},
    score: 60 + (i.matchedPlace === i.place ? 20 : 0) + (i.matchedDate && i.matchedDate === i.date ? 15 : 0),
    why: ['Same category', ...(i.matchedPlace === i.place ? ['Same place'] : []), ...(i.matchedDate && i.matchedDate === i.date ? ['Same day'] : [])]
  }));
  const list = real.length ? real : M.matches;
  const one = m => {
    const cls = m.score >= 80 ? '' : m.score >= 60 ? 'mid' : 'low';
    return `<div class="box" style="margin-bottom:14px"><div class="row"><div class="cmp" style="flex:1"><div><span class="meta">Your report</span><br><b>${esc(m.mine.t)}</b><div class="meta">${esc(m.mine.p)} · ${esc(m.mine.d)}</div></div><div><span class="meta">Found item</span><br><b>${esc(m.found.t)}</b><div class="meta">${esc(m.found.p)} · ${esc(m.found.d)}</div></div></div>` +
      `<div style="text-align:center;margin-left:18px"><div class="score ${cls}">${m.score}%</div><div class="meta">Match score</div></div></div><div class="pillrow">${m.why.map(w => `<span class="pill">${w}</span>`).join('')}</div>` +
      `<div class="btnrow">${btn('This is mine', "go('browse')")}${btn('Not mine', "toast('Thanks. We will improve future matches')", 'sec')}</div></div>`;
  };
  return head('Possible matches', 'Found items that look like something you lost.') + (real.length ? '' : note('Sample matches. Real ones appear here when the system finds them.', 'teal')) + list.map(one).join('');
};

// ---------- Map view (found items on the campus map) ----------
V.foundmap = () => {
  const src = AUTH.foundItems.length
    ? AUTH.foundItems.map(i => ({key: i.id, src: 'found', t: i.title, p: i.place, c: i.category, d: i.date || '-'}))
    : M.items.filter(i => i.s < 5).map(i => ({key: i.code, src: 'mock', t: i.t, p: i.p, c: i.c, d: i.d}));
  const counts = {}; src.forEach(i => counts[i.p] = (counts[i.p] || 0) + 1);
  const zone = ui('zone', '');
  const list = src.filter(i => !zone || i.p === zone);
  const arg = i => typeof i.key === 'number' ? i.key : `'${i.key}'`;
  return head('Map view', 'Where found items were picked up.') + mapSvg(counts, 'pins', 'zone') +
    `<div class="toolbar">${zone ? `<span class="pill">${esc(zone)}</span>${btn('Show all', "setUi('zone','')", 'sec')}` : '<span class="meta">Tap a place on the map to filter.</span>'}</div>` +
    (list.length ? list.map(i => `<div class="tag"><div class="row"><div><b>${esc(i.t)}</b><div class="meta">${esc(i.p)} · ${esc(i.d)}</div></div><div><span class="badge">${esc(i.c)}</span> ${btn('Details', `openItem(${arg(i)},'${i.src}')`, 'sec')}</div></div></div>`).join('') : '<div class="box meta">No found items here.</div>');
};

// ---------- Pickup pass (real approved claim, else a sample) ----------
V.pickup = () => {
  const c = AUTH.myClaims.find(x => x.status === 'approved');
  const code = c ? (c.itemCode || 'LF-2026-0148') : 'LF-2026-0148';
  const org = S.currentUser && AUTH.organizations.find(o => o.id === S.currentUser.organizationId);
  return head('Pickup pass', 'Show this at the office together with your photo ID.') +
    (c ? '' : note('You have no approved claim yet. This is a sample pass.', 'teal')) +
    `<div class="cols even"><div class="pass"><div class="meta">${esc(org ? org.name : 'Lost & Found')}</div>${qrSvg(code)}<div class="code">${esc(code)}</div><b>${esc(c ? c.itemTitle : 'Silver earphones')}</b>` +
    '<div class="meta"><span>Shelf</span> <b>A2</b></div><div class="meta"><span>Valid until</span> <b>Oct 06</b></div></div>' +
    card(`<h2 style="margin-top:0">How pickup works</h2><ol class="steplist"><li><div><b>Go to the office</b><div class="meta">Open hours are shown at the front desk.</div></div></li><li><div><b>Show your pass and photo ID</b><div class="meta">Staff scan the QR code and check your ID.</div></div></li><li><div><b>Staff hand over the item</b><div class="meta">You confirm that you received it.</div></div></li></ol>`) + '</div>';
};

// ---------- Return history (real returned items, else a sample) ----------
V.history = () => {
  const real = AUTH.myItems.filter(i => i.status === 5).map(i => [esc(i.title), esc(i.place), esc(i.date || '-'), badge('Returned', 'ok'), btn('Certificate', "toast('Certificate downloaded')", 'sec')]);
  const rows = real.length ? real : [['Blue backpack', 'Gym', 'Sep 22', badge('Returned', 'ok'), btn('Certificate', "toast('Certificate downloaded')", 'sec')], ['Umbrella (navy)', 'Entrance', 'Aug 14', badge('Returned', 'ok'), btn('Certificate', "toast('Certificate downloaded')", 'sec')]];
  return head('Return history', 'Items that were returned to you.') + (real.length ? '' : note('Sample rows. Returned items will appear here.', 'teal')) +
    grid([stat(rows.length, 'Items returned'), stat('1.8 days', 'Average time to return')]) + '<h2>Returned items</h2>' + table(['Item', 'Place', 'Date', 'Status', 'Certificate'], rows);
};

// ---------- Thanks & rewards (MOCK) ----------
V.rewards = () => head('Thanks & rewards', 'Thanks are voluntary and always come from the owner.') +
  grid([stat(120, 'Points'), stat(2, 'Badges earned'), stat(3, 'Thank-yous received')]) +
  card('<b>Level: Helper</b><div class="meta">80 more points to reach the next level</div>' + prog(60), 'margin-bottom:16px') +
  '<h2>Badges</h2><div class="achv">' + [['🌟', 'First return', 1], ['🤝', 'Honest finder', 1], ['🏅', '5 returns', 0], ['💌', 'Kind words', 0]].map(b => `<div class="box ${b[2] ? '' : 'lock'}"><div class="emo">${b[0]}</div><b>${b[1]}</b><div class="meta">${b[2] ? 'Earned' : 'Locked'}</div></div>`).join('') + '</div>' +
  '<h2>Recent thank-yous</h2>' + [['Aiko T.', 'Thank you so much for returning my backpack!', '2 days ago'], ['Ken M.', 'You saved my day.', 'Last week']].map(t => `<div class="tag"><div class="row"><div><b>${t[0]}</b><div class="meta">${t[1]}</div></div><span class="meta">${t[2]}</span></div></div>`).join('') +
  `<div class="btnrow">${btn('Thank a finder', 'thanks(2)')}</div>`;

// ---------- Messages (MOCK) ----------
function sendMsg(id) {
  const i = document.getElementById('msgIn'), v = (i.value || '').trim();
  if (!v) return;
  M.threads.find(x => x.id === id).msgs.push(['me', v, 'Now']); render();
}
V.messages = () => {
  const t = M.threads.find(x => x.id === ui('thread', 1)) || M.threads[0];
  return head('Messages', 'Talk to the office about a claim.') + `<div class="msgwrap"><div>${M.threads.map(x => `<button class="thread ${x.id === t.id ? 'on' : ''}" onclick="setUi('thread',${x.id})"><b>${x.item}</b><div class="meta">${x.with}</div></button>`).join('')}</div>` +
    `<div class="box"><b>${t.item}</b><div style="min-height:200px;margin:12px 0">${t.msgs.map(m => `<div class="bubble ${m[0] === 'me' ? 'me' : ''}">${esc(m[1])}<small>${m[2]}</small></div>`).join('')}</div>` +
    `<div class="toolbar"><input id="msgIn" class="grow" placeholder="Write a message" onkeydown="if(event.key==='Enter')sendMsg(${t.id})">${btn('Send', `sendMsg(${t.id})`)}</div></div></div>`;
};

// ---------- Profile & privacy ----------
V.profile = () => {
  const u = S.currentUser, org = AUTH.organizations.find(o => o.id === u.organizationId);
  return head('Profile & privacy', 'Your account and what others can see.') + '<div class="cols even"><div>' +
    card(`<h2 style="margin-top:0">Account</h2>${field('Name', `<input value="${esc(u.name)}" disabled>`)}${field('Email', `<input value="${esc(u.email)}" disabled>`)}${field('Role', `<input value="${ROLE_NAMES[S.role]}" disabled>`)}${field('Community', `<input value="${esc(org ? org.name : '-')}" disabled>`)}` +
      `<div class="btnrow">${S.role === 'member' ? btn('Switch community', "go('community')", 'sec') : ''}${btn('EN', "setLang('en')", 'sec')}${btn('日本語', "setLang('ja')", 'sec')}</div>`, 'margin-bottom:16px') +
    card(`<h2 style="margin-top:0">Change password</h2>${field('Current password', '<input type="password">')}${field('New password', '<input type="password">')}${btn('Save password', "toast('Password saved')")}`) +
    '</div><div>' + card('<h2 style="margin-top:0">Privacy</h2>' + sw('Hide my name from finders', 'Only staff can see who you are') + sw('Show my email to staff', 'Helps staff contact you about a claim') + sw('Email notifications', 'Get important updates by email', false), 'margin-bottom:16px') +
    card(`<h2 style="margin-top:0">Your data</h2><p class="meta">Download a copy of what the system stores about you.</p><div class="btnrow">${btn('Download my data', "toast('Your data file is being prepared')", 'sec')}${btn('Delete my account', "toast('Please contact your administrator')", 'bad')}</div>`) + '</div></div>';
};

// ---------- How it works (welcome tour + FAQ) ----------
V.tour = () => head('How it works', 'Three steps to get your item back.') +
  grid([card('<div class="score">1</div><b>Hand in or report</b><div class="meta">Found items are handed to the office. Lost items are reported here.</div>'), card('<div class="score">2</div><b>We match and verify</b><div class="meta">The system suggests matches. Staff check your answers.</div>'), card('<div class="score">3</div><b>Pick up with your ID</b><div class="meta">Show your pickup pass and a photo ID at the office.</div>')]) +
  '<h2>Questions</h2>' + [['Why must I show an ID?', 'Staff must be sure that the item goes to its owner.'], ['Can I keep something I found?', 'No. Please hand every found item to the office.'], ['Is a thank-you required?', 'No. Thank-you messages and gifts are voluntary.'], ['How long are items kept?', 'Your organization sets the storage period. Owners get a warning before it ends.']].map(q => `<details class="faq"><summary>${q[0]}</summary><p class="meta">${q[1]}</p></details>`).join('');

// ---------- Report wizard (REAL: sends to the same backend action as before) ----------
const WSTEPS = ['Type', 'Item', 'Where & when', 'Photo', 'Review'];
const CATS = ['Wallet', 'Bag', 'Electronics', 'ID card', 'Keys', 'Other'];
const W = {};
function resetWizard() { Object.assign(W, {step: 1, title: '', cat: 'Wallet', colour: '', brand: '', marks: '', place: 'Library', date: '', desc: '', photo: null, err: '', busy: false}); }
resetWizard();
function pickPlace(z) { W.place = z; render(); }
function wizNext() {
  W.err = '';
  if (W.step === 2 && !W.title.trim()) { W.err = 'Please enter the item name.'; render(); return; }
  W.step++; render();
}
function wizBack() { W.err = ''; W.step--; render(); }
async function wizPhoto(input) { try { W.photo = await readPhoto(input); W.err = ''; } catch (e) { W.err = e.message; W.photo = null; } render(); }
async function submitWizard() {
  const description = [W.colour && 'Colour: ' + W.colour, W.brand && 'Brand: ' + W.brand, W.marks && 'Marks: ' + W.marks, W.desc].filter(Boolean).join('\n');
  W.busy = true; W.err = ''; render();
  try {
    const r = await api('report_item', {kind: S.kind, title: W.title.trim(), category: W.cat, place: W.place, item_date: W.date, description, photo: W.photo});
    if (S.kind === 'lost' && r.matched) toast('Possible match found');
    else toast(S.kind === 'found' && S.role === 'member' ? 'Reported. Now bring the item to the office' : 'Report submitted');
    resetWizard(); await loadState(); go(S.role === 'member' ? 'home' : FIRST[S.role]);
  } catch (e) { W.err = e.message; W.busy = false; render(); }
}
V.report = () => {
  const dots = `<div class="wiz">${WSTEPS.map((s, i) => `<span class="${W.step === i + 1 ? 'on' : W.step > i + 1 ? 'done' : ''}"><b>${i + 1}</b> ${s}</span>`).join('')}</div>`;
  let body = '';
  if (W.step === 1) {
    body = `<div class="seg"><button class="${S.kind === 'lost' ? 'on' : ''}" onclick="S.kind='lost';render()">I lost something</button><button class="${S.kind === 'found' ? 'on' : ''}" onclick="S.kind='found';render()">I found something</button></div>` +
      (S.kind === 'found' ? note(S.role === 'member' ? '<b>Hand the item to the office</b><div class="meta">Reporting here is not enough. Staff must receive the item.</div>' : '<b>Register the item at the office</b><div class="meta">Staff and admins can also use Register found item.</div>') : `<p class="meta">Tell us what you lost. We will look for it among the found items.</p>`);
  } else if (W.step === 2) {
    body = field('Item name', `<input placeholder="e.g. Black wallet" value="${esc(W.title)}" oninput="W.title=this.value">`) +
      `<div class="two">${field('Category', `<select onchange="W.cat=this.value">${opts(CATS, W.cat)}</select>`)}${field('Colour', `<input value="${esc(W.colour)}" oninput="W.colour=this.value">`)}</div>` +
      `<div class="two">${field('Brand', `<input value="${esc(W.brand)}" oninput="W.brand=this.value">`)}${field('Marks or stickers', `<input value="${esc(W.marks)}" oninput="W.marks=this.value">`)}</div>`;
  } else if (W.step === 3) {
    body = `<p class="meta">Tap the place on the map.</p>${mapSvg({[W.place]: 1}, 'pins', 'zone', 'pickPlace')}` +
      `<div class="two">${field('Place', `<select onchange="W.place=this.value;render()">${opts(ZONES.map(z => z.id), W.place)}</select>`)}${field('Date', `<input type="date" value="${esc(W.date)}" onchange="W.date=this.value">`)}</div>`;
  } else if (W.step === 4) {
    body = field('Photo', '<input type="file" accept="image/*" onchange="wizPhoto(this)">') + (W.photo ? `<img src="${W.photo}" alt="" style="max-width:220px;border-radius:12px;margin-bottom:12px">` : '') +
      field('Description', `<textarea rows="3" placeholder="Anything else that helps" oninput="W.desc=this.value">${esc(W.desc)}</textarea>`);
  } else {
    const r = (l, v) => `<div class="row" style="margin:6px 0"><span class="meta">${l}</span><b>${esc(v || '-')}</b></div>`;
    body = '<h2 style="margin-top:0">Check your report</h2>' + r('Type', S.kind === 'lost' ? 'Lost' : 'Found') + r('Item name', W.title) + r('Category', W.cat) + r('Colour', W.colour) + r('Brand', W.brand) + r('Marks or stickers', W.marks) + r('Place', W.place) + r('Date', W.date) + r('Description', W.desc) + (W.photo ? '<div class="meta">Photo attached</div>' : '');
  }
  const nav = `<div class="btnrow">${W.step > 1 ? btn('Back', 'wizBack()', 'sec') : ''}${W.step < 5 ? btn('Next', 'wizNext()') : `<button class="btn" ${W.busy ? 'disabled' : ''} onclick="submitWizard()">Submit report</button>`}</div>`;
  return head('Report an item', 'Tell us what you lost or found.') + dots + `<div class="box" style="max-width:680px">${body}<div style="color:var(--red);margin-top:10px">${esc(W.err)}</div>${nav}</div>`;
};
