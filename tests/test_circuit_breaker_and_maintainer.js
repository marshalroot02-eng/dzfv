const http = require('http');

async function runTests() {
  const BASE_URL = process.env.TEST_BACKEND_URL || 'http://localhost:3005';
  console.log(`[TEST] Running Circuit Breaker, Fleet Settings & Step Log Tests against ${BASE_URL} ...`);

  let token = null;

  // 1. Login as Admin to obtain JWT
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nadeemdepal27@gmail.com', password: 'Zain.rty123' })
    });
    const loginData = await loginRes.json();
    if (loginData.success && loginData.token) {
      token = loginData.token;
      console.log('✅ Admin login succeeded');
    } else {
      throw new Error(`Login failed: ${loginData.error}`);
    }
  } catch (e) {
    console.error('❌ Failed to login:', e.message);
    process.exit(1);
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Test Fleet Settings GET and POST
  console.log('\n[2] Testing GET /api/fleet/settings ...');
  const getFleetRes = await fetch(`${BASE_URL}/api/fleet/settings`, { headers: authHeaders });
  const getFleetData = await getFleetRes.json();
  if (getFleetData.success && getFleetData.settings) {
    console.log(`✅ Fleet settings retrieved: target_runners=${getFleetData.settings.target_runners}, auto_maintain=${getFleetData.settings.auto_maintain}`);
  } else {
    console.error('❌ Failed to get fleet settings:', getFleetData);
    process.exit(1);
  }

  console.log('\n[3] Testing POST /api/fleet/settings (Updating target_runners=3, auto_maintain=false) ...');
  const postFleetRes = await fetch(`${BASE_URL}/api/fleet/settings`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ target_runners: 3, auto_maintain: false })
  });
  const postFleetData = await postFleetRes.json();
  if (postFleetData.success && postFleetData.settings?.target_runners === 3) {
    console.log('✅ Fleet settings updated successfully');
  } else {
    console.error('❌ Failed to update fleet settings:', postFleetData);
    process.exit(1);
  }

  // 3. Test Account Cooldown Trigger
  const accsRes = await fetch(`${BASE_URL}/api/accounts`, { headers: authHeaders });
  const accsData = await accsRes.json();
  const testAcc = accsData.accounts?.find(a => a.is_enabled) || accsData.accounts?.[0] || { id: 2 };
  console.log(`\n[4] Testing POST /api/accounts/${testAcc.id}/cooldown (${testAcc.email}) ...`);
  const cdRes = await fetch(`${BASE_URL}/api/accounts/${testAcc.id}/cooldown`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ reason: 'Test IP rate limit (Maximum attempts reached)', duration_minutes: 15 })
  });
  const cdData = await cdRes.json();
  if (cdData.success && cdData.rate_limited_until) {
    console.log(`✅ Account #${testAcc.id} placed in cooldown until ${cdData.rate_limited_until}`);
  } else {
    console.error('❌ Failed to set cooldown:', cdData);
    process.exit(1);
  }

  // 4. Test Runner Assignment with Account in Cooldown
  console.log(`\n[5] Testing runner assignment when account #${testAcc.id} is in cooldown (checking Guest fallback) ...`);
  await fetch(`${BASE_URL}/api/runners/tiktok-live-booster_runner_99/assign-account`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ account_id: testAcc.id })
  });

  const assignRes = await fetch(`${BASE_URL}/api/accounts/runner-assignment/tiktok-live-booster_runner_99`, {
    headers: authHeaders
  });
  const assignData = await assignRes.json();
  if (assignData.success && assignData.in_cooldown && assignData.has_account === false) {
    console.log(`✅ Cooldown safety verified: Runner #99 assigned to cooling account correctly fell back to Guest mode (${assignData.cooldown_remaining_seconds}s remaining)`);
  } else {
    console.error('❌ Expected runner to fall back to guest mode during cooldown:', assignData);
    process.exit(1);
  }

  // 5. Test Clear Cooldown
  console.log(`\n[6] Testing POST /api/accounts/${testAcc.id}/clear-cooldown ...`);
  const clearRes = await fetch(`${BASE_URL}/api/accounts/${testAcc.id}/clear-cooldown`, {
    method: 'POST',
    headers: authHeaders
  });
  const clearData = await clearRes.json();
  if (clearData.success) {
    console.log(`✅ Cooldown cleared for account #${testAcc.id}`);
  } else {
    console.error('❌ Failed to clear cooldown:', clearData);
    process.exit(1);
  }

  // 6. Test Heartbeat with Step Logs
  console.log('\n[7] Testing POST /api/telemetry/heartbeat with recent_logs ...');
  const hbRes = await fetch(`${BASE_URL}/api/telemetry/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      runner_id: 99,
      runner_key: 'tiktok-live-booster_runner_99',
      session_uuid: 'session_test_circuit_breaker',
      state: 'RUNNING',
      recent_logs: [
        { timestamp: '12:00:01', step: 'ADB', message: 'Connected to AVD', level: 'INFO' },
        { timestamp: '12:00:05', step: 'AUTH', message: 'Logged in successfully', level: 'INFO' },
        { timestamp: '12:00:10', step: 'LIKES', message: 'Sent 50 likes', level: 'INFO' }
      ]
    })
  });
  const hbData = await hbRes.json();
  if (hbData.success) {
    console.log('✅ Heartbeat with recent_logs accepted');
  } else {
    console.error('❌ Heartbeat failed:', hbData);
    process.exit(1);
  }

  // 7. Verify Telemetry Live output contains recent_logs
  console.log('\n[8] Testing GET /api/telemetry/live to verify recent_logs in runner telemetry ...');
  const liveRes = await fetch(`${BASE_URL}/api/telemetry/live`, { headers: authHeaders });
  const liveData = await liveRes.json();
  const runner99 = liveData.telemetry?.find(t => t.runner_key === 'tiktok-live-booster_runner_99');
  if (runner99 && Array.isArray(runner99.recent_logs) && runner99.recent_logs.length === 3) {
    console.log(`✅ Live telemetry verified: Runner #99 has ${runner99.recent_logs.length} step logs`);
  } else {
    console.error('❌ Runner #99 missing recent_logs in live telemetry:', runner99);
    process.exit(1);
  }

  console.log('\n🎉 ALL CIRCUIT BREAKER, FLEET SETTINGS & STEP LOG TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
