const assert = require('assert');

process.env.PORT = '3099';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-123';
process.env.RUNNER_SECRET = 'test-runner-secret-123';
process.env.ADMIN_PASSWORD = 'password123';
require('../backend/server.js');

async function testIpTelemetry() {
  console.log('--- Testing Runner IP Telemetry End-to-End ---');

  // 1. Wait a moment for server initialization
  await new Promise(resolve => setTimeout(resolve, 800));

  // 2. Post heartbeat with IP telemetry
  const heartbeatPayload = {
    runner_id: 0,
    runner_key: 'tiktok-live-booster_runner_0',
    repo: 'kashifjutt7456-art/tiktok-live-booster',
    status: 'STREAMING',
    likes_sent: 100,
    public_ip: '198.51.100.42',
    ip_provider: 'Hetzner Online GmbH',
    ip_location: 'Falkenstein, Germany',
    ip_updated_at: new Date().toISOString()
  };

  const hbRes = await fetch('http://127.0.0.1:3099/api/telemetry/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(heartbeatPayload)
  });

  assert.strictEqual(hbRes.status, 200, 'Heartbeat must return 200');
  const hbData = await hbRes.json();
  assert.strictEqual(hbData.success, true);
  console.log('✓ Heartbeat with IP telemetry posted successfully.');

  // 3. Login to retrieve admin JWT
  const loginRes = await fetch('http://127.0.0.1:3099/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@tiktokbooster.local', password: 'password123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;
  assert(token, 'Must obtain JWT');

  // 4. Check /api/telemetry/latest
  const latestRes = await fetch('http://127.0.0.1:3099/api/telemetry/latest', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(latestRes.status, 200);
  const latestData = await latestRes.json();
  
  const runnerTelem = latestData.telemetry.find(t => t.runner_key === 'tiktok-live-booster_runner_0');
  assert(runnerTelem, 'Runner 0 telemetry must exist');
  assert.strictEqual(runnerTelem.public_ip, '198.51.100.42');
  assert.strictEqual(runnerTelem.ip_provider, 'Hetzner Online GmbH');
  assert.strictEqual(runnerTelem.ip_location, 'Falkenstein, Germany');
  assert(runnerTelem.ip_updated_at, 'ip_updated_at must be present');
  console.log('✓ /api/telemetry/latest exposes correct IP, Provider, Location.');

  // 5. Check /api/runners/:id/diagnostics
  const diagRes = await fetch('http://127.0.0.1:3099/api/runners/0/diagnostics', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(diagRes.status, 200);
  const diagData = await diagRes.json();
  assert.strictEqual(diagData.diagnostics.public_ip, '198.51.100.42');
  assert.strictEqual(diagData.diagnostics.ip_provider, 'Hetzner Online GmbH');
  assert.strictEqual(diagData.diagnostics.ip_location, 'Falkenstein, Germany');
  console.log('✓ /api/runners/:id/diagnostics exposes correct IP fields.');

  // 6. Test graceful fallback to Unavailable
  const fallbackPayload = {
    runner_id: 1,
    runner_key: 'tiktok-live-booster_runner_1',
    repo: 'kashifjutt7456-art/tiktok-live-booster',
    status: 'STREAMING',
    likes_sent: 50
    // No IP fields provided
  };
  await fetch('http://127.0.0.1:3099/api/telemetry/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fallbackPayload)
  });

  const latestRes2 = await fetch('http://127.0.0.1:3099/api/telemetry/latest', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const latestData2 = await latestRes2.json();
  const runner1 = latestData2.telemetry.find(t => t.runner_key === 'tiktok-live-booster_runner_1');
  assert(runner1, 'Runner 1 telemetry must exist');
  assert.strictEqual(runner1.public_ip, 'Unavailable');
  assert.strictEqual(runner1.ip_provider, 'Unavailable');
  assert.strictEqual(runner1.ip_location, 'Unavailable');
  console.log('✓ Graceful fallback to "Unavailable" verified.');

  console.log('\n🎉 ALL IP TELEMETRY BACKEND TESTS PASSED!');
  process.exit(0);
}

testIpTelemetry().catch(err => {
  console.error('[-] Test failed:', err);
  process.exit(1);
});
