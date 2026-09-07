const assert = require('assert');

process.env.PORT = '3098';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-123';
process.env.RUNNER_SECRET = 'test-runner-secret-123';
process.env.ADMIN_PASSWORD = 'password123';
require('../backend/server.js');

const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:3098').trim();

async function runApiGroupVerification() {
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log('===========================================================');
  console.log('🧪 Verifying All 9 API Endpoint Groups on In-Memory Backend');
  console.log(`Target: ${API_BASE}`);
  console.log('===========================================================\n');

  const results = {};

  // Group 1: /api/auth/*
  console.log('[1/9] Testing /api/auth/* ...');
  const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tiktokbooster.local', password: 'password123' })
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Login must succeed');
  assert(loginData.token, 'Must return JWT token');
  const token = loginData.token;

  const meRes = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meData = await meRes.json();
  assert.strictEqual(meRes.status, 200);
  assert.strictEqual(meData.user.email, 'admin@tiktokbooster.local');
  results['/api/auth/*'] = 'PASSED';
  console.log('  ✓ /api/auth/login and /api/auth/me verified.');

  // Group 2: /api/accounts/*
  console.log('[2/9] Testing /api/accounts/* ...');
  // Create account
  const createAccRes = await fetch(`${API_BASE}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      email: `api_group_test_${Date.now()}@gmail.com`,
      display_name: 'API Group Test Account',
      tiktok_password: 'SecretTikTokPassword1!',
      assigned_runner_key: 'tiktok-live-booster_runner_99'
    })
  });
  const createAccData = await createAccRes.json();
  assert.strictEqual(createAccRes.status, 200);
  assert(createAccData.success);
  const testAccId = createAccData.account.id;

  // List accounts
  const listAccRes = await fetch(`${API_BASE}/api/accounts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listAccData = await listAccRes.json();
  assert.strictEqual(listAccRes.status, 200);
  assert(Array.isArray(listAccData.accounts));
  assert(listAccData.accounts.some(a => a.id === testAccId));

  // Toggle account
  const toggleRes = await fetch(`${API_BASE}/api/accounts/${testAccId}/toggle`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const toggleData = await toggleRes.json();
  assert.strictEqual(toggleRes.status, 200);
  assert.strictEqual(toggleData.is_enabled, false);

  // Bulk import
  const bulkRes = await fetch(`${API_BASE}/api/accounts/bulk-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      raw_text: `bulk_api_test_${Date.now()}@gmail.com,app_pwd_1,tiktok_pwd_1\n# Comment\n`
    })
  });
  const bulkData = await bulkRes.json();
  assert.strictEqual(bulkRes.status, 200);
  assert.strictEqual(bulkData.imported, 1);

  // Delete account
  const delAccRes = await fetch(`${API_BASE}/api/accounts/${testAccId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(delAccRes.status, 200);
  results['/api/accounts/*'] = 'PASSED';
  console.log('  ✓ /api/accounts GET, POST, toggle, bulk-import, DELETE verified.');

  // Group 3: /api/accounts/runner-assignment/*
  console.log('[3/9] Testing /api/accounts/runner-assignment/* ...');
  // Initially unassigned (Guest Mode)
  const unassignedRes = await fetch(`${API_BASE}/api/accounts/runner-assignment/tiktok-live-booster_runner_0`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const unassignedData = await unassignedRes.json();
  assert.strictEqual(unassignedRes.status, 200);
  assert.strictEqual(unassignedData.success, true);
  assert.strictEqual(unassignedData.has_account, false);

  // Create account for runner assignment test
  const createForAssignRes = await fetch(`${API_BASE}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      email: `assign_test_${Date.now()}@gmail.com`,
      display_name: 'Assign Test Account',
      tiktok_password: 'SecretTikTokPassword1!'
    })
  });
  const assignAccData = await createForAssignRes.json();
  const assignAccId = assignAccData.account.id;

  // Explicitly assign account to Runner 0
  const assignRes = await fetch(`${API_BASE}/api/runners/tiktok-live-booster_runner_0/assign-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ account_id: assignAccId })
  });
  const assignData = await assignRes.json();
  assert.strictEqual(assignRes.status, 200);
  assert.strictEqual(assignData.success, true);

  // Now verify assigned account and credentials
  const runnerAssignRes = await fetch(`${API_BASE}/api/accounts/runner-assignment/tiktok-live-booster_runner_0`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const runnerAssignData = await runnerAssignRes.json();
  assert.strictEqual(runnerAssignRes.status, 200);
  assert.strictEqual(runnerAssignData.success, true);
  assert.strictEqual(runnerAssignData.has_account, true);
  assert(runnerAssignData.account.tiktok_password, 'Runner must receive decrypted password');
  results['/api/accounts/runner-assignment/*'] = 'PASSED';
  console.log('  ✓ /api/accounts/runner-assignment/:runnerKey verified.');

  // Group 4: /api/targets/*
  console.log('[4/9] Testing /api/targets/* ...');
  const listTargetsRes = await fetch(`${API_BASE}/api/targets`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listTargetsData = await listTargetsRes.json();
  assert.strictEqual(listTargetsRes.status, 200);
  assert(Array.isArray(listTargetsData.targets));

  // Add target
  const addTargetRes = await fetch(`${API_BASE}/api/targets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      url: 'https://www.tiktok.com/@newcreator/live',
      creator: '@newcreator',
      notes: 'Test target'
    })
  });
  const addTargetData = await addTargetRes.json();
  assert.strictEqual(addTargetRes.status, 200);
  assert(addTargetData.success);
  const targetId = addTargetData.target.id;

  // Activate target
  const activateRes = await fetch(`${API_BASE}/api/targets/${targetId}/activate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  });
  const activateData = await activateRes.json();
  assert.strictEqual(activateRes.status, 200);
  assert.strictEqual(activateData.target.is_active_target, true);
  results['/api/targets/*'] = 'PASSED';
  console.log('  ✓ /api/targets GET, POST, activate verified.');

  // Group 5: /api/fleet/*
  console.log('[5/9] Testing /api/fleet/* ...');
  const createFleetRes = await fetch(`${API_BASE}/api/fleet`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      name: 'Alpha Test Fleet',
      repo_prefix: 'booster-alpha',
      repo_count: 3,
      target_url: 'https://www.tiktok.com/@touqeernasir000',
      duration_minutes: 30,
      likes_per_minute: 120
    })
  });
  const createFleetData = await createFleetRes.json();
  assert.strictEqual(createFleetRes.status, 200);
  assert(createFleetData.success);
  const fleetId = createFleetData.fleet.id;

  const listFleetRes = await fetch(`${API_BASE}/api/fleet`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listFleetData = await listFleetRes.json();
  assert.strictEqual(listFleetRes.status, 200);
  assert(Array.isArray(listFleetData.fleets));
  assert(listFleetData.fleets.some(f => f.id === fleetId));
  results['/api/fleet/*'] = 'PASSED';
  console.log('  ✓ /api/fleet GET, POST verified.');

  // Group 6: /api/runners/*
  console.log('[6/9] Testing /api/runners/* ...');
  const runnerKey = 'tiktok-live-booster_runner_0';
  const postStatusRes = await fetch(`${API_BASE}/api/runners/${runnerKey}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'STREAMING',
      details: 'Watching live stream',
      likes_sent: 150,
      current_state: 'STREAMING',
      timestamp: new Date().toISOString()
    })
  });
  const postStatusData = await postStatusRes.json();
  assert.strictEqual(postStatusRes.status, 200);
  assert.strictEqual(postStatusData.success, true);

  const getRunnersRes = await fetch(`${API_BASE}/api/runners`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const getRunnersData = await getRunnersRes.json();
  assert.strictEqual(getRunnersRes.status, 200);

  const getTransRes = await fetch(`${API_BASE}/api/runners/${runnerKey}/transitions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const getTransData = await getTransRes.json();
  assert.strictEqual(getTransRes.status, 200);
  assert(Array.isArray(getTransData.transitions));
  results['/api/runners/*'] = 'PASSED';
  console.log('  ✓ /api/runners GET, /status POST, /transitions GET verified.');

  // Group 7: /api/telemetry/*
  console.log('[7/9] Testing /api/telemetry/* ...');
  const postHeartbeatRes = await fetch(`${API_BASE}/api/telemetry/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runner_id: 0,
      runner_key: 'tiktok-live-booster_runner_0',
      likes_sent: 250,
      fps: 30,
      cpu_usage: 12,
      memory_usage: 45,
      is_streaming: true,
      current_state: 'STREAMING'
    })
  });
  const postHbData = await postHeartbeatRes.json();
  assert.strictEqual(postHeartbeatRes.status, 200);
  assert.strictEqual(postHbData.success, true);

  const getTelemRes = await fetch(`${API_BASE}/api/telemetry/latest`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const getTelemData = await getTelemRes.json();
  assert.strictEqual(getTelemRes.status, 200);
  assert(getTelemData.telemetry);
  results['/api/telemetry/*'] = 'PASSED';
  console.log('  ✓ /api/telemetry/heartbeat and /latest verified.');

  // Group 8: /api/repositories/*
  console.log('[8/9] Testing /api/repositories/* ...');
  const listReposRes = await fetch(`${API_BASE}/api/repositories`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listReposData = await listReposRes.json();
  assert.strictEqual(listReposRes.status, 200);
  assert(Array.isArray(listReposData.repositories));
  results['/api/repositories/*'] = 'PASSED';
  console.log('  ✓ /api/repositories GET verified.');

  // Group 9: /api/github-accounts/*
  console.log('[9/9] Testing /api/github-accounts/* ...');
  const listGhRes = await fetch(`${API_BASE}/api/github-accounts`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const listGhData = await listGhRes.json();
  assert.strictEqual(listGhRes.status, 200);
  assert(Array.isArray(listGhData.accounts));

  const addGhRes = await fetch(`${API_BASE}/api/github-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      label: 'Secondary Cluster',
      owner: 'test-org',
      repo: 'test-booster',
      token: 'sample_fake_token_1234567890',
      max_runners: 5
    })
  });
  const addGhData = await addGhRes.json();
  assert.strictEqual(addGhRes.status, 200);
  assert(addGhData.success);
  results['/api/github-accounts/*'] = 'PASSED';
  console.log('  ✓ /api/github-accounts GET, POST verified.');

  console.log('\n===========================================================');
  console.log('🎉 ALL 9 ENDPOINT GROUPS SUCCESSFULLY EXERCISED & VERIFIED!');
  console.log('===========================================================');
  console.table(results);
  process.exit(0);
}

runApiGroupVerification().catch(err => {
  console.error('[-] API Group verification failed:', err);
  process.exit(1);
});
