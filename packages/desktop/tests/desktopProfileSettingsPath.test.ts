import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { resolveDesktopProfileSettingsFile } from "../src/main/desktopProfileSettingsPath.js";

test("explicit desktop profile owns early and startup settings path", () => {
  assert.equal(
    resolveDesktopProfileSettingsFile(
      { ZCODE_DESKTOP_HOME_DIR: " /isolated/profile " },
      "/real/home",
    ),
    join("/isolated/profile", ".zcode", "v2", "setting.json"),
  );
});
test("unset and blank profile preserve real home default", () => {
  for (const env of [{}, { ZCODE_DESKTOP_HOME_DIR: "  " }]) {
    assert.equal(
      resolveDesktopProfileSettingsFile(env, "/real/home"),
      join("/real/home", ".zcode", "v2", "setting.json"),
    );
  }
});
