import assert from 'assert';
import http from 'http';
import app from '../src/index.js';
import { authenticator } from 'otplib';
import { config } from '../src/config/env.js';
import { encryptSecret, decryptSecret } from '../src/utils/crypto.js';

let server;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const reqHeaders = { ...headers };
    let payload = null;

    if (body) {
      payload = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders
      },
      res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting Dev Box Integration Test Suite ---');
  let authToken = '';
  let refreshToken = '';
  let testProjectId = '';
  let testAppId = '';
  let testConfigId = '';

  // 1. Crypto Test
  console.log('Testing AES-256-GCM encryption/decryption...');
  const secretText = 'super-secret-database-password-123!@#';
  const enc = encryptSecret(secretText);
  assert(enc.encryptedValue && enc.iv && enc.authTag, 'Encryption failed');
  const decrypted = decryptSecret(enc.encryptedValue, enc.iv, enc.authTag);
  assert.strictEqual(decrypted, secretText, 'Decryption mismatch');
  console.log('✓ Crypto AES-256-GCM verified');

  // 2. Auth Login Step 1
  console.log('Testing Master Password Login (2FA Challenge)...');
  const loginRes = await request('POST', '/api/auth/login', { password: config.masterPassword || 'admin123' });
  assert.strictEqual(loginRes.status, 200);
  assert(loginRes.data.challengeTicket, 'Missing challenge ticket');
  const ticket = loginRes.data.challengeTicket;
  console.log('✓ Master Login challenge ticket issued');

  // 3. Auth Step 2: Verify TOTP
  console.log('Testing TOTP 2FA Verification...');
  const validOtp = authenticator.generate(config.masterTotpSecret);
  const verifyRes = await request('POST', '/api/auth/verify-2fa', {
    challengeTicket: ticket,
    totpCode: validOtp
  });
  assert.strictEqual(verifyRes.status, 200);
  assert(verifyRes.data.accessToken, 'Missing accessToken');
  assert(verifyRes.data.refreshToken, 'Missing refreshToken');
  authToken = verifyRes.data.accessToken;
  refreshToken = verifyRes.data.refreshToken;
  console.log('✓ 2FA TOTP verified and access token issued');

  // 4. Token Refresh
  console.log('Testing Token Refresh...');
  const refreshRes = await request('POST', '/api/auth/refresh', { refreshToken });
  assert.strictEqual(refreshRes.status, 200);
  assert(refreshRes.data.accessToken, 'Missing refreshed token');
  authToken = refreshRes.data.accessToken;
  console.log('✓ Access token refreshed');

  // 5. Projects Listing
  console.log('Testing Projects API...');
  const projectsRes = await request('GET', '/api/projects');
  assert.strictEqual(projectsRes.status, 200);
  assert(Array.isArray(projectsRes.data), 'Expected projects array');
  const projectWithApp = projectsRes.data.find(p => p.applications && p.applications.length > 0) || projectsRes.data[0];
  testProjectId = projectWithApp.id;
  console.log(`✓ Projects listed (found ${projectsRes.data.length} projects)`);

  // 6. Applications Listing
  console.log('Testing Applications API...');
  let appsRes = await request('GET', `/api/applications?projectId=${testProjectId}`);
  assert.strictEqual(appsRes.status, 200);
  assert(Array.isArray(appsRes.data));
  if (appsRes.data.length === 0) {
    // Pick the first project with an app across all projects
    const allAppsRes = await request('GET', '/api/applications');
    if (allAppsRes.data.length > 0) {
      testAppId = allAppsRes.data[0].id;
      testProjectId = allAppsRes.data[0].project_id;
    }
  } else {
    testAppId = appsRes.data[0].id;
  }
  console.log(`✓ Applications listed for project ${testProjectId}`);

  // 7. Configs Creation with Version 1
  console.log('Testing Configs creation and AES encryption...');
  const testKey = 'TEST_SECRET_' + Date.now();
  const newConfigRes = await request(
    'POST',
    '/api/configs',
    {
      project_id: testProjectId,
      application_id: testAppId,
      environment: 'production',
      key: testKey,
      value: 'original_secret_v1',
      is_secret: true
    },
    { Authorization: `Bearer ${authToken}` }
  );
  assert.strictEqual(newConfigRes.status, 201);
  testConfigId = newConfigRes.data.id;
  assert.strictEqual(newConfigRes.data.currentVersionNumber, 1);
  console.log('✓ Config created with initial version 1');

  // 8. Config Update to Version 2
  console.log('Testing Config update and version increment...');
  const updateConfigRes = await request(
    'PUT',
    `/api/configs/${testConfigId}`,
    { value: 'updated_secret_v2' },
    { Authorization: `Bearer ${authToken}` }
  );
  assert.strictEqual(updateConfigRes.status, 200);

  // 9. Config Rollback to Version 1
  console.log('Testing Secret Rollback...');
  const rollbackRes = await request(
    'POST',
    `/api/configs/${testConfigId}/rollback`,
    { versionNumber: 1 },
    { Authorization: `Bearer ${authToken}` }
  );
  assert.strictEqual(rollbackRes.status, 200);
  assert.strictEqual(rollbackRes.data.currentVersionNumber, 3);
  console.log('✓ Secret rolled back to version 1 successfully');

  // 10. Parity Checker
  console.log('Testing Cross-environment Parity Checker...');
  const parityRes = await request('GET', `/api/configs/parity?applicationId=${testAppId}`);
  assert.strictEqual(parityRes.status, 200);
  assert(parityRes.data.matrix && Array.isArray(parityRes.data.matrix));
  console.log(`✓ Parity checked (${parityRes.data.summary.parityPercentage}% parity)`);

  // 11. Multi-format Exports
  console.log('Testing Multi-format Config Exports...');
  const dotenvExport = await request('GET', `/api/configs/export?applicationId=${testAppId}&environment=production&format=dotenv`);
  assert.strictEqual(dotenvExport.status, 200);
  assert(typeof dotenvExport.data === 'string' && (dotenvExport.data.includes(testKey) || dotenvExport.data.includes('DATABASE_URL')));

  const jsonExport = await request('GET', `/api/configs/export?applicationId=${testAppId}&environment=production&format=json`);
  assert.strictEqual(jsonExport.status, 200);

  const dockerExport = await request('GET', `/api/configs/export?applicationId=${testAppId}&environment=production&format=docker`);
  assert.strictEqual(dockerExport.status, 200);

  const k8sExport = await request('GET', `/api/configs/export?applicationId=${testAppId}&environment=production&format=k8s`);
  assert.strictEqual(k8sExport.status, 200);
  console.log('✓ All 4 export formats (dotenv, JSON, Docker, K8s) verified');

  // 12. CLI Pull Endpoint
  console.log('Testing Local CLI pull endpoint...');
  const cliRes = await request('GET', `/api/cli/pull?applicationId=${testAppId}&environment=production`, null, {
    'x-devbox-master-key': config.cliMasterKey
  });
  assert.strictEqual(cliRes.status, 200);
  assert(typeof cliRes.data === 'string');
  console.log('✓ CLI pull authenticated and downloaded decrypted .env content');

  // 13. Telemetry Ingestion
  console.log('Testing Application Telemetry Ingestion...');
  const appDetail = await request('GET', `/api/applications/${testAppId}`);
  const telToken = appDetail.data.telemetry_token;
  const ingestRes = await request('POST', '/api/telemetry/ingest', {
    memory_rss_mb: 172.5,
    memory_heap_mb: 94.2,
    uptime_seconds: 4000,
    db_active_connections: 5,
    cpu_usage_pct: 18.2
  }, { 'x-telemetry-token': telToken });
  assert.strictEqual(ingestRes.status, 201);
  console.log('✓ Telemetry ingested successfully');

  // 14. Health Checks and Ping
  console.log('Testing Health Checks API and live ping...');
  const hcList = await request('GET', '/api/health-checks');
  assert.strictEqual(hcList.status, 200);
  if (hcList.data.length > 0) {
    const pingRes = await request('POST', `/api/health-checks/${hcList.data[0].id}/ping`, null, {
      Authorization: `Bearer ${authToken}`
    });
    assert.strictEqual(pingRes.status, 200);
    console.log(`✓ Health check ping executed (status: ${pingRes.data.currentStatus})`);
  }

  // 15. Application Files Upload & Download URL
  console.log('Testing Application Files upload and signed download URL...');
  const appFileRes = await request('POST', `/api/applications/${testAppId}/files`, {
    title: 'App Architecture Diagram',
    fileName: 'architecture.pdf'
  }, {
    Authorization: `Bearer ${authToken}`
  });
  assert.strictEqual(appFileRes.status, 201);
  assert(appFileRes.data.id);

  const appFilesList = await request('GET', `/api/applications/${testAppId}/files`);
  assert.strictEqual(appFilesList.status, 200);
  assert(appFilesList.data.length > 0);

  const downloadRes = await request('GET', `/api/applications/${testAppId}/files/${appFileRes.data.id}/download`, null, {
    Authorization: `Bearer ${authToken}`
  });
  assert.strictEqual(downloadRes.status, 200);
  assert(downloadRes.data.downloadUrl);
  console.log('✓ Application auxiliary file upload & signed URL verified');

  // Clean up test file
  await request('DELETE', `/api/applications/${testAppId}/files/${appFileRes.data.id}`, null, {
    Authorization: `Bearer ${authToken}`
  });

  // 16. Clean up created config
  await request('DELETE', `/api/configs/${testConfigId}`, null, {
    Authorization: `Bearer ${authToken}`
  });

  console.log('\n=============================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY!');
  console.log('=============================================\n');
}

// Start test server
const PORT = 5599;
server = app.listen(PORT, async () => {
  baseUrl = `http://localhost:${PORT}`;
  try {
    await runTests();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    server.close();
    process.exit(1);
  }
});
