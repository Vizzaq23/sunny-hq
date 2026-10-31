// Complete-checkout validation only. Never launches the daily app or a provider.
const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const git = (...args) => {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8', windowsHide: true});
  if (result.status !== 0) throw Error(`git ${args.join(' ')} failed: ${result.stderr || result.error}`);
  return result.stdout.trim();
};
function preflight() {
  if (process.platform !== 'win32' || Number(process.versions.node.split('.')[0]) !== 24)
    throw Error('Use Windows and Node 24. No platform or sandbox bypass is supported.');
  if (git('rev-parse', '--is-shallow-repository') !== 'false') throw Error('Fetch complete history (fetch-depth: 0).');
  for (const ref of ['5b70fb2:desktop/missions.cjs', '289731d:desktop/mission-profile.cjs']) git('cat-file', '-e', ref);
  // Verify tracked files exist, including binary art; Git attributes retain frozen fixture bytes.
  const files = git('ls-files', '-z').split('\0').filter(Boolean);
  for (const file of files) if (!fs.existsSync(path.join(root, file))) throw Error(`Missing tracked file: ${file}`);
  if (git('status', '--porcelain', '--untracked-files=normal')) throw Error('Commit the candidate first; validation requires a clean checkout.');
  return {commit: git('rev-parse', 'HEAD'), node: process.version, platform: process.platform, trackedFiles: files.length};
}
async function main() {
  const output = path.join(root, '.sunny-dev', 'pr-validation', new Date().toISOString().replaceAll(':', '-'));
  fs.mkdirSync(output, {recursive: true});
  const report = {passed: false, liveProviderProof: false, output, steps: []};
  const save = () => fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(report, null, 2));
  async function run(name, exe, args, timeout, env = {}) {
    const log = fs.openSync(path.join(output, `${name}.log`), 'w');
    const started = Date.now();
    console.log(`Running ${name}; log: ${path.join(output, `${name}.log`)}`);
    let result;
    try { result = await new Promise(resolve => {
      const child = spawn(exe, args, {cwd: root, env: {...process.env, ...env}, windowsHide: true, stdio: ['ignore', log, log]});
      let error;
      const timer = setTimeout(() => {
        error = 'ETIMEDOUT';
        // Kill the owned tree while its root still exists, before closing the log.
        if (child.pid) {
          const killed = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
          if (killed.status !== 0) { error = 'TIMEOUT_CLEANUP_FAILED'; child.kill(); }
        }
      }, timeout);
      child.on('error', cause => { error = cause.code; });
      child.on('close', status => { clearTimeout(timer); resolve({status, error}); });
    }); }
    finally { fs.closeSync(log); }
    const step = {name, passed: result.status === 0 && !result.error, exitCode: result.status, error: result.error, elapsedMs: Date.now() - started};
    report.steps.push(step); save(); return step.passed;
  }
  try {
    report.source = preflight(); save();
    if (process.argv.includes('--preflight')) { report.preflightOnly = true; return; }
    const npm = process.env.npm_execpath;
    if (!npm || !fs.existsSync(npm)) throw Error('Invoke through npm run validate:windows so the npm CLI is explicit.');
    if (!await run('install', process.execPath, [npm, 'ci', '--no-audit', '--no-fund'], 10 * 60_000)) return;
    // Electron 44's locked package exposes an installer CLI, not a postinstall.
    if (!await run('electron-install', process.execPath, ['node_modules/electron/install.js'], 10 * 60_000)) return;
    await run('tests', process.execPath, [npm, 'test'], 75 * 60_000);
    if (report.steps.some(step => step.error === 'TIMEOUT_CLEANUP_FAILED')) throw Error('Owned process cleanup failed; stop before starting another check.');
    const built = await run('build', process.execPath, [npm, 'run', 'build'], 10 * 60_000);
    if (built) {
      report.build = JSON.parse(fs.readFileSync(path.join(root, 'dist', 'build-info.json'), 'utf8'));
      if (report.build.sourceCommit !== report.source.commit || report.build.sourceDirty !== false)
        throw Error('Build identity does not match the clean candidate.');
      const nativeOutput = path.join(output, 'native');
      const native = await run('native', path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), ['desktop/workflow-smoke.cjs'], 180_000,
        {SUNNY_SMOKE_HIDDEN: '1', SUNNY_WORKFLOW_CHECK_OUTPUT: nativeOutput, ELECTRON_RUN_AS_NODE: ''});
      if (native) {
        report.native = JSON.parse(fs.readFileSync(path.join(nativeOutput, 'result.json'), 'utf8'));
        if (report.native.passed !== true || report.native.hidden !== true || report.native.syntheticTransport !== true || report.native.liveProviderProof !== false)
          throw Error('Native receipt does not attest hidden synthetic workflow success.');
      }
    }
    if (preflight().commit !== report.source.commit) throw Error('Candidate changed during validation.');
    report.passed = report.steps.length === 5 && report.steps.every(step => step.passed) && report.native?.passed === true;
  } catch (error) { report.error = error.message; }
  finally {
    save(); console.log(`Validation receipt: ${path.join(output, 'summary.json')}`);
    if (!report.passed && !(report.preflightOnly && report.source && !report.error)) process.exitCode = 1;
  }
}
if (require.main === module) main();
module.exports = {preflight};
