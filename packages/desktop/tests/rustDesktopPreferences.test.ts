import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveRustDesktopPreferences,
  resolveDesktopAdvancedToolDefault,
} from "../../services/src/zcode-agent/rustDesktopPreferences.js";

test("explicit Rust desktop sends unsupported preferences as false without changing default", () => {
  assert.deepEqual(resolveRustDesktopPreferences({ ZCODE_RUST_DESKTOP: "1" }), {
    askUserQuestionAutoResolutionEnabled: false,
    modelIoFullRetentionEnabled: false,
  });
  for (const env of [{}, { ZCODE_RUST_DESKTOP: "0" }]) {
    assert.equal(resolveRustDesktopPreferences(env), undefined);
  }
});

test("Rust advanced defaults close both host gates while original defaults remain intact", () => {
  for (const supported of [true, false]) {
    assert.equal(resolveDesktopAdvancedToolDefault(supported, { ZCODE_RUST_DESKTOP: "1" }), false);
    assert.equal(resolveDesktopAdvancedToolDefault(supported, {}), supported);
  }
});
