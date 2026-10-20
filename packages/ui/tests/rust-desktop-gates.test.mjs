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
});
test("Rust core settings and discovery controls are isolated behind the explicit flag", () => {
  const settings = read("settingsPageHelpers.tsx");
  assert.match(settings, /checked=\{!RUST_DESKTOP_CORE && askUserQuestionAutoResolutionEnabled\}/);
  assert.match(settings, /checked=\{!RUST_DESKTOP_CORE && modelIoFullRetentionEnabled\}/);
  const mentions = read("mentions/MentionPlugin.tsx");
  assert.match(
    mentions,
    /RUST_DESKTOP_CORE\s*\? isSkillTrigger\s*\? \["skills" as const\]\s*: \["files" as const\]/,
  );
  assert.match(mentions, /!RUST_DESKTOP_CORE \|\| activeTrigger\?\.trigger !== "#"/);
  assert.match(mentions, /isOpen && isSkillTrigger,/);
  assert.match(mentions, /isOpen && isContextTrigger && !RUST_DESKTOP_CORE/);
  assert.match(
    mentions,
    /isOpen && \(isContextTrigger \|\| isSessionTrigger\) && !RUST_DESKTOP_CORE/,
  );
  assert.match(read("v4/ConversationRowView.tsx"), /!RUST_DESKTOP_CORE && onFork && entityId/);
});
test("Rust exposes Host slash catalog and compression without reopening unsupported intakes", () => {
  const composer = read("v4/ConversationComposer.tsx");
  assert.match(composer, /showSlashButton\s/);
  assert.match(composer, /onSendCompressionCommand=\{onSendCompressionCommand\}/);
  assert.match(composer, /appSlashCommands=\{RUST_DESKTOP_CORE \? \[\] : appSlashCommands\}/);
  assert.match(composer, /showMentionButton=\{!RUST_DESKTOP_CORE\}/);
  const input = read("LexicalChatInput.tsx");
  assert.match(input, /<SlashCommandPlugin/);
  assert.doesNotMatch(input, /!RUST_DESKTOP_CORE \? \(\s*<SlashCommandPlugin/);
  const plugin = read("SlashCommandPlugin.tsx");
  assert.match(plugin, /const commands = useSlashCommands\(workspacePath, workspaceIdentity\)/);
  assert.match(plugin, /buildSlashSuggestions\(commands\)/);
  assert.match(plugin, /return \[\.\.\.cliSuggestions, \.\.\.appSuggestions\]/);
  const menu = read("prompt-editor/ChatPromptActionMenu.tsx");
  assert.match(menu, /\.\.\.quickCommands\.map/);
  assert.doesNotMatch(menu, /RUST_DESKTOP_CORE \? \[\] : quickCommands/);
  assert.match(menu, /!RUST_DESKTOP_CORE \|\| command !== "workflow"/);
  assert.match(menu, /offered\("goal", sessionId === null\)/);
  assert.match(menu, /!excludedSlashCommandNames\?\.includes\(command\)/);
});
