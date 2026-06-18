const router = require('express').Router();
const { pool } = require('../db');

function requireAdmin(req, res, next) {
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';
  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    return res.status(401).set('WWW-Authenticate', 'Basic realm="PipeFabAR Admin"').send('Unauthorized');
  }
  const [username, password] = Buffer.from(encoded, 'base64').toString().split(':');
  if (username !== 'admin' || password !== adminPassword) {
    return res.status(401).set('WWW-Authenticate', 'Basic realm="PipeFabAR Admin"').send('Unauthorized');
  }
  next();
}

router.get('/', requireAdmin, (req, res) => {
  res.send(adminHTML());
});

// --- Promo code API ---

router.get('/api/promo-codes', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT pc.*,
        (SELECT COUNT(*) FROM promo_code_redemptions WHERE promo_code_id = pc.id) AS redemption_count
       FROM promo_codes pc ORDER BY pc.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/api/promo-codes', requireAdmin, async (req, res, next) => {
  try {
    const { code, max_uses, grant_duration_days, expires_at } = req.body;
    if (!code || !max_uses || !grant_duration_days) {
      return res.status(400).json({ error: 'code, max_uses, and grant_duration_days are required' });
    }
    const { rows } = await pool.query(
      `INSERT INTO promo_codes (code, max_uses, grant_duration_days, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [code.toUpperCase().trim(), parseInt(max_uses), parseInt(grant_duration_days), expires_at || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Code already exists' });
    next(err);
  }
});

router.patch('/api/promo-codes/:id', requireAdmin, async (req, res, next) => {
  try {
    const { max_uses, grant_duration_days, expires_at } = req.body;
    const { rows } = await pool.query(
      `UPDATE promo_codes SET
        max_uses = COALESCE($1, max_uses),
        grant_duration_days = COALESCE($2, grant_duration_days),
        expires_at = $3,
        updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [max_uses ? parseInt(max_uses) : null, grant_duration_days ? parseInt(grant_duration_days) : null, expires_at || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/api/promo-codes/:id', requireAdmin, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM promo_code_redemptions WHERE promo_code_id = $1', [req.params.id]);
    await pool.query('DELETE FROM promo_codes WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.get('/api/promo-codes/:id/redemptions', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.full_name, u.email, pcr.redeemed_at, pcr.access_expires_at
       FROM promo_code_redemptions pcr
       JOIN users u ON u.id = pcr.user_id
       WHERE pcr.promo_code_id = $1
       ORDER BY pcr.redeemed_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// --- Users API ---

router.get('/api/users', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT
        u.id, u.full_name, u.email, u.created_at,
        CASE
          WHEN (SELECT COUNT(*) FROM promo_code_redemptions WHERE user_id = u.id AND access_expires_at > NOW()) > 0 THEN 'promo'
          ELSE 'free'
        END AS subscription_tier,
        (SELECT MAX(access_expires_at) FROM promo_code_redemptions WHERE user_id = u.id AND access_expires_at > NOW()) AS promo_expires_at
       FROM users u
       ORDER BY u.created_at DESC`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

router.delete('/api/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;

function adminHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PipeFabAR Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d1117; color: #e6edf3; min-height: 100vh; }
  header { background: #161b22; border-bottom: 1px solid #30363d; padding: 16px 24px; display: flex; align-items: center; gap: 12px; }
  header h1 { font-size: 18px; font-weight: 700; color: #fff; letter-spacing: 1px; }
  header span { font-size: 12px; color: #3b8ef3; background: #1c3a6a; padding: 2px 8px; border-radius: 20px; font-weight: 600; }
  nav { display: flex; gap: 2px; padding: 16px 24px 0; border-bottom: 1px solid #30363d; }
  nav button { background: none; border: none; color: #8b949e; font-size: 14px; font-weight: 500; padding: 8px 16px; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; }
  nav button.active, nav button:hover { color: #e6edf3; border-bottom-color: #3b8ef3; }
  main { padding: 24px; max-width: 1100px; }
  section { display: none; }
  section.active { display: block; }
  h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #fff; }
  .card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
  .form-row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
  .field { display: flex; flex-direction: column; gap: 5px; }
  .field label { font-size: 12px; font-weight: 500; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
  input { background: #0d1117; border: 1px solid #30363d; border-radius: 6px; color: #e6edf3; font-size: 14px; padding: 8px 12px; outline: none; }
  input:focus { border-color: #3b8ef3; }
  input[type="number"] { width: 100px; }
  input[type="date"] { width: 160px; }
  input[type="text"] { width: 180px; }
  .btn { padding: 8px 16px; border-radius: 6px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
  .btn:hover { opacity: 0.85; }
  .btn-primary { background: #3b8ef3; color: #fff; }
  .btn-danger { background: #da3633; color: #fff; }
  .btn-ghost { background: #21262d; color: #e6edf3; border: 1px solid #30363d; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; color: #8b949e; font-weight: 500; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #30363d; }
  td { padding: 10px 12px; border-bottom: 1px solid #21262d; vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #1c2128; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-green { background: #1a4731; color: #3fb950; }
  .badge-blue { background: #1c3a6a; color: #3b8ef3; }
  .badge-purple { background: #2d1f57; color: #a371f7; }
  .badge-gray { background: #21262d; color: #8b949e; }
  .empty { text-align: center; padding: 40px; color: #8b949e; font-size: 14px; }
  .toast { position: fixed; bottom: 24px; right: 24px; background: #1a4731; color: #3fb950; border: 1px solid #3fb950; padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 500; opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 999; }
  .toast.err { background: #4a1515; color: #f85149; border-color: #f85149; }
  .toast.show { opacity: 1; }
  .modal-bg { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 100; align-items: center; justify-content: center; }
  .modal-bg.open { display: flex; }
  .modal { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 24px; width: 560px; max-width: 95vw; max-height: 80vh; overflow-y: auto; }
  .modal h3 { font-size: 15px; font-weight: 600; margin-bottom: 16px; }
  .modal-close { float: right; background: none; border: none; color: #8b949e; font-size: 18px; cursor: pointer; }
  .stat { font-size: 12px; color: #8b949e; }
</style>
</head>
<body>
<header>
  <h1>PIPEFABAR</h1>
  <span>ADMIN</span>
</header>
<nav>
  <button class="active" onclick="showTab('promo', event)">Promo Codes</button>
  <button onclick="showTab('users', event)">Users</button>
</nav>
<main>

<section id="tab-promo" class="active">
  <h2>Promo Codes</h2>
  <div class="card">
    <div class="form-row">
      <div class="field"><label>Code</label><input id="new-code" type="text" placeholder="PIPEPRO2026" style="text-transform:uppercase"></div>
      <div class="field"><label>Max Uses</label><input id="new-max" type="number" value="100" min="1"></div>
      <div class="field"><label>Days of Access</label><input id="new-days" type="number" value="365" min="1"></div>
      <div class="field"><label>Code Expires (optional)</label><input id="new-expires" type="date"></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-primary" onclick="createCode()">Create Code</button></div>
    </div>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <table>
      <thead><tr><th>Code</th><th>Uses</th><th>Days Given</th><th>Code Expires</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody id="promo-body"><tr><td colspan="6" class="empty">Loading…</td></tr></tbody>
    </table>
  </div>
</section>

<section id="tab-users">
  <h2>Users</h2>
  <div class="card">
    <input id="user-search" type="text" placeholder="Search by name or email…" style="width:100%;max-width:400px" oninput="filterUsers()">
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Access</th><th>Actions</th></tr></thead>
      <tbody id="users-body"><tr><td colspan="5" class="empty">Loading…</td></tr></tbody>
    </table>
  </div>
</section>

</main>

<div class="modal-bg" id="redemptions-modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <button class="modal-close" onclick="closeModal()">×</button>
    <h3 id="modal-title">Redemptions</h3>
    <table>
      <thead><tr><th>Name</th><th>Email</th><th>Redeemed</th><th>Access Until</th></tr></thead>
      <tbody id="modal-body"></tbody>
    </table>
  </div>
</div>

<div class="modal-bg" id="edit-modal" onclick="if(event.target===this)closeEditModal()">
  <div class="modal">
    <button class="modal-close" onclick="closeEditModal()">×</button>
    <h3>Edit Promo Code</h3>
    <input type="hidden" id="edit-id">
    <div class="form-row" style="flex-direction:column;gap:14px">
      <div class="field"><label>Max Uses</label><input id="edit-max" type="number" min="1"></div>
      <div class="field"><label>Days of Access</label><input id="edit-days" type="number" min="1"></div>
      <div class="field"><label>Code Expires (leave blank = never)</label><input id="edit-expires" type="date"></div>
      <button class="btn btn-primary" onclick="saveEdit()">Save Changes</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const base = window.location.pathname.replace(/\\/+$/, '');

function showTab(name, e) {
  document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  e.target.classList.add('active');
  if (name === 'promo') loadCodes();
  if (name === 'users') loadUsers();
}

function toast(msg, err) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show' + (err ? ' err' : '');
  setTimeout(() => el.className = 'toast', 3000);
}

async function api(path, options) {
  const r = await fetch(base + path, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || r.statusText); }
  return r.json();
}

async function loadCodes() {
  try {
    const codes = await api('/api/promo-codes');
    const tbody = document.getElementById('promo-body');
    if (!codes.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No promo codes yet.</td></tr>'; return; }
    tbody.innerHTML = codes.map(c => {
      const active = !c.expires_at || new Date(c.expires_at) > new Date();
      const full = c.current_uses >= c.max_uses;
      const status = !active ? '<span class="badge badge-gray">Expired</span>' : full ? '<span class="badge badge-gray">Full</span>' : '<span class="badge badge-green">Active</span>';
      const exp = c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—';
      return \`<tr>
        <td><strong>\${c.code}</strong></td>
        <td>\${c.current_uses} / \${c.max_uses} <span class="stat">(\${c.redemption_count} redeemed)</span></td>
        <td>\${c.grant_duration_days} days</td>
        <td>\${exp}</td>
        <td>\${status}</td>
        <td style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="viewRedemptions('\${c.id}','\${c.code}')">View</button>
          <button class="btn btn-ghost btn-sm" onclick="openEdit('\${c.id}',\${c.max_uses},\${c.grant_duration_days},'\${c.expires_at||''}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteCode('\${c.id}','\${c.code}')">Delete</button>
        </td>
      </tr>\`;
    }).join('');
  } catch(e) { toast(e.message, true); }
}

async function createCode() {
  const code = document.getElementById('new-code').value.trim().toUpperCase();
  const max_uses = document.getElementById('new-max').value;
  const grant_duration_days = document.getElementById('new-days').value;
  const expires_at = document.getElementById('new-expires').value || null;
  if (!code || !max_uses || !grant_duration_days) return toast('Fill in all required fields', true);
  try {
    await api('/api/promo-codes', { method: 'POST', body: JSON.stringify({ code, max_uses, grant_duration_days, expires_at }) });
    document.getElementById('new-code').value = '';
    toast('Code created: ' + code);
    loadCodes();
  } catch(e) { toast(e.message, true); }
}

async function deleteCode(id, code) {
  if (!confirm('Delete code ' + code + '? This also removes all redemptions.')) return;
  try {
    await api('/api/promo-codes/' + id, { method: 'DELETE' });
    toast('Deleted ' + code);
    loadCodes();
  } catch(e) { toast(e.message, true); }
}

function openEdit(id, max, days, expires) {
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-max').value = max;
  document.getElementById('edit-days').value = days;
  document.getElementById('edit-expires').value = expires ? expires.split('T')[0] : '';
  document.getElementById('edit-modal').classList.add('open');
}
function closeEditModal() { document.getElementById('edit-modal').classList.remove('open'); }

async function saveEdit() {
  const id = document.getElementById('edit-id').value;
  const max_uses = document.getElementById('edit-max').value;
  const grant_duration_days = document.getElementById('edit-days').value;
  const expires_at = document.getElementById('edit-expires').value || null;
  try {
    await api('/api/promo-codes/' + id, { method: 'PATCH', body: JSON.stringify({ max_uses, grant_duration_days, expires_at }) });
    closeEditModal();
    toast('Saved');
    loadCodes();
  } catch(e) { toast(e.message, true); }
}

async function viewRedemptions(id, code) {
  document.getElementById('modal-title').textContent = 'Redemptions — ' + code;
  document.getElementById('modal-body').innerHTML = '<tr><td colspan="4" class="empty">Loading…</td></tr>';
  document.getElementById('redemptions-modal').classList.add('open');
  try {
    const rows = await api('/api/promo-codes/' + id + '/redemptions');
    const tbody = document.getElementById('modal-body');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">No redemptions yet.</td></tr>'; return; }
    tbody.innerHTML = rows.map(r => \`<tr>
      <td>\${r.full_name || '—'}</td>
      <td>\${r.email || '—'}</td>
      <td>\${new Date(r.redeemed_at).toLocaleDateString()}</td>
      <td>\${new Date(r.access_expires_at).toLocaleDateString()}</td>
    </tr>\`).join('');
  } catch(e) { toast(e.message, true); }
}
function closeModal() { document.getElementById('redemptions-modal').classList.remove('open'); }

let allUsers = [];

async function loadUsers() {
  try {
    allUsers = await api('/api/users');
    renderUsers(allUsers);
  } catch(e) { toast(e.message, true); }
}

function filterUsers() {
  const q = document.getElementById('user-search').value.toLowerCase();
  renderUsers(q ? allUsers.filter(u =>
    (u.full_name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  ) : allUsers);
}

function renderUsers(users) {
  const tbody = document.getElementById('users-body');
  if (!users.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No users yet.</td></tr>'; return; }
  tbody.innerHTML = users.map(u => {
    const tier = u.subscription_tier === 'promo'
      ? \`<span class="badge badge-purple">Promo</span>\${u.promo_expires_at ? '<br><span class="stat">until ' + new Date(u.promo_expires_at).toLocaleDateString() + '</span>' : ''}\`
      : '<span class="badge badge-gray">Free</span>';
    return \`<tr>
      <td>\${u.full_name || '—'}</td>
      <td>\${u.email || '—'}</td>
      <td>\${new Date(u.created_at).toLocaleDateString()}</td>
      <td>\${tier}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteUser('\${u.id}','\${esc(u.full_name || u.email)}')">Delete</button></td>
    </tr>\`;
  }).join('');
}

function esc(s) { return (s || '').replace(/'/g, "\\'"); }

async function deleteUser(id, name) {
  if (!confirm('Delete account for ' + name + '? This cannot be undone.')) return;
  try {
    await api('/api/users/' + id, { method: 'DELETE' });
    toast('Deleted ' + name);
    allUsers = allUsers.filter(u => String(u.id) !== String(id));
    filterUsers();
  } catch(e) { toast(e.message, true); }
}

loadCodes();
</script>
</body>
</html>`;
}
