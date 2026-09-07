const assert = require('assert');

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3097').trim();
const PHASE = process.env.TEST_PHASE || '1';

async function main() {
  // Login
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tiktokbooster.local', password: 'password123' })
  });
  const { token } = await loginRes.json();
  assert(token, 'Must receive auth token');

  if (PHASE === '1') {
    console.log('--- RESTART/VOLATILITY TEST [PHASE 1: BEFORE RESTART] ---');
    // Verify default seed exists
    const listRes1 = await fetch(`${API_BASE}/api/accounts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(list1.accounts.length, 0, 'Initial accounts must be empty without static seed');
    console.log('[+] Step 1: Clean in-memory start verified (zero hardcoded seeds).');

    // Create temporary runtime account
    const createRes = await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        email: 'volatile_account_999@test.com',
        display_name: 'Volatile Runtime Account',
        tiktok_password: 'VolatilePass2026!'
      })
    });
    const createData = await createRes.json();
    assert(createData.success, 'Temporary account must be created');
    console.log('[+] Step 2: Temporary runtime account created (ID:', createData.account.id, ').');

    // Verify it exists through API
    const listRes2 = await fetch(`${API_BASE}/api/accounts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const list2 = await listRes2.json();
    const found = list2.accounts.find(a => a.email === 'volatile_account_999@test.com');
    assert(found, 'Temporary account must exist in runtime store');
    console.log('[+] Step 3: Verified temporary account exists through GET /api/accounts.');
    console.log('[PHASE 1 PASSED] Ready for backend restart.');

  } else if (PHASE === '2') {
    console.log('--- RESTART/VOLATILITY TEST [PHASE 2: AFTER RESTART] ---');
    // Verify temporary object is GONE
    const listRes = await fetch(`${API_BASE}/api/accounts`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const list = await listRes.json();
    const found = list.accounts.find(a => a.email === 'volatile_account_999@test.com');
    assert.strictEqual(found, undefined, 'Temporary account MUST BE GONE after restart (no persistent storage)');
    console.log('[+] Step 4: Verified temporary account is completely GONE from memory.');

    // Verify in-memory store starts clean without hardcoded seed accounts
    assert.strictEqual(list.accounts.length, 0, 'No hardcoded seed accounts should exist after restart');
    console.log('[+] Step 5: Verified clean zero-seed in-memory state.');

    console.log('\n[PHASE 2 PASSED] Restart volatility and clean in-memory state verified 100%!');
  }
}

main().catch(err => {
  console.error('[-] Test failed:', err);
  process.exit(1);
});
