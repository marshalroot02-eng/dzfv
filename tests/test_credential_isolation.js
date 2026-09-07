const assert = require('assert');

process.env.PORT = '3097';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-123';
process.env.RUNNER_SECRET = 'test-runner-secret-123';
process.env.ADMIN_PASSWORD = 'password123';
require('../backend/server.js');

const API_BASE = 'http://127.0.0.1:3097';

async function testIsolation() {
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log('--- Testing Account & Credential Isolation Across Runners ---');

  // Authenticate as Admin
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tiktokbooster.local', password: 'password123' })
  });
  const loginData = await loginRes.json();
  assert(loginData.token, 'Must receive authentication token');
  const token = loginData.token;

  // Provision / ensure isolated accounts for 3 runners via API
  const testAccounts = [
    {
      email: 'runner0_account@fgos.site',
      display_name: 'Test Account #0',
      tiktok_password: 'TikTokSecurePass2026!',
      assigned_runner_key: 'tiktok-live-booster_runner_0'
    },
    {
      email: 'runner1_account@fgos.site',
      display_name: 'Test Account #1',
      tiktok_password: 'TikTokSecurePass2026!',
      assigned_runner_key: 'tiktok-live-booster_runner_1'
    },
    {
      email: 'runner2_account@fgos.site',
      display_name: 'Test Account #2',
      tiktok_password: 'TikTokSecurePass2026!',
      assigned_runner_key: 'tiktok-live-booster_runner_2'
    }
  ];

  for (const acc of testAccounts) {
    await fetch(`${API_BASE}/api/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(acc)
    });
  }

  // 1. Fetch for Runner 0
  const r0Res = await fetch(`${API_BASE}/api/accounts/runner-assignment/tiktok-live-booster_runner_0?token=${token}`);
  const r0Data = await r0Res.json();
  console.log('[+] Runner 0 Assignment:', r0Data.account?.username, '| ID:', r0Data.account?.id);
  assert.strictEqual(r0Data.account?.username, 'runner0_account@fgos.site');
  assert.strictEqual(r0Data.account?.password, 'TikTokSecurePass2026!');

  // 2. Fetch for Runner 1
  const r1Res = await fetch(`${API_BASE}/api/accounts/runner-assignment/tiktok-live-booster_runner_1?token=${token}`);
  const r1Data = await r1Res.json();
  console.log('[+] Runner 1 Assignment:', r1Data.account?.username, '| ID:', r1Data.account?.id);
  assert.strictEqual(r1Data.account?.username, 'runner1_account@fgos.site');
  assert.strictEqual(r1Data.account?.password, 'TikTokSecurePass2026!');

  // 3. Fetch for Runner 2
  const r2Res = await fetch(`${API_BASE}/api/accounts/runner-assignment/tiktok-live-booster_runner_2?token=${token}`);
  const r2Data = await r2Res.json();
  console.log('[+] Runner 2 Assignment:', r2Data.account?.username, '| ID:', r2Data.account?.id);
  assert.strictEqual(r2Data.account?.username, 'runner2_account@fgos.site');
  assert.strictEqual(r2Data.account?.password, 'TikTokSecurePass2026!');

  console.log('[✓] ZERO CROSSOVER: All 3 runners received strictly their own isolated account!');
  process.exit(0);
}

testIsolation().catch(err => {
  console.error('[-] Test failed:', err);
  process.exit(1);
});
