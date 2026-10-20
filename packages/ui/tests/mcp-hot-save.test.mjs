import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ModuleKind, transpileModule } from "typescript";
import { runInNewContext } from "node:vm";

const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");

export function loadModule(path, deps = {}, context = {}, source = read(path)) {
  const exports = {};
  const { outputText } = transpileModule(source, {
    compilerOptions: { module: ModuleKind.CommonJS },
  });
  runInNewContext(outputText, {
    ...context,
    Error,
    exports,
    require(name) {
      assert.ok(name in deps, `missing dependency ${name}`);
      return deps[name];
    },
  });
  return exports;
}

export function loadMcpStore() {
  const warnings = [];
  const logger = { warn: (...args) => warnings.push(args), info() {} };
  const desktop = loadModule("store/mcpStoreDesktop.ts", { "@/logger.js": { logger } });
  const modules = loadModule("store/mcpStore.ts", {
    zustand: {
      create(initializer) {
        let state;
        const get = () => state;
        const set = (value) => {
          state = { ...state, ...(typeof value === "function" ? value(state) : value) };
        };
        state = initializer(set, get);
        return { getState: get, setState: set };
      },
    },
    "@zcode/shared": { convertToZCodeAgentMcpServer: (name, config) => ({ name, ...config }) },
    "@/logger.js": { logger },
    "@/store/mcpStoreDesktop.js": desktop,
    "@/store/mcpStoreMigration.js": {},
    "@/store/mcpStoreHelpers.js": {
      DEFAULT_MCP_CONFIG: {},
      buildServerList: (_config, native) => native,
      loadPersistedConfig: () => ({}),
      makeServerId: (source, name) => `${source}:${name}`,
      safeReadJson: (_key, fallback) => fallback,
      safeWriteJson() {},
    },
    "@/lib/remoteWorkspaceServiceError.js": { isRemoteWorkspaceDisconnectedError: () => false },
    "@/store/mcpStoreStatusList.js": {},
  });
  return { ...modules, warnings };
}

test("awaited MCP save rejects unavailable and failed persistence without changing projection", async () => {
  const { useMcpStore, setMcpStorePlatform } = loadMcpStore();
  const save = () =>
    useMcpStore.getState().addScopedMcpServer("zcodeagentmcp", "tools", { command: "node" });
  await assert.rejects(save(), /Failed to persist/);
  assert.equal(useMcpStore.getState().nativeServers.length, 0);
  setMcpStorePlatform({
    saveMcpToUserDirectory: async () => ({ success: false, error: "write denied" }),
  });
  await assert.rejects(save(), /write denied/);
  assert.equal(useMcpStore.getState().nativeServers.length, 0);
});

export function loadSaveHandler({ saveFailure = false, staleLoad = false, prev, events, persist }) {
  const source = read("settings/McpSettingsSection.tsx");
  const body = source.slice(
    source.indexOf("  async function handleSave("),
    source.indexOf("  async function handleDelete("),
  );
  const helpers = loadModule("lib/zcodeMcpDraftRuntime.ts", {
    "./workspaceKey.js": loadModule("lib/workspaceKey.ts"),
  });
  const sessionService = {};
  const context = {
    ...helpers,
    activeWorkspacePath: "/repo",
    activeWorkspaceIdentity: undefined,
    remoteSessionId: undefined,
    remoteTarget: undefined,
    formScopeKey: "workspace",
    workspaceTabs: [],
    services: { mcpSyncService: {}, zcodeSessionService: sessionService },
    baseServices: { zcodeSessionService: sessionService },
    useMcpStore: { getState: () => ({ currentProjectPath: staleLoad ? "/other" : "/repo" }) },
    ensureLoadedForWorkspace: async () => true,
    formToConfig: (form) => ({ command: form.command }),
    DEFAULT_MCP_SOURCE: "zcodeagentmcp",
    addScopedMcpServer: async (...args) => {
      events.push(["add", ...args]);
      await persist?.(...args);
      if (saveFailure) throw new Error("save failed");
    },
    updateScopedMcpServer: async (...args) => {
      events.push(["update", ...args]);
      await persist?.(...args);
      if (saveFailure) throw new Error("save failed");
    },
    invalidateDeferredDraftSessionForRuntimeChange: async (target) => {
      events.push(["invalidate", target.workspacePath]);
    },
    setShowForm: (value) => events.push(["showForm", value]),
    setEditingServer: (value) => events.push(["editingServer", value]),
    onFormScopeKeyChange: (value) => events.push(["scopeKey", value]),
  };
  const { handleSave } = loadModule(
    "settings/McpSettingsSection.tsx",
    {},
    context,
    `export ${body.trim()}`,
  );
  return (form = { name: "tools", command: "node" }, server = prev) => handleSave(form, server);
}

test("MCP settings save redraws after invalidation and preserves disabled editing config", async () => {
  for (const prev of [undefined, { name: "tools", enabled: false }]) {
    const events = [];
    await loadSaveHandler({ events, prev })();
    assert.deepEqual(
      events.map((event) => event[0]),
      [prev ? "update" : "add", "invalidate", "showForm", "editingServer", "scopeKey"],
    );
    assert.equal(events[0][3].enable, prev ? false : undefined);
    assert.equal(events[0].length, 6, "save uses captured directory service");
  }
});

test("MCP settings save failure keeps form open and does not invalidate", async () => {
  const events = [];
  await assert.rejects(loadSaveHandler({ events, saveFailure: true })(), /save failed/);
  assert.deepEqual(
    events.map((event) => event[0]),
    ["add"],
  );
});

test("MCP settings ignores a stale workspace load before persistence", async () => {
  const events = [];
  await loadSaveHandler({ events, staleLoad: true })();
  assert.deepEqual(events, []);
});

test("background MCP deletion and preload failures remain handled", async () => {
  const { useMcpStore, setMcpStorePlatform, warnings } = loadMcpStore();
  setMcpStorePlatform({
    saveMcpToUserDirectory: async () => ({ success: false, error: "write denied" }),
  });
  useMcpStore.getState().deleteScopedMcpServer("zcodeagentmcp", "tools");
  useMcpStore.getState().mergePreloadedMcpServers({ preset: { command: "node" } });
  useMcpStore.getState().deletePreloadedMcpServer("zcodeagentmcp", "preset");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(warnings.length, 3);
});

test("MCP save snapshots its directory service and ignores projection after workspace switch", async () => {
  const { useMcpStore, setMcpStoreDirectoryService } = loadMcpStore();
  const calls = [];
  let resolveSave;
  const completion = new Promise((resolve) => {
    resolveSave = resolve;
  });
  const serviceA = {
    saveMcpToUserDirectory: async () => {
      calls.push("a");
      await completion;
    },
  };
  const serviceB = {
    saveMcpToUserDirectory: async () => {
      calls.push("b");
    },
  };
  useMcpStore.setState({ currentProjectPath: "/repo", currentWorkspaceIdentity: "remote:a" });
  setMcpStoreDirectoryService(serviceB);
  const operation = useMcpStore
    .getState()
    .addScopedMcpServer("zcodeagentmcp", "tools", { command: "node" }, "/repo", serviceA);
  useMcpStore.setState({ currentProjectPath: "/repo", currentWorkspaceIdentity: "remote:b" });
  resolveSave();
  await operation;
  assert.deepEqual(calls, ["a"]);
  assert.equal(useMcpStore.getState().nativeServers.length, 0);
});

test("MCP save invalidates only after persistence succeeds", () => {
  const section = read("settings/McpSettingsSection.tsx");
  assert.match(section, /saveMcpServerAndInvalidateDraft\(/);
  assert.match(section, /selectMcpDraftRuntimeTargets\(/);
  assert.match(section, /workspaceIdentity: target\.workspaceIdentity/);
  assert.match(section, /workspacePath: target\.workspacePath/);

  const runtime = read("lib/zcodeMcpDraftRuntime.ts");
  assert.match(runtime, /await params\.save\(\);[\s\S]*?await params\.invalidateDraft\(\);/);
  assert.doesNotMatch(runtime, /finally\s*\{[\s\S]*?invalidateDraft/);
});

test("MCP persistence failure is observable to the save caller", () => {
  const store = read("store/mcpStore.ts");
  assert.match(store, /const persisted = await persistCliMcpToUserDirectory\(/);
  assert.match(store, /if \(!persisted\) \{[\s\S]*?throw new Error/);
  assert.doesNotMatch(
    store.slice(
      store.indexOf("async function persistScopedChange"),
      store.indexOf("\n  return {", store.indexOf("async function persistScopedChange")),
    ),
    /await persistCliMcpToUserDirectory\([\s\S]*?\.catch\(\(error\) => \{[\s\S]*?logger\.warn/,
  );
});

test("workspace scope selects only the captured workspace identity", () => {
  const workspaceKey = loadModule("lib/workspaceKey.ts");
  const { selectMcpDraftRuntimeTargets } = loadModule("lib/zcodeMcpDraftRuntime.ts", {
    "./workspaceKey.js": workspaceKey,
  });
  const target = {
    workspacePath: "/repo",
    workspaceIdentity: "remote://host-a/repo",
    remoteSessionId: "session-a",
    remoteTarget: { kind: "ssh", host: "host-a" },
  };
  const result = selectMcpDraftRuntimeTargets({
    scope: "workspace",
    target,
    workspaces: [target, { ...target, workspaceIdentity: "remote://host-b/repo" }],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [target]);
});

test("user scope selects local workspaces and deduplicates by workspace identity", () => {
  const workspaceKey = loadModule("lib/workspaceKey.ts");
  const { selectMcpDraftRuntimeTargets } = loadModule("lib/zcodeMcpDraftRuntime.ts", {
    "./workspaceKey.js": workspaceKey,
  });
  const current = { workspacePath: "/current" };
  const result = selectMcpDraftRuntimeTargets({
    scope: "user",
    target: current,
    workspaces: [
      current,
      { workspacePath: "/other" },
      { workspacePath: "/other", workspaceIdentity: "remote://host-a/other" },
      { workspacePath: "/other" },
    ],
  });
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        result.map(({ workspacePath, workspaceIdentity }) => ({
          workspacePath,
          workspaceIdentity,
        })),
      ),
    ),
    [{ workspacePath: "/current" }, { workspacePath: "/other" }],
  );
});

test("remote user scope selects only the same attachment, or exact identity without an attachment", () => {
  const workspaceKey = loadModule("lib/workspaceKey.ts");
  const { selectMcpDraftRuntimeTargets } = loadModule("lib/zcodeMcpDraftRuntime.ts", {
    "./workspaceKey.js": workspaceKey,
  });
  const target = {
    workspacePath: "/repo",
    workspaceIdentity: "remote://host-a/repo",
    remoteSessionId: "session-a",
    remoteTarget: { kind: "ssh", host: "host-a" },
  };
  const result = selectMcpDraftRuntimeTargets({
    scope: "user",
    target,
    workspaces: [
      target,
      {
        workspacePath: "/other",
        workspaceIdentity: "remote://host-a/other",
        remoteSessionId: "session-a",
      },
      {
        workspacePath: "/repo",
        workspaceIdentity: "remote://host-b/repo",
        remoteSessionId: "session-b",
      },
      { workspacePath: "/repo" },
    ],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result.map((item) => item.workspaceIdentity))), [
    "remote://host-a/repo",
    "remote://host-a/other",
  ]);

  const identityOnly = selectMcpDraftRuntimeTargets({
    scope: "user",
    target: { workspacePath: "/repo", workspaceIdentity: "remote://host-a/repo" },
    workspaces: [
      { workspacePath: "/repo", workspaceIdentity: "remote://host-a/repo" },
      { workspacePath: "/other", workspaceIdentity: "remote://host-a/other" },
    ],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(identityOnly.map((item) => item.workspaceIdentity))), [
    "remote://host-a/repo",
  ]);
});

test("MCP save does not invalidate or redraw before persistence resolves", async () => {
  const { saveMcpServerAndInvalidateDraft } = loadModule("lib/zcodeMcpDraftRuntime.ts", {
    "./workspaceKey.js": loadModule("lib/workspaceKey.ts"),
  });
  let resolveSave;
  const save = new Promise((resolve) => {
    resolveSave = resolve;
  });
  const events = [];
  const operation = saveMcpServerAndInvalidateDraft({
    save: async () => {
      events.push("save-start");
      await save;
      events.push("save-done");
    },
    invalidateDraft: async () => events.push("invalidate"),
  });
  await Promise.resolve();
  assert.deepEqual(events, ["save-start"]);
  resolveSave();
  await operation;
  assert.deepEqual(events, ["save-start", "save-done", "invalidate"]);
});

test("MCP save rejection leaves draft runtime and redraw untouched", async () => {
  const { saveMcpServerAndInvalidateDraft } = loadModule("lib/zcodeMcpDraftRuntime.ts", {
    "./workspaceKey.js": loadModule("lib/workspaceKey.ts"),
  });
  let invalidated = false;
  await assert.rejects(
    saveMcpServerAndInvalidateDraft({
      save: async () => {
        throw new Error("persist failed");
      },
      invalidateDraft: async () => {
        invalidated = true;
      },
    }),
    /persist failed/,
  );
  assert.equal(invalidated, false);
});

test("MCP runtime invalidation publishes every draft version and closes only legacy draft", async () => {
  const events = [];
  let draftSessionId = "legacy-draft";
  const helper = loadModule("lib/zcodeDraftSkillInvalidation.ts", {
    "@/logger.js": { logger: { info: (...args) => events.push(["log", ...args]), warn() {} } },
    "@/store/zcodeSessionStore.js": {
      useZCodeSessionStore: {
        getState: () => ({
          getWorkspaceState: () => ({ draftSessionId }),
          invalidateDraftRuntime: (...args) => events.push(["invalidate", ...args]),
        }),
      },
    },
  });
  const service = { closeSession: async (payload) => events.push(["close", payload]) };
  await helper.invalidateDeferredDraftSessionForRuntimeChange({
    logScope: "mcp",
    reason: "mcp-updated",
    workspacePath: "/repo",
    workspaceIdentity: " remote://host/repo ",
    zcodeSessionService: service,
  });
  draftSessionId = null;
  await helper.invalidateDeferredDraftSessionForRuntimeChange({
    logScope: "mcp",
    reason: "mcp-updated",
    workspacePath: "/repo",
    workspaceIdentity: "remote://host/repo",
    zcodeSessionService: service,
  });
  assert.deepEqual(
    events.map((event) => event[0]),
    ["invalidate", "close", "log", "invalidate"],
  );
  assert.equal(events[1][1].workspaceIdentity, "remote://host/repo");
});
