const assert = require('assert');

async function testFgosFleetUpgrades() {
  process.env.PORT = '3099';
  process.env.NODE_ENV = 'test';
  const { app, store, runnerTelemetryMap } = require('../backend/server');

  const server = app.listen(3099);
  const BASE_URL = 'http://127.0.0.1:3099';

  console.log('Testing FGOS fleet upgrades on', BASE_URL);

  try {
    // 1. Test Heartbeat response delivering target_stream_url
    console.log('[1/3] Testing Dynamic Target Delivery in /api/telemetry/heartbeat ...');
    store.liveTargets.forEach(t => { t.is_active_target = false; });
    store.liveTargets.unshift({
      id: 999,
      url: 'https://www.tiktok.com/@testcreator/live',
      creator: '@testcreator',
      is_active_target: true,
      is_enabled: true,
      likes_per_minute: 240
    });

    const hbRes = await fetch(`${BASE_URL}/api/telemetry/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        runner_id: 0,
        runner_key: 'tiktok-live-booster_runner_0',
        repo: 'test-owner/tiktok-live-booster',
        status: 'RUNNING',
        likes_sent: 50
      })
    });
    const hbData = await hbRes.json();
    assert.strictEqual(hbRes.status, 200);
    assert.strictEqual(hbData.success, true);
    assert.strictEqual(hbData.target_stream_url, 'https://www.tiktok.com/@testcreator/live');
    assert.strictEqual(hbData.likes_per_minute, 240);
    console.log('  ✓ Heartbeat correctly returns active live stream target & likes rate');

    // 2. Test /api/runners/workflow-done endpoint
    console.log('[2/3] Testing /api/runners/workflow-done teardown hook ...');
    store.repositories.push({
      id: 888,
      owner: 'test-owner',
      repo: 'tiktok-live-booster',
      status: 'RUNNING',
      dispatch_status: 'DISPATCHED'
    });

    const doneRes = await fetch(`${BASE_URL}/api/runners/workflow-done`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repo_name: 'test-owner/tiktok-live-booster',
        run_id: 12345678,
        status: 'success',
        runner_index: 0
      })
    });
    const doneData = await doneRes.json();
    assert.strictEqual(doneRes.status, 200);
    assert.strictEqual(doneData.success, true);
    assert.strictEqual(doneData.final_state, 'COMPLETED');
    assert.strictEqual(doneData.repo_status, 'COMPLETED');

    const repoAfter = store.repositories.find(r => r.id === 888);
    assert.strictEqual(repoAfter.status, 'COMPLETED');
    assert.strictEqual(runnerTelemetryMap['tiktok-live-booster_runner_0'].state, 'COMPLETED');
    console.log('  ✓ Teardown hook immediately frees repository and transitions runner to COMPLETED');

    // 3. Test Pre-Flight Billing Lock / Suspended Account Shield
    console.log('[3/3] Testing Pre-Flight Account Shield in /api/runners/dispatch ...');
    store.githubAccounts.push({
      id: 777,
      owner: 'locked-user',
      repo: 'tiktok-live-booster',
      label: 'Locked Account',
      token: 'fake_token_1234567890',
      is_active: true,
      status: 'SUSPENDED',
      error_message: 'The job was not started because your account is locked due to a billing issue on GitHub.',
      max_runners: 1
    });

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nadeemdepal27@gmail.com', password: 'Zain.rty123' })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    const dispatchRes = await fetch(`${BASE_URL}/api/runners/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        stream_url: 'https://www.tiktok.com/@tiktok/live',
        runner_count: 1
      })
    });
    const dispatchData = await dispatchRes.json();
    assert.strictEqual(dispatchRes.status, 200);
    const lockedResult = dispatchData.results.find(r => r.account === 'Locked Account');
    assert(lockedResult, 'Locked account should be evaluated in dispatch results');
    assert.strictEqual(lockedResult.dispatched, false);
    assert.strictEqual(lockedResult.skipped, true);
    assert(lockedResult.reason.includes('billing lock or suspension'));

    const lockedAcc = store.githubAccounts.find(a => a.id === 777);
    assert.strictEqual(lockedAcc.is_active, false);
    console.log('  ✓ Pre-flight shield skipped locked account and auto-disabled it');

    console.log('\n🎉 ALL FGOS FLEET UPGRADE TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } finally {
    server.close();
  }
}

testFgosFleetUpgrades().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
