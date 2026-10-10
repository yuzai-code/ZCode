import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prepareSessionStorage } from "../src/host/storagePreparationProcesses.js";

test("explicit Rust storage preparation observes path before native acknowledgment", async () => {
  const dir = await mkdtemp(join(tmpdir(), "zcode-native-prep-"));
  const command = join(dir, "prepare");
  const previous = process.env.ZCODE_AGENT_SERVER_COMMAND;
  const previousMode = process.env.ZCODE_RUST_DESKTOP;
  try {
    await writeFile(
      command,
      `#!/usr/bin/env node
const path = ${JSON.stringify(dir)};
if (process.argv.slice(2).join(' ') !== 'app-server --stdio --desktop --prepare-storage') process.exit(9);
console.log(JSON.stringify({method:'startup/storagePath',params:{path}}));
process.stdin.once('data', data => {
 if(JSON.parse(data).method !== 'startup/storagePathReady') process.exit(8);
 console.log(JSON.stringify({method:'startup/storageState',params:{schemaVersion:1,attemptId:'prep',sequence:1,databaseKind:'session',elapsedMs:0,databaseId:'session',phase:'checking'}}));
 console.log(JSON.stringify({method:'startup/storageState',params:{schemaVersion:1,attemptId:'prep',sequence:2,databaseKind:'session',elapsedMs:0,databaseId:'session',phase:'ready'}}));
 console.log(JSON.stringify({method:'startup/storagePrepared',params:{}}));
 process.stdin.destroy();
});
`,
      { mode: 0o755 },
    );
    process.env.ZCODE_AGENT_SERVER_COMMAND = command;
    process.env.ZCODE_RUST_DESKTOP = "1";
    const phases: string[] = [];
    let observed = false;
    const preparedPaths = new Set<string>();
    await prepareSessionStorage({
      cwd: dir,
      signal: new AbortController().signal,
      preparedPaths,
      observePath: async (path) => {
        assert.equal(path, dir);
        observed = true;
      },
      report: (phase) => {
        assert.equal(observed, true);
        phases.push(phase);
      },
    });
    assert.deepEqual(phases, ["checking", "ready"]);
    assert.equal(preparedPaths.has(await realpath(dir)), true);
    await writeFile(command, "#!/usr/bin/env node\nprocess.exit(7);\n", { mode: 0o755 });
    await assert.rejects(
      prepareSessionStorage({
        cwd: dir,
        signal: new AbortController().signal,
        observePath: async () => {},
        report: () => {},
      }),
    );
    await writeFile(command, "#!/usr/bin/env node\nsetInterval(()=>{},1000);\n", { mode: 0o755 });
    const abort = new AbortController();
    const pending = prepareSessionStorage({
      cwd: dir,
      signal: abort.signal,
      observePath: async () => {},
      report: () => {},
    });
    abort.abort();
    await assert.rejects(pending);
    process.env.ZCODE_RUST_DESKTOP = "0";
    await assert.rejects(
      prepareSessionStorage({
        cwd: dir,
        signal: new AbortController().signal,
        observePath: async () => {},
        report: () => {},
      }),
      /unsupported_runtime/,
    );
  } finally {
    if (previous === undefined) delete process.env.ZCODE_AGENT_SERVER_COMMAND;
    else process.env.ZCODE_AGENT_SERVER_COMMAND = previous;
    if (previousMode === undefined) delete process.env.ZCODE_RUST_DESKTOP;
    else process.env.ZCODE_RUST_DESKTOP = previousMode;
    await rm(dir, { recursive: true, force: true });
  }
});
