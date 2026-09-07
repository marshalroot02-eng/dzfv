const assert = require('assert');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

// Encryption logic mirror for independent verification
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'fallback_secret_key_fgos_tiktok_2026_production!';
const key = crypto.scryptSync(ENCRYPTION_SECRET, 'salt_fgos_tiktok_2026', 32);

function encryptSecret(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decryptSecret(encryptedPayload) {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') return null;
  try {
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) return null;
    const [ivHex, tagHex, cipherHex] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    return null;
  }
}

const API_BASE = (process.env.TEST_API_BASE || 'https://api.fgos.site/tiktok').trim();

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const postData = body ? JSON.stringify(body) : null;
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port ? parseInt(url.port) : (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting Secure Multi-Account Security Test Suite');
  console.log('====================================================\n');

  // Test 0: Verify AES-256-GCM Encryption / Decryption primitive
  console.log('[Test 0] Verifying AES-256-GCM Encryption / Decryption...');
  const testSecret = 'SuperSecretGmailPass2026!';
  const cipher = encryptSecret(testSecret);
  assert(cipher && cipher.includes(':'), 'Ciphertext must be IV:TAG:PAYLOAD format');
  assert(!cipher.includes(testSecret), 'Ciphertext must never contain plaintext secret');
  const decrypted = decryptSecret(cipher);
  assert.strictEqual(decrypted, testSecret, 'Decrypted secret must match original');
  console.log('  ✓ AES-256-GCM encryption & decryption verified successfully.');

  // Test 1: Authenticate operator/admin
  console.log('\n[Test 1] Authenticating Operator / Admin Session...');
  const loginRes = await makeRequest('/api/auth/login', 'POST', {
    email: 'admin@tiktokbooster.local',
    password: 'password123'
  });
  assert(loginRes.status === 200, `Login failed: status ${loginRes.status}`);
  assert(loginRes.data.token, 'Must receive JWT token');
  const token = loginRes.data.token;
  console.log('  ✓ Authenticated with admin JWT token.');

  // Test 2: Reject unauthenticated request to /api/accounts
  console.log('\n[Test 2] Testing Unauthorized Access Rejection...');
  const unauthRes = await makeRequest('/api/accounts', 'GET', null, null);
  assert(unauthRes.status === 401, 'Unauthenticated request must return 401 Unauthorized');
  console.log('  ✓ Unauthenticated access correctly rejected with 401.');

  // Test 3: Account Creation with encrypted secrets
  console.log('\n[Test 3] Testing Secure Account Creation with Encrypted Credentials...');
  const testAccEmail = `test_secure_${Date.now()}@gmail.com`;
  const createRes = await makeRequest('/api/accounts', 'POST', {
    email: testAccEmail,
    display_name: 'Test Secure Account #1',
    tiktok_password: 'TikTokSecretPass123!',
    gmail_address: testAccEmail,
    gmail_app_password: 'abcd efgh ijkl mnop',
    email_password: 'EmailSuperPass456!',
    email_2fa_secret: 'JBSWY3DPEHPK3PXP',
    assigned_runner_key: 'tiktok-live-booster_runner_0'
  }, token);

  assert(createRes.status === 200, `Create account failed: ${JSON.stringify(createRes.data)}`);
  assert(createRes.data.success === true, 'Response must indicate success');
  const createdAcc = createRes.data.account;
  const createdId = createdAcc.id;

  // Verify response does NOT contain plaintext secrets or ciphertext
  assert(!createRes.data.account.password, 'Account response must NOT contain plaintext password');
  assert(!createRes.data.account.tiktok_password, 'Account response must NOT contain plaintext tiktok_password');
  assert(!createRes.data.account.gmail_app_password, 'Account response must NOT contain plaintext gmail_app_password');
  assert(!createRes.data.account.email_password, 'Account response must NOT contain plaintext email_password');
  assert(!createRes.data.account.email_2fa_secret, 'Account response must NOT contain plaintext email_2fa_secret');
  assert(createdAcc.has_tiktok_password === true, 'Presence flag has_tiktok_password must be true');
  assert(createdAcc.has_gmail_app_password === true, 'Presence flag has_gmail_app_password must be true');
  assert(createdAcc.has_email_password === true, 'Presence flag has_email_password must be true');
  assert(createdAcc.has_email_2fa_secret === true, 'Presence flag has_email_2fa_secret must be true');
  console.log(`  ✓ Account #${createdId} created with encrypted secrets. Response verified sanitized.`);

  // Test 4: List accounts and verify zero secret leak in GET API
  console.log('\n[Test 4] Verifying GET /api/accounts Response Sanitization & Redaction...');
  const listRes = await makeRequest('/api/accounts', 'GET', null, token);
  assert(listRes.status === 200, 'GET /api/accounts must return 200');
  const found = listRes.data.accounts.find(a => a.id === createdId);
  assert(found, `Account #${createdId} must exist in accounts list`);
  assert(!found.password, 'GET response must NOT contain password');
  assert(!found.tiktok_password, 'GET response must NOT contain tiktok_password');
  assert(!found.password_encrypted, 'GET response must NOT contain password_encrypted');
  assert(!found.tiktok_password_encrypted, 'GET response must NOT contain tiktok_password_encrypted');
  assert(!found.gmail_app_password, 'GET response must NOT contain gmail_app_password');
  assert(!found.gmail_app_password_encrypted, 'GET response must NOT contain gmail_app_password_encrypted');
  assert(!found.email_password, 'GET response must NOT contain email_password');
  assert(!found.email_password_encrypted, 'GET response must NOT contain email_password_encrypted');
  assert(!found.email_2fa_secret, 'GET response must NOT contain email_2fa_secret');
  assert(!found.email_2fa_secret_encrypted, 'GET response must NOT contain email_2fa_secret_encrypted');
  assert(found.has_tiktok_password === true, 'has_tiktok_password must be true');
  console.log('  ✓ GET /api/accounts verified completely free of plaintext and ciphertext secrets.');

  // Test 5: Duplicate Email Rejection
  console.log('\n[Test 5] Testing Duplicate Email Rejection...');
  const dupRes = await makeRequest('/api/accounts', 'POST', {
    email: testAccEmail.toUpperCase(), // Test case insensitivity
    tiktok_password: 'DifferentPassword!'
  }, token);
  assert(dupRes.status === 400, 'Duplicate account creation must return 400');
  console.log('  ✓ Duplicate email creation correctly blocked.');

  // Test 6: Bulk Import CSV and TSV Parsing
  console.log('\n[Test 6] Testing Bulk Import Mechanism (CSV & TSV)...');
  const bulkTestCsv = `
# Comment line
email,gmail_app_password,tiktok_password,email_password,email_2fa_secret
bulk_user_1_${Date.now()}@gmail.com,app_pwd_1,tiktok_pwd_1,email_pwd_1,secret_1
bulk_user_2_${Date.now()}@gmail.com,app_pwd_2,tiktok_pwd_2,,
invalid-email-address,app_pwd_3,tiktok_pwd_3,,
`;

  const bulkRes = await makeRequest('/api/accounts/bulk-import', 'POST', {
    raw_text: bulkTestCsv
  }, token);

  assert(bulkRes.status === 200, `Bulk import failed: ${JSON.stringify(bulkRes.data)}`);
  assert(bulkRes.data.imported === 2, `Expected 2 imported accounts, got ${bulkRes.data.imported}`);
  assert(bulkRes.data.failed === 1, `Expected 1 failed account, got ${bulkRes.data.failed}`);
  assert(Array.isArray(bulkRes.data.errors) && bulkRes.data.errors.length === 1, 'Expected 1 error item');
  // Verify error message does not contain passwords
  assert(!JSON.stringify(bulkRes.data.errors).includes('app_pwd_3'), 'Errors must not leak credentials');
  console.log(`  ✓ Bulk import processed: ${bulkRes.data.imported} created, ${bulkRes.data.failed} invalid safely handled.`);

  // Test 7: Account Update (Without wiping password when masked)
  console.log('\n[Test 7] Testing Safe Account Update (Preserving Credentials)...');
  const updateRes = await makeRequest(`/api/accounts/${createdId}`, 'PUT', {
    display_name: 'Updated Display Name',
    tiktok_password: '••••••••', // Masked indicator from frontend
    gmail_app_password: '••••••••'
  }, token);
  assert(updateRes.status === 200, `Update failed: ${JSON.stringify(updateRes.data)}`);
  assert(updateRes.data.account.display_name === 'Updated Display Name', 'Display name must be updated');
  assert(updateRes.data.account.has_tiktok_password === true, 'Existing tiktok password must be preserved');
  console.log('  ✓ Account metadata updated without disturbing stored encrypted credentials.');

  // Test 8: Account Enable / Disable Toggle
  console.log('\n[Test 8] Testing Account Enable / Disable Toggle...');
  const toggleRes = await makeRequest(`/api/accounts/${createdId}/toggle`, 'POST', {}, token);
  assert(toggleRes.status === 200, 'Toggle request must return 200');
  assert(toggleRes.data.account.is_enabled === false, 'Account should now be disabled');
  // Toggle back to enabled
  await makeRequest(`/api/accounts/${createdId}/toggle`, 'POST', {}, token);
  console.log('  ✓ Account toggle functionality verified.');

  // Test 9: Runner Assignment Endpoint (Delivers decrypted credentials to authorized runner)
  console.log('\n[Test 9] Testing Secure Runner Credential Delivery...');
  const runnerKey = 'tiktok-live-booster_runner_0';
  const runnerRes = await makeRequest(`/api/accounts/runner-assignment/${runnerKey}`, 'GET', null, token);
  assert(runnerRes.status === 200, `Runner assignment failed: ${JSON.stringify(runnerRes.data)}`);
  assert(runnerRes.data.has_account === true, 'Runner must receive assigned account');
  assert(runnerRes.data.account.tiktok_password === 'TikTokSecretPass123!', 'Runner must receive decrypted tiktok_password in memory');
  assert(runnerRes.data.account.gmail_app_password === 'abcd efgh ijkl mnop', 'Runner must receive decrypted gmail_app_password in memory');
  console.log('  ✓ Authorized runner successfully received decrypted operational credentials.');

  // Test 10: Delete Account
  console.log('\n[Test 10] Testing Safe Account Deletion...');
  const deleteRes = await makeRequest(`/api/accounts/${createdId}`, 'DELETE', null, token);
  assert(deleteRes.status === 200, `Delete failed: ${JSON.stringify(deleteRes.data)}`);
  console.log(`  ✓ Account #${createdId} deleted successfully.`);

  console.log('\n====================================================');
  console.log('🎉 ALL 10 SECURE MULTI-ACCOUNT TESTS PASSED (100%)');
  console.log('====================================================\n');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
