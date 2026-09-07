const fs = require('fs');
const path = require('path');

let raw = fs.readFileSync('C:/Users/Hi/.gemini/antigravity-ide/brain/4f0afe17-da8f-495e-a880-0bd012329117/scratch/fgos_fleet_repos.json');
if (raw[0] === 0xff && raw[1] === 0xfe) raw = raw.toString('utf16le'); else raw = raw.toString('utf8');
const fgosRepos = JSON.parse(raw.trim());

const checkResults = JSON.parse(fs.readFileSync('C:/Users/Hi/.gemini/antigravity-ide/brain/4f0afe17-da8f-495e-a880-0bd012329117/scratch/repo_check_results.json', 'utf8'));
const statusMap = new Map();
checkResults.forEach(c => statusMap.set(c.repo, c));

const accounts = [];
const repositories = [];

fgosRepos.forEach((item, index) => {
  const parts = item.repo_name.split('/');
  const owner = parts[0];
  const repo = parts[1] || item.repo_name;
  const id = index + 1;
  const check = statusMap.get(item.repo_name) || {};
  const isWorking = check.status === 200;

  const status = isWorking ? 'ACTIVE' : (check.status === 403 ? 'SUSPENDED' : 'DISABLED');
  const errorMsg = isWorking ? null : (check.msg || 'Account unavailable');

  const acc = {
    id: id,
    label: item.label || `Account ${id}`,
    owner: owner,
    repo: repo,
    token: item.github_token,
    workflow_file: item.workflow_file || 'workflow_http_v2_pia.yml',
    max_runners: 5,
    is_active: isWorking,
    status: status,
    consecutive_failures: isWorking ? 0 : 3,
    error_message: errorMsg,
    proxy_url: item.proxy_url || null,
    queue_depth: { queued: 0, in_progress: 0, total_pending: 0, runs: [] },
    created_at: new Date().toISOString()
  };
  accounts.push(acc);

  repositories.push({
    id: id,
    fleet_id: id,
    account_id: id,
    owner: owner,
    repo: repo,
    workflow_file: item.workflow_file || 'workflow_http_v2_pia.yml',
    label: item.label || `Account ${id}`,
    token: item.github_token,
    is_active: isWorking,
    status: isWorking ? 'READY' : status,
    workflow_status: isWorking ? 'ACTIVE' : 'DISABLED',
    dispatch_status: 'IDLE',
    last_run_status: item.last_run_status || 'idle',
    runner_count: 5,
    proxy_url: item.proxy_url || null,
    error_message: errorMsg,
    last_checked: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
});

fs.writeFileSync(path.join(__dirname, '..', 'backend', 'fleet_accounts.json'), JSON.stringify(accounts, null, 2), 'utf8');
fs.writeFileSync(path.join(__dirname, '..', 'backend', 'fleet_repositories.json'), JSON.stringify(repositories, null, 2), 'utf8');

console.log(`Generated ${accounts.length} accounts and ${repositories.length} repositories.`);
console.log(`Active count: ${accounts.filter(a => a.is_active).length}`);
