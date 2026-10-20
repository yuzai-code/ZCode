import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { JsxEmit, ModuleKind, transpileModule } from "typescript";
import { runInNewContext } from "node:vm";
import { loadMcpStore, loadModule, loadSaveHandler } from "./mcp-hot-save.test.mjs";

// Render the complete production component into its JSX tree; click its actual save Button.
// The hook host only substitutes React scheduling, not the consumer or its input conversion.
function renderForm(editorMode, onSave) {
  const states = [];
  let cursor = 0;
  const hook = (initial) => {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
    return [
      states[index],
      (next) => {
        states[index] = typeof next === "function" ? next(states[index]) : next;
      },
    ];
  };
  const react = {
    useState: hook,
    useRef: (initial) => hook(() => ({ current: initial }))[0],
    useEffect: (effect) => effect(),
  };
  const jsx = (type, props) => ({ type, props });
  const source = readFileSync(
    new URL("../src/settings/McpServerForm.tsx", import.meta.url),
    "utf8",
  );
  const { outputText } = transpileModule(source, {
    compilerOptions: { module: ModuleKind.CommonJS, jsx: JsxEmit.ReactJSX },
  });
  const exports = {};
  const deps = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "@/components/ui/button.js": { Button: "Button" },
    "@/components/ui/input.js": { Input: "Input" },
    "@/components/ui/select.js": Object.fromEntries(
      ["Select", "SelectContent", "SelectItem", "SelectTrigger", "SelectValue"].map((key) => [
        key,
        key,
      ]),
    ),
    "@/i18n/IntlProvider.js": {
      useZCodeIntl: () => ({ intl: { formatMessage: ({ id }) => id } }),
    },
    "@/settings/McpFormScopeMenu.js": { McpScopeMenu: "McpScopeMenu" },
    "@/settings/SettingsFormTextarea.js": { SettingsFormTextarea: "SettingsFormTextarea" },
    "@/settings/SettingsFormActions.js": { SettingsFormActions: "SettingsFormActions" },
    "lucide-react": { ChevronDown: "ChevronDown", ChevronUpIcon: "ChevronUp", Trash2: "Trash2" },
    "./mcpSettingsShared.js": loadModule("settings/mcpSettingsShared.ts"),
  };
  runInNewContext(outputText, {
    exports,
    Error,
    require(name) {
      assert.ok(name in deps, `missing form dependency ${name}`);
      return deps[name];
    },
  });
  const props = {
    editorMode,
    onSave,
    scopeKey: "workspace",
    workspaceTabs: [],
    onEditorModeChange() {},
    onScopeKeyChange() {},
    onCancel() {},
  };
  let tree;
  const render = () => {
    cursor = 0;
    tree = exports.McpServerForm(props);
  };
  const nodes = () => {
    const result = [];
    const visit = (node) => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== "object") return;
      result.push(node);
      visit(node.props?.children);
    };
    visit(tree);
    return result;
  };
  const saveButton = () =>
    nodes().find((node) => node.type === "Button" && node.props.children === "common.save");
  render();
  if (editorMode === "json") {
    nodes()
      .find((node) => node.type === "SettingsFormTextarea")
      .props.onChange({
        target: { value: '{\n  "tools": { "command": "node", "args": ["tools.mjs"] }\n}' },
      });
  } else {
    for (const [placeholder, value] of [
      ["my-mcp-server", "tools"],
      ["npx", "node"],
    ]) {
      const input = nodes().find(
        (node) => node.type === "Input" && node.props.placeholder === placeholder,
      );
      assert.ok(input, `missing ${placeholder} input`);
      input.props.onChange({ target: { value } });
    }
  }
  render();
  return {
    render,
    saveButton,
    inputs: () =>
      nodes()
        .filter((node) => ["Input", "SettingsFormTextarea"].includes(node.type))
        .map((node) => node.props.value),
    alert: () => nodes().find((node) => node.props?.role === "alert")?.props.children,
  };
}

for (const editorMode of ["form", "json"]) {
  for (const failure of ["false", "throw"]) {
    test(`actual ${editorMode} save button catches persistence ${failure} and retains inputs and draft`, async () => {
      const { useMcpStore, setMcpStorePlatform } = loadMcpStore();
      setMcpStorePlatform({
        saveMcpToUserDirectory: async () => {
          if (failure === "throw") throw new Error("write threw");
          return { success: false, error: "write denied" };
        },
      });
      const events = [];
      const persist = (...args) => useMcpStore.getState().addScopedMcpServer(...args);
      const form = renderForm(editorMode, loadSaveHandler({ events, persist }));
      const inputs = form.inputs();
      const unhandled = [];
      const listener = (error) => unhandled.push(error);
      process.on("unhandledRejection", listener);
      try {
        await form.saveButton().props.onClick();
        await new Promise((resolve) => setImmediate(resolve));
        form.render();
        assert.equal(form.alert(), failure === "throw" ? "write threw" : "write denied");
        assert.deepEqual(form.inputs(), inputs);
        assert.deepEqual(
          events.map((event) => event[0]),
          ["add"],
        );
        assert.equal(useMcpStore.getState().nativeServers.length, 0);
        assert.equal(form.saveButton().props.disabled, false, "retry is available");
        assert.deepEqual(unhandled, []);
      } finally {
        process.off("unhandledRejection", listener);
      }
    });
  }
}

test("actual save button waits, blocks same-tick duplicate saves and clears error on successful retry", async () => {
  let calls = 0;
  let rejectSave;
  const wait = new Promise((_resolve, reject) => {
    rejectSave = reject;
  });
  const form = renderForm("form", async () => {
    calls += 1;
    if (calls === 1) await wait;
  });
  const click = form.saveButton().props.onClick;
  const first = click();
  const duplicate = click();
  form.render();
  assert.equal(form.saveButton().props.disabled, true);
  assert.equal(calls, 1);
  rejectSave(new Error("retry me"));
  await Promise.all([first, duplicate]);
  form.render();
  assert.equal(form.alert(), "retry me");
  // A successful retry uses the same preserved form.
  const retry = form.saveButton().props.onClick();
  form.render();
  assert.equal(form.alert(), undefined);
  await retry;
  form.render();
  assert.equal(form.alert(), undefined);
  assert.equal(form.saveButton().props.disabled, false);
  assert.equal(calls, 2);
});
