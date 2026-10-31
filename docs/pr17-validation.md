# Reproducing PR #17's remaining checks

This setup supplements the [reconciliation record](pr15-backend-reconciliation-2026-10-28.md). It does not close either unchecked item by itself. No merge, installation, deployment, live-profile migration, or provider launch is part of the automated Windows command.

## Complete Windows checkout

Use a new clone with the complete Git history and binary assets, Node 24, Git, and a Windows runner where disposable fixture repositories and Electron processes are permitted. Check out the exact candidate commit. Do not copy a source-only connector snapshot or borrow another checkout's node_modules. Commit local changes before validation; the receipt records the clean commit tested.

```powershell
git clone https://github.com/Vizzaq23/sunny-hq.git sunny-pr17-validation
Set-Location sunny-pr17-validation
git fetch origin refs/pull/17/head
git checkout --detach FETCH_HEAD
npm run validate:windows
```

The command checks for shallow history, both historical blobs used by compatibility tests (`5b70fb2` and `289731d`), absent tracked files, and dirty source. It then performs locked installation, the entire serial test suite, the production build/typecheck, and `desktop/workflow-smoke.cjs` with `SUNNY_SMOKE_HIDDEN=1`, a fresh isolated profile and sandbox protections intact. Tests failing does not suppress the independent build/native diagnostic; overall success still requires every step. The native check requires a receipt explicitly reporting hidden windows, synthetic transport and no live-provider proof. A failed build prevents native validation against stale dist output.

Receipts and logs are in `.sunny-dev/pr-validation/<timestamp>/`. CI uses the same command, full-history checkout, no provider credentials, and uploads only summary/log/result/screenshot files, excluding fixture profiles. The job's 110-minute budget accommodates installation, the existing long serial suite, build and native check; individual commands remain bounded. Timeout cleanup targets only the command's own process tree. Never add security exclusions, weaken sandboxing or retry uncertain application effects to make this green.

Electron 44.4.3's locked package has an explicit installer CLI rather than a postinstall script. The runner invokes `node node_modules/electron/install.js` after `npm ci`, using the package's bundled checksums. A successful npm install alone does not establish that `electron.exe` is present. No global install-script policy is changed.

For this machine's broken npm shim, replace `npm` with:

```powershell
& 'C:\Program Files\nodejs\node.exe' 'C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js' run validate:windows
```

A passing hidden fixture verifies its existing UI assertions, including artwork loads. It does not cover human visual/screen-reader acceptance, packaged recovery, or the reconciliation record's entire mission-preview journey. Keep those evidence scopes separate. Review the build ID and native result together with the exact SHA; do not reuse an old artifact as a new run.

## Pending approval: deterministic boundary replay

```powershell
npm run validate:approval-replay -- docs/evidence/pending-approval.synthetic.json
node --test --test-concurrency=1 tests/pending-approval-replay.test.cjs tests/approval-boundary.test.cjs tests/codex-transport-isolation.test.cjs
```

The harness drives real Hub/CodexClient handling using labelled in-memory transport and receipt storage. It verifies pending → disconnect/unknown → status reconciliation, stale transport rejection, old local approval ID rejection, fresh local ID even when the provider RPC ID is reused, no automatic answer, one fresh decline, duplicate rejection, and no `turn/start` or `thread/resume` sent. It accepts a **redacted observation**, not an arbitrary executable transcript. Command text is replaced with a fixture marker.

Set `replayedRpcId` to `null` when no replay arrived within the recorded observation window. That case verifies that no approval is fabricated; it deliberately reports `no-replay-observed-remains-unverified`. Changing the input source label to `redacted-provider-observation` never changes `liveProviderProof: false`. A successful replay is a regression result, not attestation of the input's provenance or a live captain decision.

## Real-provider observation still required

An operator needs an authenticated supported Codex app-server, an explicitly authorized disposable provider task/project, and an isolated Sunny test profile. Do not attach this test to the daily profile, import private tasks, copy auth tokens into fixtures, or grant approvals solely to obtain a green test. The replay CLI above never opens a connection or launches a task.

1. Record candidate SHA, Windows/Node/Electron versions, provider CLI version, date, isolation setup and operator authorization in a private local evidence record. Choose one harmless command in a disposable project under a policy that actually requests approval. If the provider does not request approval, record that outcome; do not silently weaken its policy.
2. Observe an actual pending `item/commandExecution/requestApproval` through Sunny. Retain correlation of task/execution/thread/turn and the old UI approval ID privately. Confirm that no response was sent.
3. Disconnect that test connection while the request is pending, then reconnect using the existing Sunny connection path and explicitly check task status. Record the actual read result. Do not start another turn, automatically resume a thread, or synthesize a replay request. Disconnect may terminate the local app-server; that is part of the transport being tested, not evidence that requests survive it.
4. Observe for a fixed window (for example 30 seconds). If the provider reports in-progress/waiting-on-approval, record whether a current-connection request actually arrives and its RPC identity. A terminal, unknown, inaccessible or non-replayed thread is a distinct unresolved outcome, not success. This narrow replay file supports only the in-progress command-approval case; retain other outcomes in the private record.
5. In the isolated instrumented Sunny session, verify the old UI approval ID is rejected with **zero outbound response**. If a real replay arrived, verify it has a new local approval ID and that nothing is answered before a fresh human decision. Have the operator explicitly **decline** that fresh request. Verify exactly one response is emitted and a duplicate response is rejected. Do not send an acceptance to test rejection against live work. The automated harness tests stale acceptance only against in-memory streams.
6. Reconcile/stop the disposable task explicitly and confirm its terminal status and reservation cleanup. If provider state remains unknown, retain the recovery reservation and report it; do not claim cleanup by closing a window.
7. Create a redacted JSON file using the synthetic example's exact schema, source `redacted-provider-observation`, stable replacement thread/turn tokens, and corresponding RPC IDs. Keep real IDs, prompts, paths, credentials and raw diagnostics out of Git and CI. Run the offline replay against that record. Link a reviewed private provenance receipt with the actual live observations when reporting live validation; the offline command alone cannot close the provider checkbox.

The remaining external dependency is provider behavior across this disconnect/reconnect: the implementation cannot force or prove replay by inventing frames. No live capture or fresh human decision has been performed by adding this setup.

## Local setup verification — 2026-10-30

On Windows/Node 24.18.0, in a complete clone of PR head `8950f2c30dcc6b6a54c18fdc8db800941c581259` plus this tooling/documentation patch:

- Locked installation and explicit Electron 44.4.3 installation completed. Local npm still reported unapproved scripts for electron-winstaller, esbuild and node-pty; no global policy was changed.
- TypeScript/production build passed (existing large-chunk warning). Build ID `86b8cbedd90cd713131728ef870886c8b41808f853ef5cff22ce09ab7dd74cfe`; source was dirty with this harness patch, so this is not the clean all-in-one validation receipt.
- 60/60 tests passed across pending-approval-replay, approval-boundary, codex-transport-isolation, mission-profile and supervision-profile. Both historical compatibility sources were available. An earlier sandboxed run was 59/60 with a disposable profile rename `EPERM`; the permitted execution outside that sandbox passed all 60. This does not classify every historical suite failure.
- Hidden native workflow passed with receipt `{passed:true,hidden:true,syntheticTransport:true,liveProviderProof:false}`. Local output `.sunny-dev/pr17-native/` contains fixture screenshots and logs were retained outside the checkout. No provider or daily profile was opened.
- The runner's dirty-checkout preflight rejected this uncommitted tree as intended. The synthetic example CLI passed; no-replay and source-label regressions passed without asserting live proof.

The **full suite and clean all-in-one hosted run are still required**. The above focused tests/build/native run do not close the combined Windows CI checkbox. The real provider checkbox remains unchecked.
