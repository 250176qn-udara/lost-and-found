<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

session_name('lfsid');
session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// Security: expire inactive sessions after 30 minutes.
const SESSION_TIMEOUT = 1800;
if (isset($_SESSION['last_activity']) && (time() - (int)$_SESSION['last_activity']) > SESSION_TIMEOUT) {
    $_SESSION = [];
    session_destroy();
    fail('Your session expired. Please log in again.', 401);
}
if (isset($_SESSION['uid'])) $_SESSION['last_activity'] = time();

function csrfToken(): string {
    if (empty($_SESSION['csrf_token'])) $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf_token'];
}
function requireCsrf(array $in): void {
    $token = (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($in['_csrf'] ?? ''));
    if (!isset($_SESSION['csrf_token']) || $token === '' || !hash_equals($_SESSION['csrf_token'], $token)) {
        fail('Security token expired. Please refresh the page and try again.', 419);
    }
}

function out(array $d, int $code = 200): never {
    http_response_code($code);
    echo json_encode($d, JSON_UNESCAPED_UNICODE);
    exit;
}
function fail(string $msg, int $code = 400): never { out(['ok' => false, 'error' => $msg], $code); }

set_exception_handler(function (Throwable $e) {
    error_log($e->getMessage());
    fail('Server error. Please try again.', 500);
});

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER, DB_PASS,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                 PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                 PDO::ATTR_EMULATE_PREPARES => false]
            );
        } catch (PDOException $e) {
            fail('Cannot connect to the database. Check api/config.php and import database/schema.sql.', 500);
        }
    }
    return $pdo;
}
function one(string $sql, array $p = []): ?array {
    $st = db()->prepare($sql); $st->execute($p);
    $r = $st->fetch();
    return $r === false ? null : $r;
}
function all(string $sql, array $p = []): array {
    $st = db()->prepare($sql); $st->execute($p);
    return $st->fetchAll();
}

$action = $_GET['action'] ?? '';
$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($isPost && ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '') !== 'lf') {
    fail('Bad request.', 400);   // blocks cross-site form posts
}
$in = [];
if ($isPost && !in_array($action, ['login', 'register'], true)) {
    requireCsrf();
}
if ($isPost) {
    $in = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($in)) $in = [];
}
if ($isPost && !in_array($action, ['login', 'register'], true)) requireCsrf($in);

/** Shapes one items-table row for the front-end (never includes the photo itself, only whether one exists). */
function itemRow(array $r): array {
    $row = [
        'id' => (int)$r['id'],
        'kind' => $r['kind'] ?? null,
        'title' => $r['title'],
        'category' => $r['category'],
        'place' => $r['place'],
        'date' => $r['item_date'],
        'description' => $r['description'] ?? null,
        'status' => (int)$r['status'],
        'hasPhoto' => (bool)$r['has_photo'],
    ];
    if (array_key_exists('matched_item_id', $r) && $r['matched_item_id'] !== null) {
        $row['matchedItemId'] = (int)$r['matched_item_id'];
        $row['matchedTitle'] = $r['matched_title'] ?? null;
        $row['matchedPlace'] = $r['matched_place'] ?? null;
        $row['matchedDate'] = $r['matched_date'] ?? null;
    }
    return $row;
}

/**
 * Basic rule-based matching (no AI yet): looks for one open item of the opposite kind,
 * in the same organization and category, that shares the place or the date. Picks the
 * closest match — same place AND date first, then same place, then same date.
 * Returns the matched item's id, or null.
 */
function findMatchFor(int $orgId, string $kind, string $category, string $place, ?string $date, int $excludeId): ?int {
    $wantKind = $kind === 'lost' ? 'found' : 'lost';
    $wantStatus = $kind === 'lost' ? [2, 3] : [1]; // a lost item matches found items already at the office; a found item matches open lost reports
    $ph = implode(',', array_fill(0, count($wantStatus), '?'));
    $rows = all("SELECT id, place, item_date FROM items
                WHERE organization_id = ? AND kind = ? AND category = ? AND matched_item_id IS NULL
                      AND status IN ($ph) AND id <> ?
                ORDER BY id", array_merge([$orgId, $wantKind, $category], $wantStatus, [$excludeId]));
    $bothMatch = null; $placeMatch = null; $dateMatch = null;
    foreach ($rows as $r) {
        $samePlace = strcasecmp((string)$r['place'], $place) === 0;
        $sameDate = $date !== null && $r['item_date'] === $date;
        if ($samePlace && $sameDate) { $bothMatch = (int)$r['id']; break; }
        if ($samePlace && $placeMatch === null) $placeMatch = (int)$r['id'];
        if ($sameDate && $dateMatch === null) $dateMatch = (int)$r['id'];
    }
    return $bothMatch ?? $placeMatch ?? $dateMatch;
}

/** Links two items as a match (status -> Matched, unless already further along) and stamps matched_at. */
function applyMatch(int $itemId, int $matchId): void {
    db()->prepare("UPDATE items SET matched_item_id = ?, matched_at = NOW(),
                   status = GREATEST(status, 3) WHERE id = ?")->execute([$matchId, $itemId]);
}

/** Shapes one claims-table row (joined) for the front-end. */
function claimRow(array $r): array {
    return [
        'id' => (int)$r['id'],
        'itemTitle' => $r['item_title'],
        'itemPlace' => $r['item_place'],
        'itemDate' => $r['item_date'],
        'itemCode' => $r['item_code'],
        'answers' => $r['answers'],
        'status' => $r['status'],
        'claimantName' => $r['claimant_name'] ?? null,
        'claimantEmail' => $r['claimant_email'] ?? null,
        'lostDescription' => $r['lost_description'] ?? null,
        'createdAt' => $r['created_at'],
    ];
}

/** Current user + their membership state, in the shape the front-end expects. */
function state(int $uid): ?array {
    $u = one('SELECT id, name, email FROM users WHERE id = ?', [$uid]);
    if (!$u) return null;
    $m = one("SELECT organization_id, role FROM organization_members
              WHERE user_id = ? AND status = 'approved'
              ORDER BY approved_at DESC, id DESC LIMIT 1", [$uid]);
    $p = one("SELECT id, organization_id FROM organization_members
              WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1", [$uid]);
    $last = null;
    if (!$m && !$p) {
        $last = one('SELECT status FROM organization_members WHERE user_id = ? ORDER BY id DESC LIMIT 1', [$uid]);
    }
    return [
        'user' => [
            'id' => (int)$u['id'], 'name' => $u['name'], 'email' => $u['email'],
            'role' => $m ? $m['role'] : 'member',
            'organizationId' => $m ? (int)$m['organization_id'] : null,
            'membershipStatus' => $m ? 'approved' : ($p ? 'pending' : ($last['status'] ?? null)),
        ],
        'pending' => $p ? ['id' => (int)$p['id'], 'organizationId' => (int)$p['organization_id']] : null,
    ];
}
function requireLogin(): int {
    $uid = (int)($_SESSION['uid'] ?? 0);
    if ($uid <= 0 || !state($uid)) fail('Please log in.', 401);
    return $uid;
}
/** Returns [staffUserId, organizationId] or stops the request. Staff and admins both work the front desk. */
function requireStaff(): array {
    $uid = requireLogin();
    $s = state($uid)['user'];
    if (!in_array($s['role'], ['staff', 'admin'], true) || !$s['organizationId']) fail('Staff only.', 403);
    return [$uid, $s['organizationId']];
}

/** Returns [adminUserId, organizationId] or stops the request. */
function requireAdmin(): array {
    $uid = requireLogin();
    $s = state($uid)['user'];
    if ($s['role'] !== 'admin' || !$s['organizationId']) fail('Administrators only.', 403);
    return [$uid, $s['organizationId']];
}

switch ($action) {

case 'me':
    $uid = (int)($_SESSION['uid'] ?? 0);
    $s = $uid ? state($uid) : null;
    out(['ok' => true, 'user' => $s['user'] ?? null, 'pending' => $s['pending'] ?? null, 'csrfToken' => csrfToken()]);

case 'organizations':
    out(['ok' => true, 'organizations' => array_map(
        fn($o) => ['id' => (int)$o['id'], 'name' => $o['name'], 'type' => $o['type']],
        all('SELECT id, name, type FROM organizations ORDER BY id'))]);

case 'register':
    if (!$isPost) fail('POST required.', 405);
    $name  = trim((string)($in['name'] ?? ''));
    $email = strtolower(trim((string)($in['email'] ?? '')));
    $pass  = (string)($in['password'] ?? '');
    if ($name === '' || $email === '' || $pass === '') fail('Please fill in all fields.');
    if (!preg_match('/^.{1,100}$/su', $name)) fail('Name is too long.');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190) fail('Please enter a valid email address.');
    if (strlen($pass) < 6) fail('Password must be at least 6 characters.');
    if (strlen($pass) > 72) fail('Password must be at most 72 characters.');
    if (one('SELECT id FROM users WHERE email = ?', [$email])) fail('This email is already registered.', 409);
    try {
        $st = db()->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
        $st->execute([$name, $email, password_hash($pass, PASSWORD_BCRYPT)]);
    } catch (PDOException $e) {
        fail('This email is already registered.', 409);
    }
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)db()->lastInsertId();
    $_SESSION['last_activity'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $s = state($_SESSION['uid']);
    out(['ok' => true, 'user' => $s['user'], 'pending' => $s['pending'], 'csrfToken' => csrfToken()]);

case 'login':
    if (!$isPost) fail('POST required.', 405);
    $email = strtolower(trim((string)($in['email'] ?? '')));
    $pass  = (string)($in['password'] ?? '');
    $u = one('SELECT id, password_hash FROM users WHERE email = ?', [$email]);
    if (!$u || !password_verify($pass, $u['password_hash'])) fail('Invalid email or password.', 401);
    session_regenerate_id(true);
    $_SESSION['uid'] = (int)$u['id'];
    $_SESSION['last_activity'] = time();
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    $s = state((int)$u['id']);
    out(['ok' => true, 'user' => $s['user'], 'pending' => $s['pending'], 'csrfToken' => csrfToken()]);

case 'logout':
    if (!$isPost) fail('POST required.', 405);
    $_SESSION = [];
    session_destroy();
    out(['ok' => true]);

case 'request_membership':
    if (!$isPost) fail('POST required.', 405);
    $uid = requireLogin();
    $orgId = (int)($in['organization_id'] ?? 0);
    if (!one('SELECT id FROM organizations WHERE id = ?', [$orgId])) fail('Organization not found.', 404);
    if (one("SELECT id FROM organization_members WHERE user_id = ? AND organization_id = ? AND status = 'approved'", [$uid, $orgId]))
        fail('You are already a member.', 409);
    if (one("SELECT id FROM organization_members WHERE user_id = ? AND status = 'pending'", [$uid]))
        fail('Request already sent.', 409);
    $st = db()->prepare("INSERT INTO organization_members (user_id, organization_id, status, role) VALUES (?, ?, 'pending', 'member')");
    $st->execute([$uid, $orgId]);
    out(['ok' => true]);

case 'admin_data':
    [, $orgId] = requireAdmin();
    $pending = all("SELECT m.id, u.name, u.email, o.name AS organization_name
                    FROM organization_members m
                    JOIN users u ON u.id = m.user_id
                    JOIN organizations o ON o.id = m.organization_id
                    WHERE m.organization_id = ? AND m.status = 'pending'
                    ORDER BY m.requested_at, m.id", [$orgId]);
    $members = all("SELECT u.name, u.email, m.role
                    FROM organization_members m JOIN users u ON u.id = m.user_id
                    WHERE m.organization_id = ? AND m.status = 'approved'
                    ORDER BY u.name", [$orgId]);
    out(['ok' => true, 'pending' => $pending, 'members' => $members]);

case 'decide':
    if (!$isPost) fail('POST required.', 405);
    [$adminId, $orgId] = requireAdmin();
    $id  = (int)($in['id'] ?? 0);
    $act = (string)($in['action'] ?? '');
    if (!in_array($act, ['approve', 'reject'], true)) fail('Unknown action.');
    $req = one('SELECT id, user_id, organization_id, status FROM organization_members WHERE id = ?', [$id]);
    // An admin may only decide requests for their own organization.
    if (!$req || (int)$req['organization_id'] !== $orgId) fail('Request not found.', 404);
    if ($req['status'] !== 'pending') fail('This request was already handled.', 409);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        if ($act === 'approve') {
            // Switching community: the previous approved membership is closed.
            $pdo->prepare("UPDATE organization_members SET status = 'left'
                           WHERE user_id = ? AND status = 'approved' AND id <> ?")
                ->execute([$req['user_id'], $id]);
            $pdo->prepare("UPDATE organization_members
                           SET status = 'approved', approved_at = NOW(), approved_by = ? WHERE id = ?")
                ->execute([$adminId, $id]);
        } else {
            $pdo->prepare("UPDATE organization_members SET status = 'rejected' WHERE id = ?")->execute([$id]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Could not save. Please try again.', 500);
    }
    out(['ok' => true]);

case 'report_item':
    if (!$isPost) fail('POST required.', 405);
    $uid = requireLogin();
    $s = state($uid)['user'];
    if ($s['membershipStatus'] !== 'approved' || !$s['organizationId']) fail('Join a community before reporting an item.', 403);

    $kind = (string)($in['kind'] ?? '');
    if (!in_array($kind, ['lost', 'found'], true)) fail('Please say whether this was lost or found.');
    $title = trim((string)($in['title'] ?? ''));
    $category = trim((string)($in['category'] ?? ''));
    $place = trim((string)($in['place'] ?? ''));
    $desc = trim((string)($in['description'] ?? ''));
    $date = (string)($in['item_date'] ?? '');
    $photo = $in['photo'] ?? null;

    if ($title === '' || $category === '' || $place === '') fail('Please fill in the item name, category and place.');
    if (!preg_match('/^.{1,150}$/su', $title)) fail('Item name is too long.');
    if (!preg_match('/^.{1,50}$/su', $category)) fail('Category is too long.');
    if (!preg_match('/^.{1,100}$/su', $place)) fail('Place is too long.');
    if ($desc !== '' && !preg_match('/^.{0,2000}$/su', $desc)) fail('Description is too long.');
    $itemDate = null;
    if ($date !== '') {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        if (!$d || $d->format('Y-m-d') !== $date) fail('Please enter a valid date.');
        $itemDate = $date;
    }
    if ($photo !== null) {
        if (!is_string($photo) || !preg_match('/^data:image\/(png|jpe?g|webp|gif);base64,/', $photo)) fail('Photo must be an image.');
        if (strlen($photo) > 2_000_000) fail('Photo is too large. Please use a smaller image.');
    }

    $st = db()->prepare('INSERT INTO items (organization_id, reporter_id, kind, title, category, place, item_date, description, photo, status)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)');
    $st->execute([$s['organizationId'], $uid, $kind, $title, $category, $place, $itemDate, $desc ?: null, $photo]);
    $id = (int)db()->lastInsertId();
    $matchId = findMatchFor($s['organizationId'], $kind, $category, $place, $itemDate, $id);
    if ($matchId !== null) applyMatch($id, $matchId);
    out(['ok' => true, 'id' => $id, 'matched' => $matchId !== null]);

case 'my_items':
    $uid = requireLogin();
    $s = state($uid)['user'];
    if (!$s['organizationId']) out(['ok' => true, 'items' => []]);
    $rows = all("SELECT i.id, i.kind, i.title, i.category, i.place, i.item_date, i.description, i.status,
                       (i.photo IS NOT NULL) AS has_photo, i.created_at,
                       i.matched_item_id, m.title AS matched_title, m.place AS matched_place, m.item_date AS matched_date
                FROM items i LEFT JOIN items m ON m.id = i.matched_item_id
                WHERE i.reporter_id = ? AND i.organization_id = ? ORDER BY i.id DESC",
                [$uid, $s['organizationId']]);
    out(['ok' => true, 'items' => array_map('itemRow', $rows)]);

case 'browse_items':
    $uid = requireLogin();
    $s = state($uid)['user'];
    if ($s['membershipStatus'] !== 'approved' || !$s['organizationId']) fail('Join a community first.', 403);
    $category = trim((string)($_GET['category'] ?? ''));
    // Found items only, and never the reporter's identity — browsing is anonymous by design.
    if ($category !== '' && $category !== 'All') {
        $rows = all("SELECT id, title, category, place, item_date, status, (photo IS NOT NULL) AS has_photo
                    FROM items WHERE organization_id = ? AND kind = 'found' AND status < 5 AND category = ?
                    ORDER BY id DESC", [$s['organizationId'], $category]);
    } else {
        $rows = all("SELECT id, title, category, place, item_date, status, (photo IS NOT NULL) AS has_photo
                    FROM items WHERE organization_id = ? AND kind = 'found' AND status < 5
                    ORDER BY id DESC", [$s['organizationId']]);
    }
    out(['ok' => true, 'items' => array_map('itemRow', $rows)]);

case 'item_photo':
    $uid = requireLogin();
    $s = state($uid)['user'];
    $id = (int)($_GET['id'] ?? 0);
    $row = one('SELECT photo, organization_id FROM items WHERE id = ?', [$id]);
    if (!$row || (int)$row['organization_id'] !== (int)$s['organizationId']) fail('Not found.', 404);
    if (!$row['photo'] || !preg_match('/^data:(image\/[a-z]+);base64,(.+)$/s', $row['photo'], $m)) fail('No photo.', 404);
    header('Content-Type: ' . $m[1]);
    header('Cache-Control: private, max-age=3600');
    echo base64_decode($m[2]);
    exit;

case 'queue_data':
    [, $orgId] = requireStaff();
    $rows = all("SELECT i.id, i.title, i.category, i.place, i.item_date, i.description, u.name AS reporter_name
                FROM items i JOIN users u ON u.id = i.reporter_id
                WHERE i.organization_id = ? AND i.kind = 'found' AND i.status = 1
                ORDER BY i.created_at", [$orgId]);
    out(['ok' => true, 'items' => array_map(fn($r) => [
        'id' => (int)$r['id'], 'title' => $r['title'], 'category' => $r['category'],
        'place' => $r['place'], 'date' => $r['item_date'], 'description' => $r['description'],
        'reporterName' => $r['reporter_name'],
    ], $rows)]);

case 'receive_and_register':
    if (!$isPost) fail('POST required.', 405);
    [$uid, $orgId] = requireStaff();
    $existingId = (int)($in['existing_item_id'] ?? 0);
    $title = trim((string)($in['title'] ?? ''));
    $category = trim((string)($in['category'] ?? ''));
    $place = trim((string)($in['place'] ?? ''));
    $desc = trim((string)($in['description'] ?? ''));
    $date = (string)($in['item_date'] ?? '');
    $shelf = trim((string)($in['shelf'] ?? ''));
    $finder = trim((string)($in['finder_name'] ?? ''));
    $photo = $in['photo'] ?? null;

    if ($title === '' || $category === '' || $place === '' || $shelf === '') fail('Please fill in the item name, category, place and shelf.');
    if (!preg_match('/^.{1,150}$/su', $title)) fail('Item name is too long.');
    if (!preg_match('/^.{1,50}$/su', $category)) fail('Category is too long.');
    if (!preg_match('/^.{1,100}$/su', $place)) fail('Place is too long.');
    if (!preg_match('/^.{1,10}$/su', $shelf)) fail('Shelf is too long.');
    if ($finder !== '' && !preg_match('/^.{1,100}$/su', $finder)) fail('Finder name is too long.');
    if ($desc !== '' && !preg_match('/^.{0,2000}$/su', $desc)) fail('Description is too long.');
    $itemDate = null;
    if ($date !== '') {
        $d = DateTime::createFromFormat('Y-m-d', $date);
        if (!$d || $d->format('Y-m-d') !== $date) fail('Please enter a valid date.');
        $itemDate = $date;
    }
    if ($photo !== null) {
        if (!is_string($photo) || !preg_match('/^data:image\/(png|jpe?g|webp|gif);base64,/', $photo)) fail('Photo must be an image.');
        if (strlen($photo) > 2_000_000) fail('Photo is too large. Please use a smaller image.');
    }

    $pdo = db();
    if ($existingId > 0) {
        $item = one('SELECT id, organization_id, kind, status, photo FROM items WHERE id = ?', [$existingId]);
        if (!$item || (int)$item['organization_id'] !== $orgId || $item['kind'] !== 'found') fail('Item not found.', 404);
        if ((int)$item['status'] !== 1) fail('This item was already received.', 409);
        $keepPhoto = $photo === null;
        $sql = "UPDATE items SET title=?, category=?, place=?, item_date=?, description=?, shelf=?, finder_name=?,
                status=2, received_by=?, received_at=NOW()" . ($keepPhoto ? '' : ', photo=?') . " WHERE id=?";
        $params = [$title, $category, $place, $itemDate, $desc ?: null, $shelf, $finder ?: null, $uid];
        if (!$keepPhoto) $params[] = $photo;
        $params[] = $existingId;
        $pdo->prepare($sql)->execute($params);
        $id = $existingId;
    } else {
        $st = $pdo->prepare("INSERT INTO items (organization_id, reporter_id, kind, title, category, place, item_date, description, photo, shelf, finder_name, status, received_by, received_at)
                            VALUES (?, ?, 'found', ?, ?, ?, ?, ?, ?, ?, ?, 2, ?, NOW())");
        $st->execute([$orgId, $uid, $title, $category, $place, $itemDate, $desc ?: null, $photo, $shelf, $finder ?: null, $uid]);
        $id = (int)$pdo->lastInsertId();
    }
    // Assign a permanent item code the first time an item is received.
    $code = one('SELECT item_code FROM items WHERE id = ?', [$id])['item_code'] ?? null;
    if (!$code) {
        $code = 'LF-' . date('Y') . '-' . str_pad((string)$id, 4, '0', STR_PAD_LEFT);
        $pdo->prepare('UPDATE items SET item_code = ? WHERE id = ?')->execute([$code, $id]);
    }
    // Now that the item is confirmed at the office, look for a lost report to suggest it against.
    $matchId = findMatchFor($orgId, 'found', $category, $place, $itemDate, $id);
    if ($matchId !== null) { applyMatch($matchId, $id); applyMatch($id, $matchId); }
    out(['ok' => true, 'id' => $id, 'itemCode' => $code, 'shelf' => $shelf]);

case 'scan_item':
    [, $orgId] = requireStaff();
    $code = strtoupper(trim((string)($_GET['code'] ?? '')));
    if ($code === '') fail('Please enter an item code.');
    $row = one("SELECT i.id, i.kind, i.title, i.category, i.place, i.item_date, i.description, i.status,
                      i.item_code, i.shelf, i.finder_name, i.received_at, (i.photo IS NOT NULL) AS has_photo,
                      ru.name AS reporter_name, hu.name AS received_by_name
                FROM items i
                JOIN users ru ON ru.id = i.reporter_id
                LEFT JOIN users hu ON hu.id = i.received_by
                WHERE i.item_code = ? AND i.organization_id = ?", [$code, $orgId]);
    if (!$row) fail('Nothing matches “' . $code . '”. Check the label and try again.', 404);
    out(['ok' => true, 'item' => [
        'id' => (int)$row['id'], 'kind' => $row['kind'], 'title' => $row['title'], 'category' => $row['category'],
        'place' => $row['place'], 'date' => $row['item_date'], 'description' => $row['description'],
        'status' => (int)$row['status'], 'itemCode' => $row['item_code'], 'shelf' => $row['shelf'],
        'finderName' => $row['finder_name'], 'receivedAt' => $row['received_at'], 'hasPhoto' => (bool)$row['has_photo'],
        'reporterName' => $row['reporter_name'], 'receivedByName' => $row['received_by_name'],
    ]]);

case 'request_claim':
    if (!$isPost) fail('POST required.', 405);
    $uid = requireLogin();
    $s = state($uid)['user'];
    if ($s['membershipStatus'] !== 'approved' || !$s['organizationId']) fail('Join a community first.', 403);
    $foundId = (int)($in['found_item_id'] ?? 0);
    $answers = trim((string)($in['answers'] ?? ''));
    if ($answers === '') fail('Please answer the verification questions.');
    if (!preg_match('/^.{1,1000}$/su', $answers)) fail('Answer is too long.');
    $found = one("SELECT id, organization_id, kind, status, matched_item_id FROM items WHERE id = ?", [$foundId]);
    if (!$found || (int)$found['organization_id'] !== $s['organizationId'] || $found['kind'] !== 'found') fail('Item not found.', 404);
    if ((int)$found['status'] < 2) fail('This item is not at the office yet.', 409);
    if ((int)$found['status'] >= 5) fail('This item has already been returned.', 409);
    if (one("SELECT id FROM claims WHERE found_item_id = ? AND claimant_id = ? AND status IN ('pending','approved')", [$foundId, $uid]))
        fail('You already sent a claim for this item.', 409);
    // If the system had already suggested this found item to one of the claimant's own lost reports, link it.
    $lost = one("SELECT id FROM items WHERE id = ? AND reporter_id = ? AND kind = 'lost'",
                [(int)($found['matched_item_id'] ?? 0), $uid]);
    $lostId = $lost ? (int)$lost['id'] : null;
    db()->prepare("INSERT INTO claims (found_item_id, lost_item_id, claimant_id, answers) VALUES (?, ?, ?, ?)")
        ->execute([$foundId, $lostId, $uid, $answers]);
    db()->prepare("UPDATE items SET status = GREATEST(status, 3) WHERE id = ?")->execute([$foundId]);
    out(['ok' => true]);

case 'my_claims':
    $uid = requireLogin();
    $rows = all("SELECT c.id, c.status, c.created_at, c.answers,
                       i.title AS item_title, i.place AS item_place, i.item_date, i.item_code
                FROM claims c JOIN items i ON i.id = c.found_item_id
                WHERE c.claimant_id = ? ORDER BY c.id DESC", [$uid]);
    out(['ok' => true, 'claims' => array_map('claimRow', $rows)]);

case 'claims_queue':
    [, $orgId] = requireStaff();
    $rows = all("SELECT c.id, c.status, c.created_at, c.answers,
                       i.title AS item_title, i.place AS item_place, i.item_date, i.item_code,
                       u.name AS claimant_name, u.email AS claimant_email,
                       l.description AS lost_description
                FROM claims c
                JOIN items i ON i.id = c.found_item_id
                JOIN users u ON u.id = c.claimant_id
                LEFT JOIN items l ON l.id = c.lost_item_id
                WHERE i.organization_id = ? AND c.status IN ('pending','approved')
                ORDER BY c.status = 'pending' DESC, c.created_at", [$orgId]);
    out(['ok' => true, 'claims' => array_map('claimRow', $rows)]);

case 'decide_claim':
    if (!$isPost) fail('POST required.', 405);
    [$staffId, $orgId] = requireStaff();
    $id = (int)($in['id'] ?? 0);
    $act = (string)($in['action'] ?? '');
    if (!in_array($act, ['approve', 'reject'], true)) fail('Unknown action.');
    $c = one("SELECT c.id, c.status, c.found_item_id, c.lost_item_id, i.organization_id
              FROM claims c JOIN items i ON i.id = c.found_item_id WHERE c.id = ?", [$id]);
    if (!$c || (int)$c['organization_id'] !== $orgId) fail('Claim not found.', 404);
    if ($c['status'] !== 'pending') fail('This claim was already handled.', 409);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE claims SET status = ?, decided_at = NOW(), decided_by = ? WHERE id = ?")
            ->execute([$act === 'approve' ? 'approved' : 'rejected', $staffId, $id]);
        if ($act === 'approve') {
            $pdo->prepare("UPDATE items SET status = 4 WHERE id = ?")->execute([$c['found_item_id']]);
            if ($c['lost_item_id']) $pdo->prepare("UPDATE items SET status = 4 WHERE id = ?")->execute([$c['lost_item_id']]);
        } else {
            // Reopen the found item for other claimants, and let the lost report be matched again.
            $stillClaimed = one("SELECT id FROM claims WHERE found_item_id = ? AND status IN ('pending','approved')", [$c['found_item_id']]);
            if (!$stillClaimed) $pdo->prepare("UPDATE items SET status = 2 WHERE id = ?")->execute([$c['found_item_id']]);
            if ($c['lost_item_id']) $pdo->prepare("UPDATE items SET status = 1, matched_item_id = NULL WHERE id = ?")->execute([$c['lost_item_id']]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Could not save. Please try again.', 500);
    }
    out(['ok' => true]);

case 'handover_claim':
    if (!$isPost) fail('POST required.', 405);
    [$staffId, $orgId] = requireStaff();
    $id = (int)($in['id'] ?? 0);
    $idType = trim((string)($in['id_type'] ?? ''));
    if ($idType === '') fail('Please select the ID shown.');
    $c = one("SELECT c.id, c.status, c.found_item_id, c.lost_item_id, i.organization_id
              FROM claims c JOIN items i ON i.id = c.found_item_id WHERE c.id = ?", [$id]);
    if (!$c || (int)$c['organization_id'] !== $orgId) fail('Claim not found.', 404);
    if ($c['status'] !== 'approved') fail('This claim is not ready for handover.', 409);
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare("UPDATE claims SET status = 'returned', returned_at = NOW(), returned_by = ?, id_type = ? WHERE id = ?")
            ->execute([$staffId, $idType, $id]);
        $pdo->prepare("UPDATE items SET status = 5 WHERE id = ?")->execute([$c['found_item_id']]);
        if ($c['lost_item_id']) $pdo->prepare("UPDATE items SET status = 5 WHERE id = ?")->execute([$c['lost_item_id']]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Could not save. Please try again.', 500);
    }
    out(['ok' => true]);

default:
    fail('Unknown action.', 404);
}