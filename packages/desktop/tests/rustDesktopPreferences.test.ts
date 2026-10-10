import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveRustDesktopPreferences } from "../../services/src/zcode-agent/rustDesktopPreferences.js";

test("explicit Rust desktop sends unsupported preferences as false without changing default", () => {
  assert.deepEqual(resolveRustDesktopPreferences({ ZCODE_RUST_DESKTOP: "1" }), {
    askUserQuestionAutoResolutionEnabled: false,
    modelIoFullRetentionEnabled: false,
  });
  for (const env of [{}, { ZCODE_RUST_DESKTOP: "0" }]) {
    assert.equal(resolveRustDesktopPreferences(env), undefined);
  }
});
