const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require('../backend/node_modules/ws');
const jwt = require('../backend/node_modules/jsonwebtoken');

const TEST_PORT = 3108;
const API_BASE = `http://127.0.0.1:${TEST_PORT}`;
const WS_BASE = `ws://127.0.0.1:${TEST_PORT}`;
const TEST_RUNNER_SECRET = 'test_runner_secret_val_12345';
const TEST_JWT_SECRET = 'test_jwt_secret_val_12345';

let serverProcess = null;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startServer() {
  return new Promise((resolve, reject) => {
    serverProcess = spawn('node', ['backend/server.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        NODE_ENV: 'test',
        JWT_SECRET: TEST_JWT_SECRET,
        RUNNER_SECRET: TEST_RUNNER_SECRET,
        ENCRYPTION_SECRET: 'test_encryption_secret_12345',
        ENCRYPTION_SALT: '0123456789abcdef0123456789abcdef',
        ADMIN_EMAIL: 'admin@tiktokbooster.local',
        ADMIN_PASSWORD: 'CorrectAdminPassword2026!'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', data => {
      const msg = data.toString();
      if (msg.includes('TikTok Booster Fleet Engine running') || msg.includes('PORT')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', data => {
      // ignore debug logs
    });

    serverProcess.on('error', reject);
    serverProcess.on('exit', code => {
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited early with code ${code}`));
      }
    });

    // Fallback timer
    setTimeout(resolve, 2500);
  });
}

function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

async function runAllAuditTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING COMPREHENSIVE AUDIT FIXES VERIFICATION');
  console.log(`Backend Target: ${API_BASE}`);
  console.log('====================================================\n');

  await startServer();
  await wait(1000);

  let adminToken = '';

  // ─────────────────────────────────────────────────────────────
  // 1. CRITICAL: FIX AUTHENTICATION BYPASS
  // ─────────────────────────────────────────────────────────────
  console.log('[1/7] Verifying Authentication & Bypass Elimination...');

  // 1.1 Valid credentials succeed
  const validRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tiktokbooster.local', password: 'CorrectAdminPassword2026!' })
  });
  assert.strictEqual(validRes.status, 200, 'Valid credentials must succeed with 200');
  const validData = await validRes.json();
  assert(validData.success, 'Login response must report success');
  assert(validData.token, 'Must return JWT token');
  adminToken = validData.token;
  console.log('  ✓ Valid credentials succeed and return token');

  // 1.2 Invalid password fails
  const invalidPassRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tiktokbooster.local', password: 'WrongPassword999!' })
  });
  assert.strictEqual(invalidPassRes.status, 401, 'Invalid password must return 401');
  const invalidPassData = await invalidPassRes.json();
  assert.strictEqual(invalidPassData.success, false);
  console.log('  ✓ Invalid password rejected with 401');

  // 1.3 Nonexistent user fails
  const nonexistentRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'unknown_person_999@domain.org', password: 'anyPassword' })
  });
  assert.strictEqual(nonexistentRes.status, 401, 'Nonexistent user must return 401');
  console.log('  ✓ Nonexistent user rejected with 401');

  // 1.4 Email containing "admin" does NOT bypass authentication
  const adminBypassRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fakeadmin@attacker.com', password: 'whatever' })
  });
  assert.strictEqual(adminBypassRes.status, 401, 'Email containing admin must NOT bypass auth');
  console.log('  ✓ Email containing "admin" rejected (no substring bypass)');

  // 1.5 Email containing "nadeem" does NOT bypass authentication
  const nadeemBypassRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nadeemdepal27@gmail.com', password: 'wrong' })
  });
  assert.strictEqual(nadeemBypassRes.status, 401, 'Email containing nadeem must NOT bypass auth');
  console.log('  ✓ Email containing "nadeem" rejected (no substring bypass)');

  // 1.6 Missing email or password returns 400
  const missingEmailRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'password' })
  });
  assert.strictEqual(missingEmailRes.status, 400, 'Missing email must return 400');
  const missingPassRes = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tiktokbooster.local' })
  });
  assert.strictEqual(missingPassRes.status, 400, 'Missing password must return 400');
  console.log('  ✓ Missing email or password rejected with 400');

  // ─────────────────────────────────────────────────────────────
  // 2. CRITICAL: RUNNER WEBSOCKET AUTHENTICATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n[2/7] Verifying Runner WebSocket Authentication...');

  // Helper to test WS connection closure
  function testRunnerWsConnection(query) {
    return new Promise((resolve) => {
      const ws = new WebSocket(`${WS_BASE}/ws/stream?role=runner&${query}`);
      let timer = null;
      ws.on('open', () => {
        timer = setTimeout(() => {
          ws.close();
          resolve({ success: true, code: null });
        }, 100);
      });
      ws.on('close', (code, reason) => {
        if (timer) clearTimeout(timer);
        resolve({ success: false, code, reason: reason.toString() });
      });
      ws.on('error', () => {
        // Will close
      });
    });
  }

  // 2.1 Missing token => reject
  const resNoToken = await testRunnerWsConnection('runner_key=tiktok-live-booster_runner_0');
  assert.strictEqual(resNoToken.success, false, 'Missing token must be rejected');
  assert.strictEqual(resNoToken.code, 4001, 'Close code must be 4001 (auth required)');
  console.log('  ✓ Missing runner token rejected with close code 4001');

  // 2.2 Invalid token => reject
  const resInvalidToken = await testRunnerWsConnection('runner_key=tiktok-live-booster_runner_0&token=invalid_secret_xyz');
  assert.strictEqual(resInvalidToken.success, false, 'Invalid token must be rejected');
  assert.strictEqual(resInvalidToken.code, 4003, 'Close code must be 4003 (forbidden)');
  console.log('  ✓ Invalid runner token rejected with close code 4003');

  // 2.3 Fallback token "runner_token" => reject
  const resFallbackToken = await testRunnerWsConnection('runner_key=tiktok-live-booster_runner_0&token=runner_token');
  assert.strictEqual(resFallbackToken.success, false, 'Literal runner_token fallback must be rejected');
  console.log('  ✓ Literal "runner_token" fallback rejected');

  // 2.4 Valid token => connect normally
  const resValidToken = await testRunnerWsConnection(`runner_key=tiktok-live-booster_runner_0&token=${TEST_RUNNER_SECRET}`);
  assert.strictEqual(resValidToken.success, true, 'Valid token must connect successfully');
  console.log('  ✓ Valid RUNNER_SECRET authenticated runner socket successfully');

  // 2.5 Attempting to connect as Runner 1 while authenticated for another runner via JWT
  const runner0Jwt = jwt.sign({ role: 'runner', runnerKey: 'tiktok-live-booster_runner_0' }, TEST_JWT_SECRET, { expiresIn: '1h' });
  const resMismatchedRunner = await testRunnerWsConnection(`runner_key=tiktok-live-booster_runner_1&token=${runner0Jwt}`);
  assert.strictEqual(resMismatchedRunner.success, false, 'Token for Runner 0 must not connect as Runner 1');
  assert.strictEqual(resMismatchedRunner.code, 4003, 'Cross-runner socket identity rejected with 4003');
  console.log('  ✓ Cross-runner identity mismatch rejected with code 4003');

  // 2.6 Duplicate/replacement socket replaces cleanly
  const ws1 = new WebSocket(`${WS_BASE}/ws/stream?role=runner&runner_key=tiktok-live-booster_runner_0&token=${TEST_RUNNER_SECRET}`);
  await new Promise(r => ws1.on('open', r));
  let ws1ClosedCode = null;
  ws1.on('close', code => { ws1ClosedCode = code; });

  const ws2 = new WebSocket(`${WS_BASE}/ws/stream?role=runner&runner_key=tiktok-live-booster_runner_0&token=${TEST_RUNNER_SECRET}`);
  await new Promise(r => ws2.on('open', r));
  await wait(100);
  assert.strictEqual(ws1ClosedCode, 4002, 'Old socket replaced with close code 4002');
  ws2.close();
  console.log('  ✓ Duplicate runner socket replaces stale connection cleanly with code 4002');

  // ─────────────────────────────────────────────────────────────
  // 3. HIGH: DASHBOARD WEBSOCKET AUTHENTICATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n[3/7] Verifying Dashboard WebSocket Authentication...');

  function testDashboardWs(tokenParam) {
    return new Promise((resolve) => {
      const url = tokenParam !== undefined
        ? `${WS_BASE}/ws/stream?role=dashboard&token=${tokenParam}`
        : `${WS_BASE}/ws/stream?role=dashboard`;
      const ws = new WebSocket(url);
      let firstMsg = null;
      ws.on('message', data => {
        if (!firstMsg) {
          firstMsg = JSON.parse(data.toString());
          ws.close();
          resolve({ success: true, firstMsg });
        }
      });
      ws.on('close', (code, reason) => {
        resolve({ success: Boolean(firstMsg), code, reason: reason.toString(), firstMsg });
      });
      ws.on('error', () => {});
    });
  }

  // 3.1 Missing token => reject
  const dbNoToken = await testDashboardWs();
  assert.strictEqual(dbNoToken.success, false, 'Missing JWT must be rejected');
  assert.strictEqual(dbNoToken.code, 4001, 'Close code must be 4001');
  console.log('  ✓ Missing dashboard JWT rejected with code 4001');

  // 3.2 Invalid token => reject
  const dbInvalidToken = await testDashboardWs('invalid.jwt.token');
  assert.strictEqual(dbInvalidToken.success, false, 'Invalid JWT must be rejected');
  assert.strictEqual(dbInvalidToken.code, 4001, 'Close code must be 4001');
  console.log('  ✓ Invalid dashboard JWT rejected with code 4001');

  // 3.3 Valid JWT => connects and receives TELEMETRY_SYNC
  const dbValidToken = await testDashboardWs(adminToken);
  assert.strictEqual(dbValidToken.success, true, 'Valid JWT must connect to dashboard WS');
  assert(dbValidToken.firstMsg, 'Must receive initial sync message');
  assert.strictEqual(dbValidToken.firstMsg.type, 'TELEMETRY_SYNC');
  console.log('  ✓ Valid JWT connects to dashboard WS and receives TELEMETRY_SYNC');

  // ─────────────────────────────────────────────────────────────
  // 4. CRITICAL: EMPTY RUNNER CANCEL MUST NEVER CANCEL EVERYTHING
  // ─────────────────────────────────────────────────────────────
  console.log('\n[4/7] Verifying Runner Cancellation Safety...');

  // Set up test runners in runnerTelemetryMap
  await fetch(`${API_BASE}/telemetry/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': TEST_RUNNER_SECRET },
    body: JSON.stringify({ runner_key: 'tiktok-live-booster_runner_0', runner_id: 0, state: 'RUNNING' })
  });
  await fetch(`${API_BASE}/telemetry/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': TEST_RUNNER_SECRET },
    body: JSON.stringify({ runner_key: 'tiktok-live-booster_runner_1', runner_id: 1, state: 'RUNNING' })
  });

  // 4.1 Empty runner_keys array => safe no-op, 0 affected
  const emptyCancelRes = await fetch(`${API_BASE}/api/runners/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ runner_keys: [] })
  });
  const emptyCancelData = await emptyCancelRes.json();
  assert.strictEqual(emptyCancelRes.status, 200);
  assert.strictEqual(emptyCancelData.cancelled_count, 0, 'Empty runner_keys must be a safe no-op');
  console.log('  ✓ runner_keys: [] is safe no-op (cancelled_count: 0)');

  // Verify Runner 0 and 1 are still alive
  const diag0Res = await fetch(`${API_BASE}/api/runners/0/diagnostics`);
  const diag0Data = await diag0Res.json();
  const diag1Res = await fetch(`${API_BASE}/api/runners/1/diagnostics`);
  const diag1Data = await diag1Res.json();
  assert.strictEqual(diag0Data.diagnostics.status, 'RUNNING', 'Runner 0 must NOT be cancelled');
  assert.strictEqual(diag1Data.diagnostics.status, 'RUNNING', 'Runner 1 must NOT be cancelled');
  console.log('  ✓ Active runners untouched after empty cancellation');

  // 4.2 Nonexistent runner => no real runners affected
  const nonExistCancel = await fetch(`${API_BASE}/api/runners/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ runner_keys: ['tiktok-live-booster_runner_99'] })
  });
  assert.strictEqual(nonExistCancel.status, 200);
  const nonExistData = await nonExistCancel.json();
  assert(nonExistData.success);

  const diag0Check = await (await fetch(`${API_BASE}/api/runners/0/diagnostics`)).json();
  const diag1Check = await (await fetch(`${API_BASE}/api/runners/1/diagnostics`)).json();
  assert.strictEqual(diag0Check.diagnostics.status, 'RUNNING', 'Runner 0 must not be affected');
  assert.strictEqual(diag1Check.diagnostics.status, 'RUNNING', 'Runner 1 must not be affected');
  console.log('  ✓ Nonexistent runner cancel leaves real runners untouched');

  // 4.3 Cancel Runner 0 only => Runner 1 untouched
  const r0Cancel = await fetch(`${API_BASE}/api/runners/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ runner_keys: ['tiktok-live-booster_runner_0'] })
  });
  const r0CancelData = await r0Cancel.json();
  assert.strictEqual(r0CancelData.cancelled_count, 1);

  const diag0AfterRes = await fetch(`${API_BASE}/api/runners/0/diagnostics`);
  const diag0AfterData = await diag0AfterRes.json();
  const diag1AfterRes = await fetch(`${API_BASE}/api/runners/1/diagnostics`);
  const diag1AfterData = await diag1AfterRes.json();
  assert.strictEqual(diag0AfterData.diagnostics.status, 'STOPPED', 'Runner 0 must be STOPPED');
  assert.strictEqual(diag1AfterData.diagnostics.status, 'RUNNING', 'Runner 1 must remain RUNNING');
  console.log('  ✓ Targeted cancel of Runner 0 leaves Runner 1 RUNNING');

  // ─────────────────────────────────────────────────────────────
  // 5. HIGH: STRICT RUNNER ID VALIDATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n[5/7] Verifying Strict Runner ID Validation...');

  const invalidIds = ['-1', 'abc', 'runner_1', '1abc', '25', '9999', '%20', 'undefined', 'null'];
  for (const inv of invalidIds) {
    const res = await fetch(`${API_BASE}/api/runners/${inv}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400, `Runner ID '${inv}' must return 400, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert(data.error.toLowerCase().includes('runner id'), `Error message must explain validation: ${data.error}`);
  }
  console.log('  ✓ Malformed and out-of-range runner IDs (-1, abc, runner_1, 1abc, 25, 9999) rejected with 400');

  // Valid IDs: 0, 1, 10
  const validIds = [0, 1, 10];
  for (const val of validIds) {
    const res = await fetch(`${API_BASE}/api/runners/${val}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 200, `Valid runner ID '${val}' must return 200`);
  }
  console.log('  ✓ Valid runner IDs (0, 1, 10) accepted with 200');

  // ─────────────────────────────────────────────────────────────
  // 6. MEDIUM: COMMAND ACK ROUTE CANONICALIZATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n[6/7] Verifying Canonical Command ACK Route...');

  // 6.1 Queue a legitimate command for Runner 0
  const controlRes = await fetch(`${API_BASE}/api/runners/0/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'PAUSE', stream_url: 'https://tiktok.com' })
  });
  const controlData = await controlRes.json();
  const legitimateCmdId = controlData.command.id;

  // 6.2 Test successful ACK on canonical route
  const ackRes = await fetch(`${API_BASE}/api/runners/tiktok-live-booster_runner_0/commands/${legitimateCmdId}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': TEST_RUNNER_SECRET },
    body: JSON.stringify({ success: true, status: 'EXECUTED' })
  });
  assert.strictEqual(ackRes.status, 200, 'Canonical ACK route must return 200');
  const ackData = await ackRes.json();
  assert.strictEqual(ackData.success, true);
  assert.strictEqual(ackData.command_id, legitimateCmdId);
  assert.strictEqual(ackData.status, 'EXECUTED');
  console.log('  ✓ Canonical route /api/runners/:runnerKey/commands/:cmdId/ack executed successfully');

  // 6.3 Test failed ACK with error info preserved
  const controlRes2 = await fetch(`${API_BASE}/api/runners/0/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ action: 'STOP' })
  });
  const controlData2 = await controlRes2.json();
  const failedCmdId = controlData2.command.id;

  const ackFailedRes = await fetch(`${API_BASE}/api/runners/tiktok-live-booster_runner_0/commands/${failedCmdId}/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': TEST_RUNNER_SECRET },
    body: JSON.stringify({ success: false, status: 'FAILED', error: 'ADB connection lost' })
  });
  assert.strictEqual(ackFailedRes.status, 200);
  const ackFailedData = await ackFailedRes.json();
  assert.strictEqual(ackFailedData.status, 'FAILED');
  assert.strictEqual(ackFailedData.error, 'ADB connection lost');
  console.log('  ✓ Failed ACK preserves command status and error info');

  // 6.4 Test nonexistent command => 404
  const nonExistAck = await fetch(`${API_BASE}/api/runners/tiktok-live-booster_runner_0/commands/99999999/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': TEST_RUNNER_SECRET },
    body: JSON.stringify({ success: true })
  });
  assert.strictEqual(nonExistAck.status, 404, 'Nonexistent command must return 404');
  console.log('  ✓ Nonexistent command ACK returns 404');

  // 6.5 Malformed command ID => 400
  const malformedAck = await fetch(`${API_BASE}/api/runners/tiktok-live-booster_runner_0/commands/%20/ack`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-runner-secret': TEST_RUNNER_SECRET },
    body: JSON.stringify({ success: true })
  });
  assert.strictEqual(malformedAck.status, 400, 'Malformed command ID must return 400');
  console.log('  ✓ Malformed command ID rejected with 400');

  // ─────────────────────────────────────────────────────────────
  // 7. HIGH: DISABLED ACCOUNT ASSIGNMENT PREVENTED
  // ─────────────────────────────────────────────────────────────
  console.log('\n[7/7] Verifying Disabled Account Protection...');

  // Create disabled account
  const disAccRes = await fetch(`${API_BASE}/api/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      email: 'disabled_acct@example.com',
      display_name: 'Disabled Test',
      tiktok_password: 'pass'
    })
  });
  const disAccData = await disAccRes.json();
  const disId = disAccData.account.id;

  // Mark disabled
  await fetch(`${API_BASE}/api/accounts/${disId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ is_enabled: false })
  });

  // Attempt to assign disabled account to Runner 0
  const assignRes = await fetch(`${API_BASE}/api/runners/tiktok-live-booster_runner_0/assign-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ account_id: disId })
  });
  assert.strictEqual(assignRes.status, 400, 'Assigning disabled account must return 400');
  const assignData = await assignRes.json();
  assert.strictEqual(assignData.error, 'Cannot assign a disabled account');
  console.log('  ✓ Assigning a disabled account is strictly blocked with 400');

  // ─────────────────────────────────────────────────────────────
  // 8. HIGH: DISPATCH & FALSE BOOTING ISOLATION
  // ─────────────────────────────────────────────────────────────
  console.log('\n[8/8] Verifying Dispatch & False BOOTING Isolation...');

  // Reset telemetry for runners 0, 1, 2 to STOPPED
  for (const id of [0, 1, 2]) {
    await fetch(`${API_BASE}/api/runners/${id}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({})
    });
  }

  // 8.1 Dispatch only runner 0
  await fetch(`${API_BASE}/api/runners/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ stream_url: 'https://tiktok.com/@live', runner_ids: '0' })
  });
  const diag0AfterD0 = await (await fetch(`${API_BASE}/api/runners/0/diagnostics`)).json();
  const diag1AfterD0 = await (await fetch(`${API_BASE}/api/runners/1/diagnostics`)).json();
  assert.strictEqual(diag0AfterD0.diagnostics.status, 'STARTING', 'Runner 0 must be STARTING');
  assert.strictEqual(diag1AfterD0.diagnostics.status, 'STOPPED', 'Runner 1 must remain STOPPED, not BOOTING/STARTING');
  console.log('  ✓ Starting only Runner 0 leaves Runner 1 STOPPED (no false BOOTING)');

  // 8.2 Dispatch only runner 2
  await fetch(`${API_BASE}/api/runners/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ stream_url: 'https://tiktok.com/@live', runner_ids: '2' })
  });
  const diag2AfterD2 = await (await fetch(`${API_BASE}/api/runners/2/diagnostics`)).json();
  const diag1AfterD2 = await (await fetch(`${API_BASE}/api/runners/1/diagnostics`)).json();
  assert.strictEqual(diag2AfterD2.diagnostics.status, 'STARTING', 'Runner 2 must be STARTING');
  assert.strictEqual(diag1AfterD2.diagnostics.status, 'STOPPED', 'Runner 1 must still remain STOPPED');
  console.log('  ✓ Starting only Runner 2 does not affect Runner 1');

  // 8.3 Dispatch 0, 2
  await fetch(`${API_BASE}/api/runners/0/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({})
  });
  await fetch(`${API_BASE}/api/runners/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ stream_url: 'https://tiktok.com/@live', runner_ids: '0,2' })
  });
  const diag0AfterD02 = await (await fetch(`${API_BASE}/api/runners/0/diagnostics`)).json();
  const diag1AfterD02 = await (await fetch(`${API_BASE}/api/runners/1/diagnostics`)).json();
  const diag2AfterD02 = await (await fetch(`${API_BASE}/api/runners/2/diagnostics`)).json();
  assert.strictEqual(diag0AfterD02.diagnostics.status, 'STARTING', 'Runner 0 must be STARTING');
  assert.strictEqual(diag2AfterD02.diagnostics.status, 'STARTING', 'Runner 2 must be STARTING');
  assert.strictEqual(diag1AfterD02.diagnostics.status, 'STOPPED', 'Runner 1 must remain STOPPED');
  console.log('  ✓ Starting Runner 0,2 isolates STARTING state to 0 and 2; Runner 1 remains STOPPED');

  console.log('\n====================================================');
  console.log('🎉 ALL AUDIT REGRESSION TESTS PASSED (8/8 GROUPS)');
  console.log('====================================================\n');
}

runAllAuditTests()
  .then(() => {
    stopServer();
    process.exit(0);
  })
  .catch(err => {
    console.error('[-] Test failed:', err);
    stopServer();
    process.exit(1);
  });
