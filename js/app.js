const AUTH_STYLE = document.createElement('style');
AUTH_STYLE.textContent = `.auth-page{min-height:70vh;display:flex;justify-content:center;align-items:center;padding:40px 20px}.auth-card{width:100%;max-width:480px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:32px;box-shadow:0 8px 30px rgba(0,0,0,.06)}.auth-card h1{margin-top:0}.auth-card .btn{width:100%;margin-top:6px}`;
document.head.appendChild(AUTH_STYLE);

const LS = (() => {
  let ok = false;
  try { localStorage.setItem('lf-t','1'); localStorage.removeItem('lf-t'); ok = true; } catch (e) {}
  let mem = {};
  try { mem = JSON.parse(window.name || '{}') || {}; if (typeof mem !== 'object') mem = {}; } catch (e) { mem = {}; }
  const flush = () => { try { window.name = JSON.stringify(mem); } catch (e) {} };
  return {
    ok,
    getItem: k => ok ? localStorage.getItem(k) : (k in mem ? mem[k] : null),
    setItem: (k,v) => { if (ok) localStorage.setItem(k,v); else { mem[k] = String(v); flush(); } },
    removeItem: k => { if (ok) localStorage.removeItem(k); else { delete mem[k]; flush(); } }
  };
})();
const $ = s => document.querySelector(s);
const STEPS = ['Reported','Received at office','Matched','Verified','Returned'];
const COLORS = ['#0e7c7b','#e9a23b','#5b6fb0','#b3372f','#3f8f5a'];

const D = {
  items: [
    {id:1,t:'Black wallet',c:'Wallet',p:'Library',d:'Sep 24',s:3,mine:true,kind:'lost'},
    {id:2,t:'Blue backpack',c:'Bag',p:'Gym',d:'Sep 22',s:5,mine:true,kind:'lost',thanked:false},
    {id:3,t:'Silver earphones',c:'Electronics',p:'Room 302',d:'Sep 26',s:2,kind:'found'},
    {id:4,t:'Umbrella (navy)',c:'Other',p:'Entrance',d:'Sep 25',s:2,kind:'found'},
    {id:5,t:'Student ID holder',c:'ID card',p:'Cafeteria',d:'Sep 27',s:2,kind:'found'},
    {id:6,t:'Water bottle',c:'Other',p:'Gym',d:'Sep 21',s:2,kind:'found'}
  ],
  claims: [
    {id:1,item:'Silver earphones',by:'Aiko T.',qa:[['Brand of the case?','Sonic'],['Any sticker?','Star sticker']],truth:['Sonic','Star sticker'],st:'Pending'},
    {id:2,item:'Student ID holder',by:'Ken M.',qa:[['Which faculty?','Global IT'],['Color of the strap?','Green']],truth:['Global IT','Red'],st:'Pending'}
  ],
  users: [['Aiko Tanaka','Member'],['Ken Mori','Member'],['Sara Ito','Staff'],['Ravi Perera','Staff'],['Mr. Yamada','Org admin']],
  orgs: [['Yokohama Demo School','School',312,84,true],['Harbor Mart','Store',28,19,true],['Nexa Systems','Company',140,41,false]]
};

const META = {
  3:{code:'LF-2026-0148',shelf:'A-01',by:'Sara Ito (staff)'},
  4:{code:'LF-2026-0149',shelf:'A-02',by:'Ken Mori (member)'},
  5:{code:'LF-2026-0150',shelf:'B-01',by:'Sara Ito (staff)'},
  6:{code:'LF-2026-0151',shelf:'B-02',by:'Aiko Tanaka (member)'}
};
const SCANS = [];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const NAV = {
  member:[['home','My page'],['report','Report an item'],['browse','Found items']],
  staff:[['queue','Work queue'],['scan','Scan item'],['register','Register found item'],['claims','Verify claims']],
  admin:[['dash','Dashboard'],['report','Report an item'],['register','Register found item'],['scan','Scan item'],['users','Users'],['settings','Settings']],
  super:[['orgs','Organizations']]
};
const ROLE_NAMES = {member:'Member',staff:'Staff',admin:'Org admin',super:'Super admin'};
const FIRST = {member:'home',staff:'queue',admin:'dash',super:'orgs'};
const AUTH = {
  users: [
    {id:1,name:'Aiko Tanaka',email:'aiko@example.com',password:'123456',role:'member',organizationId:1,membershipStatus:'approved'},
    {id:2,name:'Mr. Yamada',email:'yamada@example.com',password:'123456',role:'admin',organizationId:1,membershipStatus:'approved'}
  ],
  organizations: [
    {id:1,name:'Yokohama Demo School',type:'School'},
    {id:2,name:'Harbor Mart',type:'Store'},
    {id:3,name:'Nexa Systems',type:'Company'}
  ],
  requests: []
};
try {
  const savedUsers = JSON.parse(LS.getItem('lf-users') || 'null');
  if (Array.isArray(savedUsers)) AUTH.users = savedUsers;
} catch (e) {}
try {
  const savedReqs = JSON.parse(LS.getItem('lf-requests') || 'null');
  if (Array.isArray(savedReqs)) AUTH.requests = savedReqs;
} catch (e) {}
function saveAuth(){
  try {
    LS.setItem('lf-users', JSON.stringify(AUTH.users));
    LS.setItem('lf-requests', JSON.stringify(AUTH.requests));
  } catch (e) {}
}
function startView(u){
  if (u.role === 'admin') return 'dash';
  if (u.role === 'super') return 'orgs';
  if (u.role === 'staff') return 'queue';
  return u.membershipStatus === 'approved' ? 'home' : 'community';
}
let S = {role:null,view:'login',kind:'lost',cat:'All',currentUser:null};
try {
  const savedId = Number(LS.getItem('lf-current-user-id'));
  if (savedId) S.currentUser = AUTH.users.find(u => Number(u.id) === savedId) || null;
  if (S.currentUser) { S.role = S.currentUser.role; S.view = startView(S.currentUser); }
} catch (e) {}

const stepper = n => '<div class="steps">' + STEPS.map((s,i) => '<span class="' + (i<n?'on':'') + '">' + s + '</span>').join('') + '</div>';
const head = (t,s) => '<h1>' + t + '</h1><p class="sub">' + s + '</p>';
const stat = (n,l) => '<div class="box stat"><b>' + n + '</b><span>' + l + '</span></div>';
const field = (l,i) => '<div class="field"><label>' + l + '</label>' + i + '</div>';
const opts = a => a.map(x => '<option>' + x + '</option>').join('');

let LANG = 'en';
try { LANG = LS.getItem('lf-lang') || 'en'; } catch (e) {}
const J = {
'Lost & Found':'落とし物管理','Yokohama Demo School':'横浜デモ学園','Harbor Mart':'ハーバーマート','Nexa Systems':'ネクサシステムズ',
'Member':'会員','Staff':'スタッフ','Org admin':'組織管理者','Super admin':'システム管理者',
'My page':'マイページ','Report an item':'落とし物を届ける','Found items':'拾得物一覧','Work queue':'作業リスト','Scan item':'アイテムをスキャン','Register found item':'拾得物を登録','Verify claims':'請求を確認','Dashboard':'ダッシュボード','Users':'ユーザー','Settings':'設定','Organizations':'組織',
'Reported':'届出済み','Received at office':'事務所で受領','Matched':'一致','Verified':'確認済み','Returned':'返却済み',
'2 items in progress. 1 is ready for a thank-you.':'進行中は2件。1件はお礼を送れます。','Browse found items':'拾得物を見る',
'Items are always returned at the office. Bring a photo ID to collect yours.':'返却は必ず事務所で行います。受け取りには顔写真付きの身分証をお持ちください。',
'Items you reported':'届け出た件数','Possible match':'一致の可能性','Ready to thank':'お礼を送れる件数','Your items':'あなたのアイテム',
'Black wallet':'黒い財布','Blue backpack':'青いリュック','Silver earphones':'銀色のイヤホン','Umbrella (navy)':'傘（紺）','Student ID holder':'学生証ケース','Water bottle':'水筒','Green scarf':'緑のマフラー',
'Library':'図書館','Gym':'体育館','Room 302':'302教室','Entrance':'入口','Cafeteria':'食堂',
'Possible match found':'一致の可能性あり','Send thanks':'お礼を送る',
'Tell us what you lost or found.':'なくしたもの、見つけたものを教えてください。','I lost something':'なくしました','I found something':'見つけました',
'Item name':'アイテム名','e.g. Black wallet':'例：黒い財布','Category':'カテゴリ','Date':'日付','Place':'場所','Description':'説明','Color, size, marks':'色、大きさ、特徴','Photo':'写真','Submit report':'届出を送信',
'Wallet':'財布','Bag':'かばん','Electronics':'電子機器','ID card':'身分証','Keys':'鍵','Other':'その他','All':'すべて',
'Hand the item to the office':'物を事務所に預けてください',
'Reporting here is not enough. Bring the item to the office so staff can store it and confirm the owner’s identity before returning it.':'ここでの届出だけでは完了しません。物を事務所に持参してください。スタッフが保管し、返却前に持ち主の本人確認を行います。',
'Keep it at the office':'事務所で保管してください',
'Store the item at the office. To assign a shelf and print its label, use Register found item.':'物は事務所で保管します。棚の割り当てとラベル印刷は「拾得物を登録」から行ってください。',
'Items held at the front desk. Private details are hidden.':'受付で保管中の物です。個人情報は表示されません。','This is mine':'私のものです',
'No items in this category yet. Check back later or report your item.':'このカテゴリにはまだありません。後でもう一度確認するか、落とし物を届けてください。',
'Answer these, then show ID at the office to collect it.':'質問に答え、事務所で身分証を見せて受け取ってください。','What color is it?':'何色ですか？','Any marks or stickers?':'目印やステッカーはありますか？','Send claim':'請求を送る','Cancel':'キャンセル',
'What needs attention today.':'今日対応が必要なこと','Items to receive':'受け取り予定','Claims to verify':'確認待ちの請求','Expiring this week':'今週期限切れ','Today':'今日',
'Task':'作業','Item':'アイテム','Status':'状態','Drop-off':'預け入れ','Not yet at office':'まだ事務所に届いていません','Receive item':'受け取る','Verify claim':'請求確認','Pending':'確認待ち','Review':'確認する','Expiry':'保管期限','Donate':'寄付する',
'Scan the QR label or type the item ID.':'QRラベルをスキャンするか、アイテムIDを入力してください。','Item ID':'アイテムID','Look up item':'検索','Try:':'例：','Ready to scan':'スキャンの準備ができました',
'Point a scanner at the QR label, or type the item ID below. The item’s page opens right away.':'QRラベルにスキャナーを向けるか、下にIDを入力してください。すぐにアイテムのページが開きます。',
'Recent scans':'最近のスキャン','Time':'時刻','No scans yet today.':'今日はまだスキャンがありません。','No item found':'アイテムが見つかりません','No claims yet.':'請求はまだありません。','Move to shelf':'棚を移動','Review claim':'請求を確認','Confirm ID and hand over':'本人確認して返却',
'Add the item and print its storage label.':'物を登録し、保管ラベルを印刷します。','Who found it':'拾った人','A member handed it in':'会員が届けた','Staff or admin found it':'スタッフ・管理者が発見','Finder name (for thanks)':'拾得者名（お礼用）','Optional':'任意',
'Found at':'発見場所','Storage shelf':'保管棚','Register item':'登録する','The item stays at the office until the owner shows ID.':'持ち主が身分証を提示するまで、物は事務所で保管されます。','Storage label':'保管ラベル','Attach this to the item.':'物に貼り付けてください。','Print label':'ラベルを印刷','e.g. Green scarf':'例：緑のマフラー',
'Compare the claimant’s answers with what the item shows.':'申請者の回答を物の記録と照らし合わせます。','Brand of the case?':'ケースのブランドは？','Any sticker?':'ステッカーはありますか？','Which faculty?':'どの学科ですか？','Color of the strap?':'ストラップの色は？',
'Sonic':'ソニック','Star sticker':'星のステッカー','Global IT':'グローバルIT','Green':'緑','Red':'赤',
'All answers match.':'すべての回答が一致しています。','Some answers do not match. Check ID before approving.':'一致しない回答があります。承認前に身分証を確認してください。','Approved':'承認済み','Rejected':'却下','Approve':'承認','Reject':'却下する',
'How lost and found is going across the school.':'学校全体の落とし物の状況','Items this term':'今学期の件数','Returned to owners':'持ち主への返却率','Average time to return':'返却までの平均日数','Waiting for owners':'持ち主待ち','Returns per month':'月ごとの返却数',
'May':'5月','Jun':'6月','Jul':'7月','Aug':'8月','Sep':'9月',
'Invite people and set their roles.':'メンバーを招待し、役割を設定します。','Invite users':'ユーザーを招待','Import CSV':'CSVを取り込む','Name':'名前','Role':'役割','Deactivate':'無効化','Mr. Yamada':'山田先生',
'Rules for your organization.':'組織のルールを設定します。','Storage period':'保管期間','Days before unclaimed items expire':'請求のない物が期限切れになるまでの日数','Thank-you points':'お礼ポイント','Owners can thank finders after a return':'返却後、持ち主が拾った人にお礼を送れます',
'Hide sensitive items from browsing':'重要な物を一覧に表示しない','Wallets, IDs, phones':'財布、身分証、スマートフォン','Require ID at handover':'返却時に身分証を必須にする','Save changes':'変更を保存',
'Every school, company and store using the service.':'このサービスを利用するすべての学校・会社・店舗','Add organization':'組織を追加','Type':'種類','School':'学校','Store':'店舗','Company':'会社','Active':'有効','Suspended':'停止中',
'Report submitted':'届出を送信しました','Reported. Now bring the item to the office':'届出完了。物を事務所に持参してください','Item received at office':'事務所で受領しました','Marked for donation':'寄付に設定しました','Invitation sent':'招待を送信しました','CSV imported':'CSVを取り込みました','User deactivated':'ユーザーを無効化しました',
'Setting saved':'設定を保存しました','Settings saved':'設定を保存しました','Organization created':'組織を作成しました','Sent to printer':'プリンターに送信しました','Claim sent to staff':'請求をスタッフに送信しました','Claim approved. Owner must visit the office with ID':'請求を承認しました。持ち主は身分証を持って事務所へ',
'Claim rejected':'請求を却下しました','Handover recorded':'返却を記録しました','Thanks sent':'お礼を送信しました','Enter an item ID first':'先にアイテムIDを入力してください',
'Release the item only after checking ID in person.':'必ず対面で身分証を確認してから物を渡してください。','Student ID':'学生証','Driver’s license':'運転免許証','My Number card':'マイナンバーカード','Passport':'パスポート',
'Name on ID matches the claimant':'身分証の氏名が申請者と一致','Face matches the ID photo':'顔が身分証の写真と一致','Check both boxes after verifying the ID.':'身分証を確認したら両方にチェックしてください。','Confirm handover':'返却を確定',
'Thank the finder':'拾ってくれた方にお礼','Optional. Send whatever feels right.':'任意です。気持ちに合った形で送れます。','Message':'メッセージ','Thank you so much for returning my backpack!':'リュックを届けてくださり、本当にありがとうございました！',
'Add a gift (optional)':'ギフトを追加（任意）','No gift, message only':'ギフトなし、メッセージのみ','Gift card code':'ギフトカードコード','Not now':'今はしない'
,
'Welcome to Lost & Found':'落とし物管理へようこそ','Login to manage your lost and found items.':'ログインして落とし物を管理しましょう。','Email':'メールアドレス','Password':'パスワード','Enter your email':'メールアドレスを入力','Enter your password':'パスワードを入力','Login':'ログイン','Log out':'ログアウト',
'Don\'t have an account?':'アカウントをお持ちでないですか？','Create Account':'アカウント作成','Create your Lost & Found account.':'落とし物管理のアカウントを作成します。','Your name':'お名前','At least 6 characters':'6文字以上','Confirm Password':'パスワード（確認）','Enter password again':'もう一度入力','Already have an account?':'すでにアカウントをお持ちですか？',
'No account found for this email in this browser. Please create an account first.':'このブラウザにこのメールのアカウントがありません。先にアカウントを作成してください。','Account created':'アカウントを作成しました','Invalid email or password.':'メールアドレスまたはパスワードが正しくありません。','Please fill in all fields.':'すべての項目を入力してください。','Please enter a valid email address.':'有効なメールアドレスを入力してください。','Password must be at least 6 characters.':'パスワードは6文字以上にしてください。','Passwords do not match.':'パスワードが一致しません。','This email is already registered.':'このメールアドレスは既に登録されています。',
'Find Your Community':'所属先を探す','Choose the school or organization you belong to.':'所属する学校・組織を選んでください。','Request Membership':'参加を申請','Membership Request':'参加申請','Membership Approved!':'参加が承認されました！','You are now a member of:':'次の組織のメンバーになりました：','Go to Dashboard':'ダッシュボードへ','Refresh Status':'状態を更新','Your request has been sent to the organization administrator.':'申請は組織の管理者に送信されました。',
'Membership request sent':'参加申請を送信しました','Request already sent':'申請は送信済みです','Membership approved':'参加を承認しました','Membership request rejected':'参加申請を却下しました',
'Users & Membership Requests':'ユーザーと参加申請','Manage people who want to join your organization.':'組織への参加を希望する人を管理します。','Membership Requests':'参加申請','No pending requests.':'承認待ちの申請はありません。','Members':'メンバー','Accept':'承認する','Requesting:':'申請先：'
};
const P = [
[/^Requesting: (.+)$/, m => '申請先：' + tr1(m[1])],
[/^Hello, (.+)$/, m => 'こんにちは、' + m[1] + 'さん'],
[/^([A-Z][a-z]{2}) (\d+)$/, m => (J[m[1]] || m[1]) + m[2] + '日'],
[/^Claim: (.+)$/, m => '請求：' + tr1(m[1])],
[/^Hand over: (.+)$/, m => '返却：' + tr1(m[1])],
[/^ID shown by (.+)$/, m => m[1] + 'さんが提示した身分証'],
[/^(.+) \(reported by (.+)\)$/, m => tr1(m[1]) + '（報告者：' + m[2] + '）'],
[/^claimed by (.+)$/, m => '申請者：' + m[1]],
[/^Claimant: (.+)$/, m => '申請者の回答：' + tr1(m[1])],
[/^On record: (.+)$/, m => '記録：' + tr1(m[1])],
[/^Found at: (.+)$/, m => '発見場所：' + tr1(m[1])],
[/^Reported by: (.+?)(?: \((staff|member)\))?$/, m => '報告者：' + m[1] + (m[2] ? (m[2] === 'staff' ? '（スタッフ）' : '（会員）') : '')],
[/^Shelf (.+)$/, m => '棚 ' + m[1]],
[/^Moved to shelf (.+)$/, m => '棚 ' + m[1] + ' に移動しました'],
[/^Claim by (.+) is waiting\.$/, m => m[1] + 'さんの請求が確認待ちです。'],
[/^Claim by (.+) is approved\.$/, m => m[1] + 'さんの請求は承認済みです。'],
[/^Claim by (.+) was rejected\.$/, m => m[1] + 'さんの請求は却下されました。'],
[/^Returned to (.+)\.$/, m => m[1] + 'さんに返却済み。'],
[/^Nothing matches “(.+)”\. Check the label and try again\.$/, m => '「' + m[1] + '」に一致するアイテムはありません。ラベルを確認してもう一度お試しください。'],
[/^([\d.]+) days$/, m => m[1] + '日'],
[/^(\d+) days left$/, m => '残り' + m[1] + '日']
];
function tr1(k){
  if (J[k] !== undefined) return J[k];
  if (k.includes(' · ')) return k.split(' · ').map(tr1).join(' · ');
  for (const [re, f] of P){ const m = k.match(re); if (m) return f(m); }
  return k;
}
function tr(s){
  if (LANG !== 'ja') return s;
  const k = s.trim();
  if (!k) return s;
  return s.match(/^\s*/)[0] + tr1(k) + s.match(/\s*$/)[0];
}
function applyLang(root){
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())){
    if (n.__en === undefined) n.__en = n.nodeValue;
    n.nodeValue = tr(n.__en);
  }
  root.querySelectorAll('[placeholder]').forEach(e => {
    if (!e.dataset.en) e.dataset.en = e.placeholder;
    e.placeholder = tr(e.dataset.en);
  });
}
function setLang(l){
  LANG = l;
  try { LS.setItem('lf-lang', l); } catch (e) {}
  closeModal();
  render();
}

function toast(m){const t=$('#toast');t.textContent=tr(m);t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2200)}
function openModal(h){$('#mbody').innerHTML=h;applyLang($('#mbody'));$('#modal').classList.add('on')}
function closeModal(){$('#modal').classList.remove('on')}
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')closeModal()});

const V = {
  login(){
    return '<div class="auth-page"><div class="auth-card"><h1>Welcome to Lost & Found</h1><p class="sub">Login to manage your lost and found items.</p>' +
      field('Email','<input id="loginEmail" type="email" placeholder="Enter your email">') +
      field('Password','<input id="loginPassword" type="password" placeholder="Enter your password">') +
      '<div id="loginError" style="color:var(--red);margin-bottom:12px"></div>' +
      '<button type="button" class="btn" onclick="window.loginUser()">Login</button>' +
      '<p style="text-align:center;margin-top:20px">Don\'t have an account? <button class="btn sec" onclick="go(\'signup\')">Create Account</button></p></div></div>';
  },
  signup(){
    return '<div class="auth-page"><div class="auth-card"><h1>Create Account</h1><p class="sub">Create your Lost & Found account.</p>' +
      field('Name','<input id="registerName" type="text" placeholder="Your name">') +
      field('Email','<input id="registerEmail" type="email" placeholder="you@example.com">') +
      field('Password','<input id="registerPassword" type="password" placeholder="At least 6 characters">') +
      field('Confirm Password','<input id="registerPasswordConfirm" type="password" placeholder="Enter password again">') +
      '<div id="registerError" style="color:var(--red);margin-bottom:12px"></div>' +
      '<button type="button" class="btn" onclick="window.registerUser()">Create Account</button>' +
      '<p style="text-align:center;margin-top:20px">Already have an account? <button class="btn sec" onclick="go(\'login\')">Login</button></p></div></div>';
  },
  community(){
    const user=S.currentUser; if(!user) return '';
    const approved=AUTH.requests.find(r=>r.userId===user.id&&r.status==='approved');
    const pending=AUTH.requests.find(r=>r.userId===user.id&&r.status==='pending');
    if(approved){
      const org=AUTH.organizations.find(o=>o.id===approved.organizationId);
      return '<div class="auth-page"><div class="auth-card"><div style="font-size:50px;text-align:center">🎉</div><h1>Membership Approved!</h1><p class="sub">You are now a member of:</p><div class="box"><h2>'+esc(org.name)+'</h2><span class="badge ok">Member</span></div><button class="btn" onclick="enterMemberArea()">Go to Dashboard</button></div></div>';
    }
    if(pending){
      const org=AUTH.organizations.find(o=>o.id===pending.organizationId);
      return '<div class="auth-page"><div class="auth-card"><h1>Membership Request</h1><div class="box"><h2>'+esc(org.name)+'</h2><span class="badge">Pending</span><p class="meta">Your request has been sent to the organization administrator.</p></div><button class="btn sec" onclick="go(\'community\')">Refresh Status</button></div></div>';
    }
    return head('Find Your Community','Choose the school or organization you belong to.')+'<div class="grid">'+AUTH.organizations.map(org=>'<div class="box"><h2>'+esc(org.name)+'</h2><div class="meta">'+esc(org.type)+'</div><button class="btn" style="margin-top:15px" onclick="requestMembership('+org.id+')">Request Membership</button></div>').join('')+'</div>';
  },

  home(){
    const mine = D.items.filter(i=>i.mine);
    return '<div class="hero"><h1>Hello, '+esc(S.currentUser?S.currentUser.name.split(' ')[0]:'')+'</h1><p>2 items in progress. 1 is ready for a thank-you.</p><button class="btn" onclick="go(\'report\')">Report an item</button> <button class="btn sec" onclick="go(\'browse\')">Browse found items</button></div>' +
      '<div class="box" style="background:var(--amberbg);border-color:var(--amber);margin-bottom:16px">Items are always returned at the office. Bring a photo ID to collect yours.</div>' +
      '<div class="grid">' + stat(2,'Items you reported') + stat(1,'Possible match') + stat(1,'Ready to thank') + '</div>' +
      '<h2>Your items</h2>' + mine.map(i =>
        '<div class="tag' + (i.s===5?' done':'') + '"><div class="row"><div><b>' + i.t + '</b><div class="meta">' + i.p + ' · ' + i.d + '</div></div>' +
        (i.s===5 ? (i.thanked ? '<span class="badge ok">Thanks sent</span>' : '<button class="btn" onclick="thanks(' + i.id + ')">Send thanks</button>')
                 : i.s===3 ? '<span class="badge">Possible match found</span>' : '') +
        '</div>' + stepper(i.s) + '</div>').join('');
  },
  report(){
    return head('Report an item','Tell us what you lost or found.') +
      '<div class="seg"><button class="' + (S.kind==='lost'?'on':'') + '" onclick="S.kind=\'lost\';render()">I lost something</button><button class="' + (S.kind==='found'?'on':'') + '" onclick="S.kind=\'found\';render()">I found something</button></div>' +
      '<div class="box" style="max-width:640px">' +
      field('Item name','<input placeholder="e.g. Black wallet">') +
      '<div class="two">' + field('Category','<select>' + opts(['Wallet','Bag','Electronics','ID card','Keys','Other']) + '</select>') + field('Date','<input type="date">') + '</div>' +
      field('Place','<select>' + opts(['Library','Gym','Cafeteria','Room 302','Entrance']) + '</select>') +
      field('Description','<textarea rows="3" placeholder="Color, size, marks"></textarea>') +
      field('Photo','<input type="file" accept="image/*">') +
      (S.kind==='found' ? '<div class="box" style="background:var(--amberbg);border-color:var(--amber);margin-bottom:14px">' + (S.role==='member' ? '<b>Hand the item to the office</b><div class="meta">Reporting here is not enough. Bring the item to the office so staff can store it and confirm the owner’s identity before returning it.</div>' : '<b>Keep it at the office</b><div class="meta">Store the item at the office. To assign a shelf and print its label, use Register found item.</div>') + '</div>' : '') +
      '<button class="btn" onclick="toast(S.kind===\'found\'&&S.role===\'member\'?\'Reported. Now bring the item to the office\':\'Report submitted\');go(S.role===\'member\'?\'home\':FIRST[S.role])">Submit report</button></div>';
  },
  browse(){
    const cats = ['All','Wallet','Bag','Electronics','ID card','Other'];
    const list = D.items.filter(i => i.kind==='found' && (S.cat==='All' || i.c===S.cat));
    return head('Found items','Items held at the front desk. Private details are hidden.') +
      '<div class="chips">' + cats.map(c => '<button class="' + (S.cat===c?'on':'') + '" onclick="S.cat=\'' + c + '\';render()">' + c + '</button>').join('') + '</div>' +
      (list.length ? '<div class="grid">' + list.map(i =>
        '<div class="box"><div class="thumb" style="background:' + COLORS[i.id%5] + '">' + i.t[0] + '<span class="cat">' + i.c + '</span></div><b>' + i.t + '</b><div class="meta">' + i.p + ' · ' + i.d + '</div>' +
        '<p><button class="btn sec" onclick="claimForm(' + i.id + ')">This is mine</button></p></div>').join('') + '</div>'
        : '<div class="box">No items in this category yet. Check back later or report your item.</div>');
  },
  queue(){
    return head('Work queue','What needs attention today.') +
      '<div class="grid">' + stat(3,'Items to receive') + stat(D.claims.filter(c=>c.st==='Pending').length,'Claims to verify') + stat(2,'Expiring this week') + '</div>' +
      '<h2>Today</h2><table><tr><th>Task</th><th>Item</th><th>Status</th><th></th></tr>' +
      '<tr><td>Drop-off</td><td>Green scarf (reported by Ken M.)</td><td><span class="badge">Not yet at office</span></td><td><button class="btn sec" onclick="go(\'register\')">Receive item</button></td></tr>' +
      '<tr><td>Verify claim</td><td>Silver earphones</td><td><span class="badge">Pending</span></td><td><button class="btn sec" onclick="go(\'claims\')">Review</button></td></tr>' +
      '<tr><td>Expiry</td><td>Umbrella (navy)</td><td><span class="badge no">3 days left</span></td><td><button class="btn sec" onclick="toast(\'Marked for donation\')">Donate</button></td></tr></table>';
  },
  register(){
    const cells = Array.from({length:121},(_,i)=>'<i class="' + (((i*7+i%5*3+(i>>2))%3)?'':'w') + '"></i>').join('');
    return head('Register found item','Add the item and print its storage label.') +
      '<div class="grid" style="grid-template-columns:1.5fr 1fr;align-items:start"><div class="box">' +
      field('Item name','<input placeholder="e.g. Green scarf">') +
      '<div class="two">' + field('Who found it','<select>' + opts(['A member handed it in','Staff or admin found it']) + '</select>') + field('Finder name (for thanks)','<input placeholder="Optional">') + '</div>' +
      '<div class="two">' + field('Category','<select>' + opts(['Wallet','Bag','Electronics','ID card','Keys','Other']) + '</select>') + field('Found at','<select>' + opts(['Library','Gym','Cafeteria','Room 302','Entrance']) + '</select>') + '</div>' +
      '<div class="two">' + field('Storage shelf','<select>' + opts(['A-01','A-02','B-01','B-02']) + '</select>') + field('Photo','<input type="file" accept="image/*">') + '</div>' +
      '<p class="meta">The item stays at the office until the owner shows ID.</p>' +
      '<button class="btn" onclick="toast(\'Item received at office\')">Register item</button></div>' +
      '<div class="box"><b>Storage label</b><p class="meta">Attach this to the item.</p><div class="qr">' + cells + '</div><p class="meta">LF-2026-0148 · Shelf A-01</p><button class="btn sec" onclick="toast(\'Sent to printer\')">Print label</button></div></div>';
  },
  claims(){
    return head('Verify claims','Compare the claimant’s answers with what the item shows.') +
      D.claims.map(c => {
        const ok = c.qa.every((q,i)=>q[1]===c.truth[i]);
        return '<div class="box" style="margin-bottom:14px"><div class="row" style="display:flex;justify-content:space-between"><b>' + c.item + ' · claimed by ' + c.by + '</b><span class="badge ' + (c.st==='Approved'||c.st==='Returned'?'ok':c.st==='Rejected'?'no':'') + '">' + c.st + '</span></div>' +
          c.qa.map((q,i) => '<div class="meta" style="margin-top:10px">' + q[0] + '</div><div class="cmp"><div>Claimant: ' + q[1] + '</div><div>On record: ' + c.truth[i] + '</div></div>').join('') +
          '<div class="meta">' + (ok ? 'All answers match.' : 'Some answers do not match. Check ID before approving.') + '</div><p>' +
          (c.st==='Pending' ? '<button class="btn" onclick="setClaim(' + c.id + ',\'Approved\')">Approve</button> <button class="btn bad" onclick="setClaim(' + c.id + ',\'Rejected\')">Reject</button>' :
           c.st==='Approved' ? '<button class="btn" onclick="handover(' + c.id + ')">Confirm ID and hand over</button>' : '') + '</p></div>';
      }).join('');
  },
  scan(){
    const out = S.code ? scanCard(S.code) : '<div class="box"><b>Ready to scan</b><div class="meta">Point a scanner at the QR label, or type the item ID below. The item’s page opens right away.</div></div>';
    return head('Scan item','Scan the QR label or type the item ID.') +
      '<div class="box" style="max-width:640px;margin-bottom:16px"><div class="field"><label>Item ID</label><input id="scanId" value="' + esc(S.code||'') + '" placeholder="LF-2026-0148" onkeydown="if(event.key===\'Enter\')scan()"></div>' +
      '<button class="btn" onclick="scan()">Look up item</button> <span class="meta">Try:</span> <button class="btn sec" onclick="scan(\'LF-2026-0148\')">LF-2026-0148</button> <button class="btn sec" onclick="scan(\'LF-2026-0150\')">LF-2026-0150</button></div>' +
      out + '<h2>Recent scans</h2>' +
      (SCANS.length ? '<table><tr><th>Time</th><th>ID</th><th>Item</th></tr>' + SCANS.map(s => '<tr><td>' + s[0] + '</td><td>' + s[1] + '</td><td>' + s[2] + '</td></tr>').join('') + '</table>' : '<div class="box meta">No scans yet today.</div>');
  },
  dash(){
    const m = [['May',8],['Jun',12],['Jul',9],['Aug',15],['Sep',21]];
    return head('Dashboard','How lost and found is going across the school.') +
      '<div class="grid">' + stat(84,'Items this term') + stat('71%','Returned to owners') + stat('1.8 days','Average time to return') + stat(6,'Waiting for owners') + '</div>' +
      '<h2>Returns per month</h2><div class="box" style="padding-bottom:36px"><div class="bars">' + m.map(x => '<div style="height:' + x[1]*6 + 'px"><span>' + x[0] + ' · ' + x[1] + '</span></div>').join('') + '</div></div>';
  },
  users(){
    const orgId=S.currentUser&&S.currentUser.organizationId;
    const pending=AUTH.requests.filter(r=>r.status==='pending'&&r.organizationId===orgId);
    const members=AUTH.users.filter(u=>u.organizationId===orgId&&u.membershipStatus==='approved');
    return head('Users & Membership Requests','Manage people who want to join your organization.')+
      '<div class="box" style="margin-bottom:20px"><h2 style="margin-top:0">Membership Requests</h2>'+(
        pending.length===0 ? '<p class="meta">No pending requests.</p>' :
        pending.map(r=>{
          const u=AUTH.users.find(x=>x.id===r.userId);
          const org=AUTH.organizations.find(o=>o.id===r.organizationId);
          if(!u||!org) return '';
          return '<div class="tag"><div class="row"><div><b>'+esc(u.name)+'</b><div class="meta">'+esc(u.email)+'</div><div class="meta">Requesting: '+esc(org.name)+'</div></div><span class="badge">Pending</span></div>'+
            '<div style="margin-top:12px"><button class="btn" onclick="approveMembership('+r.id+')">Accept</button> <button class="btn bad" onclick="rejectMembership('+r.id+')">Reject</button></div></div>';
        }).join('')
      )+'</div>'+
      '<h2>Members</h2><table><tr><th>Name</th><th>Email</th><th>Role</th></tr>'+
      members.map(u=>'<tr><td>'+esc(u.name)+'</td><td>'+esc(u.email)+'</td><td>'+ROLE_NAMES[u.role]+'</td></tr>').join('')+'</table>';
  },
  settings(){
    return head('Settings','Rules for your organization.') +
      '<div class="box" style="max-width:640px">' +
      '<div class="sw"><span>Storage period<div class="meta">Days before unclaimed items expire</div></span><select><option>30</option><option selected>90</option><option>180</option></select></div>' +
      '<div class="sw"><span>Thank-you points<div class="meta">Owners can thank finders after a return</div></span><input type="checkbox" checked onchange="toast(\'Setting saved\')"></div>' +
      '<div class="sw"><span>Hide sensitive items from browsing<div class="meta">Wallets, IDs, phones</div></span><input type="checkbox" checked onchange="toast(\'Setting saved\')"></div>' +
      '<div class="sw"><span>Require ID at handover</span><input type="checkbox" checked onchange="toast(\'Setting saved\')"></div>' +
      '<p><button class="btn" onclick="toast(\'Settings saved\')">Save changes</button></p></div>';
  },
  orgs(){
    return head('Organizations','Every school, company and store using the service.') +
      '<p><button class="btn" onclick="toast(\'Organization created\')">Add organization</button></p>' +
      '<table><tr><th>Name</th><th>Type</th><th>Users</th><th>Items</th><th>Status</th></tr>' + D.orgs.map(o =>
        '<tr><td>' + o[0] + '</td><td>' + o[1] + '</td><td>' + o[2] + '</td><td>' + o[3] + '</td><td><span class="badge ' + (o[4]?'ok':'no') + '">' + (o[4]?'Active':'Suspended') + '</span></td></tr>').join('') + '</table>';
  }
};

function render(){
  const loggedIn=!!S.currentUser;
  $('#roles').innerHTML=loggedIn ? '<button class="on" style="cursor:default">'+esc(S.currentUser.name)+' · '+ROLE_NAMES[S.role]+'</button><button onclick="logout()">Log out</button>' : '';
  const nav=loggedIn && NAV[S.role] ? NAV[S.role] : [];
  $('#nav').innerHTML=nav.map(n=>'<button class="'+(S.view===n[0]?'on':'')+'" onclick="go(\''+n[0]+'\')">'+n[1]+'</button>').join('');
  $('#main').innerHTML=V[S.view] ? V[S.view]() : V.login();
  document.documentElement.lang=LANG;
  applyLang(document.querySelector('header')); applyLang($('#nav')); applyLang($('#main'));
  document.querySelectorAll('.lang span').forEach(s=>s.classList.toggle('on',s.dataset.l===LANG));
}
function logout(){
  S.currentUser=null; S.role=null; S.view='login';
  try { LS.removeItem('lf-current-user-id'); } catch (e) {}
  render();
}
function go(v){
  const publicPages=['login','signup'];
  if(!publicPages.includes(v) && !S.currentUser){S.view='login';render();return;}
  const memberPages=['home','report','browse'];
  if(memberPages.includes(v) && S.currentUser.membershipStatus!=='approved'){S.view='community';render();return;}
  if(['queue','scan','register','claims'].includes(v) && !['staff','admin'].includes(S.currentUser.role)){return;}
  if(['dash','users','settings'].includes(v) && S.currentUser.role!=='admin'){return;}
  if(v==='orgs' && S.currentUser.role!=='super'){return;}
  S.view=v; render();
}
function loginUser(){
  try {
    const email = (document.getElementById('loginEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('loginPassword')?.value || '';
    const error = document.getElementById('loginError');
    const user = AUTH.users.find(u => String(u.email).toLowerCase() === email && u.password === password);
    if (!user) {
      const known = AUTH.users.some(u => String(u.email).toLowerCase() === email);
      if (error) error.textContent = known ? 'Invalid email or password.' : 'No account found for this email in this browser. Please create an account first.';
      return;
    }
    if (error) error.textContent = '';
    S.currentUser = user;
    S.role = user.role;
    S.view = startView(user);
    try { LS.setItem('lf-current-user-id', String(user.id)); } catch (e) {}
    render();
  } catch (e) {
    console.error('Login error:', e);
    const error = document.getElementById('loginError');
    if (error) error.textContent = 'Could not log in. Please try again.';
  }
}
function registerUser(){
  try {
    const nameEl = document.getElementById('registerName');
    const emailEl = document.getElementById('registerEmail');
    const passwordEl = document.getElementById('registerPassword');
    const confirmEl = document.getElementById('registerPasswordConfirm');
    const error = document.getElementById('registerError');

    if (!nameEl || !emailEl || !passwordEl || !confirmEl || !error) {
      console.error('Registration form elements were not found.');
      return;
    }

    const name = nameEl.value.trim();
    const email = emailEl.value.trim().toLowerCase();
    const password = passwordEl.value;
    const confirmPassword = confirmEl.value;

    error.textContent = '';

    if (!name || !email || !password || !confirmPassword) {
      error.textContent = 'Please fill in all fields.';
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      error.textContent = 'Please enter a valid email address.';
      return;
    }
    if (password.length < 6) {
      error.textContent = 'Password must be at least 6 characters.';
      return;
    }
    if (password !== confirmPassword) {
      error.textContent = 'Passwords do not match.';
      return;
    }
    if (AUTH.users.some(u => String(u.email).toLowerCase() === email)) {
      error.textContent = 'This email is already registered.';
      return;
    }

    const newUser = {
      id: AUTH.users.length ? Math.max(...AUTH.users.map(u => Number(u.id) || 0)) + 1 : 1,
      name,
      email,
      password,
      role: 'member',
      organizationId: null,
      membershipStatus: null
    };

    AUTH.users.push(newUser);
    S.currentUser = newUser;
    S.role = 'member';
    S.view = 'community';

    // Keep the prototype account available after a page refresh.
    try {
      LS.setItem('lf-users', JSON.stringify(AUTH.users));
      LS.setItem('lf-current-user-id', String(newUser.id));
    } catch (storageError) {
      console.warn('Local storage is unavailable; account will last until refresh.', storageError);
    }

    toast('Account created');
    render();
  } catch (e) {
    console.error('Registration error:', e);
    const error = document.getElementById('registerError');
    if (error) error.textContent = 'Could not create the account. Please try again.';
  }
}
function requestMembership(organizationId){
  const user=S.currentUser; if(!user){go('login');return;}
  const existing=AUTH.requests.find(r=>r.userId===user.id&&r.organizationId===organizationId&&r.status==='pending');
  if(existing){toast('Request already sent');return;}
  AUTH.requests.push({id:AUTH.requests.length+1,userId:user.id,organizationId,status:'pending',requestedAt:new Date().toISOString(),approvedAt:null,approvedBy:null});
  user.membershipStatus='pending'; saveAuth(); toast('Membership request sent'); S.view='community'; render();
}
function approveMembership(requestId){
  if(!S.currentUser||S.currentUser.role!=='admin') return;
  const request=AUTH.requests.find(r=>r.id===requestId); if(!request)return;
  request.status='approved'; request.approvedAt=new Date().toISOString(); request.approvedBy=S.currentUser.id;
  const user=AUTH.users.find(u=>u.id===request.userId);
  if(user){user.membershipStatus='approved';user.organizationId=request.organizationId;}
  saveAuth(); toast('Membership approved'); render();
}
function rejectMembership(requestId){
  if(!S.currentUser||S.currentUser.role!=='admin') return;
  const request=AUTH.requests.find(r=>r.id===requestId); if(!request)return;
  request.status='rejected'; const user=AUTH.users.find(u=>u.id===request.userId);
  if(user){user.membershipStatus='rejected';user.organizationId=null;}
  saveAuth(); toast('Membership request rejected'); render();
}
function enterMemberArea(){
  if(!S.currentUser||S.currentUser.membershipStatus!=='approved'){go('community');return;}
  S.role='member'; S.view='home'; render();
}

function claimForm(id){
  const i = D.items.find(x=>x.id===id);
  openModal('<h1 style="font-size:20px">Claim: ' + i.t + '</h1><p class="sub">Answer these, then show ID at the office to collect it.</p>' +
    field('What color is it?','<input>') + field('Any marks or stickers?','<input>') +
    '<button class="btn" onclick="closeModal();toast(\'Claim sent to staff\')">Send claim</button> <button class="btn sec" onclick="closeModal()">Cancel</button>');
}
function setClaim(id,st){
  D.claims.find(c=>c.id===id).st = st;
  toast(st==='Returned' ? 'Handover recorded' : st==='Approved' ? 'Claim approved. Owner must visit the office with ID' : 'Claim rejected');
  render();
}
function handover(id){
  const c = D.claims.find(x=>x.id===id);
  openModal('<h1 style="font-size:20px">Hand over: ' + c.item + '</h1><p class="sub">Release the item only after checking ID in person.</p>' +
    field('ID shown by ' + c.by,'<select>' + opts(['Student ID','Driver’s license','My Number card','Passport']) + '</select>') +
    '<div class="sw"><span>Name on ID matches the claimant</span><input type="checkbox" id="k1"></div>' +
    '<div class="sw"><span>Face matches the ID photo</span><input type="checkbox" id="k2"></div>' +
    '<p id="err" class="meta" style="color:var(--red);min-height:22px"></p>' +
    '<button class="btn" onclick="finishHandover(' + id + ')">Confirm handover</button> <button class="btn sec" onclick="closeModal()">Cancel</button>');
}
function finishHandover(id){
  if(!$('#k1').checked || !$('#k2').checked){$('#err').textContent=tr('Check both boxes after verifying the ID.');return}
  closeModal();
  setClaim(id,'Returned');
}
function findByCode(v){return Object.keys(META).find(k=>META[k].code===v)}
function scan(code){
  const v = (code || ($('#scanId')||{}).value || '').trim().toUpperCase();
  if(!v){toast('Enter an item ID first');return}
  S.code = v;
  const id = findByCode(v);
  if(id){
    SCANS.unshift([new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}), v, D.items.find(x=>x.id==id).t]);
    SCANS.length = Math.min(SCANS.length,5);
  }
  render();
}
function scanCard(v){
  const id = findByCode(v);
  if(!id) return '<div class="box" style="border-color:var(--red);background:var(--redbg)"><b>No item found</b><div class="meta">Nothing matches “' + esc(v) + '”. Check the label and try again.</div></div>';
  const it = D.items.find(x=>x.id==id), m = META[id], c = D.claims.find(x=>x.item===it.t);
  const n = c ? (c.st==='Returned'?5:c.st==='Approved'?4:it.s) : it.s;
  let act;
  if(!c) act = 'No claims yet.<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><select id="shelfSel" style="padding:8px;border:1px solid var(--line);border-radius:8px">' + opts(['A-01','A-02','B-01','B-02']) + '</select><button class="btn sec" onclick="moveShelf(' + id + ')">Move to shelf</button></div>';
  else if(c.st==='Pending') act = 'Claim by ' + c.by + ' is waiting.<p><button class="btn" onclick="go(\'claims\')">Review claim</button></p>';
  else if(c.st==='Approved') act = 'Claim by ' + c.by + ' is approved.<p><button class="btn" onclick="handover(' + c.id + ')">Confirm ID and hand over</button></p>';
  else if(c.st==='Returned') act = 'Returned to ' + c.by + '.';
  else act = 'Claim by ' + c.by + ' was rejected.';
  return '<div class="tag' + (n===5?' done':'') + '"><div class="row"><div><b>' + it.t + '</b><div class="meta">' + m.code + ' · Shelf ' + m.shelf + '</div></div><span class="badge ' + (n===5?'ok':'') + '">' + STEPS[n-1] + '</span></div>' +
    '<div class="cmp"><div>Found at: ' + it.p + ' · ' + it.d + '</div><div>Reported by: ' + m.by + '</div></div>' + stepper(n) + '<p style="margin:14px 0 0">' + act + '</p></div>';
}
function moveShelf(id){
  const s = $('#shelfSel').value;
  META[id].shelf = s;
  toast('Moved to shelf ' + s);
  render();
}
function thanks(id){
  openModal('<h1 style="font-size:20px">Thank the finder</h1><p class="sub">Optional. Send whatever feels right.</p>' +
    field('Message','<textarea rows="3">Thank you so much for returning my backpack!</textarea>') +
    field('Add a gift (optional)','<select>' + opts(['No gift, message only','Gift card code']) + '</select>') +
    '<button class="btn" onclick="D.items.find(x=>x.id===' + id + ').thanked=true;closeModal();toast(\'Thanks sent\');render()">Send thanks</button> <button class="btn sec" onclick="closeModal()">Not now</button>');
}
render();