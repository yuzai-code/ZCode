import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), "utf8");
test("Rust opt-in gating preserves text editing and closes every attachment intake", () => {
  assert.match(read("lib/rustDesktopMode.ts"), /VITE_ZCODE_RUST_DESKTOP/);
  const intake = read("v4/composer/useComposerAttachments.ts");
  assert.match(
    intake,
    /if \(RUST_DESKTOP_CORE\) \{\s*selectedAttachments\.forEach\(revokeChatComposerAttachment\)/,
  );
  assert.match(intake, /const handlePaste[\s\S]*if \(RUST_DESKTOP_CORE\) return/);
  const composer = read("v4/ConversationComposer.tsx");
  assert.match(composer, /attachmentAction=\{RUST_DESKTOP_CORE \? undefined : attachmentAction\}/);
  assert.match(composer, /showSlashButton=\{!RUST_DESKTOP_CORE\}/);
});
test("Rust core settings and discovery controls are isolated behind the explicit flag", () => {
  const settings = read("settingsPageHelpers.tsx");
  assert.match(settings, /checked=\{!RUST_DESKTOP_CORE && askUserQuestionAutoResolutionEnabled\}/);
  assert.match(settings, /checked=\{!RUST_DESKTOP_CORE && modelIoFullRetentionEnabled\}/);
  const mentions = read("mentions/MentionPlugin.tsx");
  assert.match(mentions, /RUST_DESKTOP_CORE\s*\? \["files" as const\]/);
  assert.match(read("LexicalChatInput.tsx"), /!RUST_DESKTOP_CORE \? \(\s*<SlashCommandPlugin/);
  assert.match(read("v4/ConversationRowView.tsx"), /!RUST_DESKTOP_CORE && onFork && entityId/);
});
