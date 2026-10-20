# Rust desktop core UI gates

Explicit build flag `VITE_ZCODE_RUST_DESKTOP=1` owns this static UI policy; no runtime/session state or protocol extension. Default builds retain original behavior.

Core mode preserves project/session navigation, text editing and paste, file mentions as plain prompt context, model selection, streaming, tool cards, permission and stop. It hides attachment picking, ignores file paste/drop and whiteboard attachment collection, excludes plugin/session/whiteboard mention discovery and preserves $ Skills discovery, preserves Host slash commands, the goal shortcut and compression callback; hides workflow shortcuts and fork controls. Runtime still rejects unsupported commands; these gates do not grant capabilities.

Attachment collection has one owner, useComposerAttachments: every intake converges on addPreparedAttachments, and native picker/paste/drop return before side effects in core mode. Plain text paste must fall through without preventDefault. Workspace file drag remains a textual file reference. Hidden UI does not strip ordinary body text or hand-typed instructions.

Acceptance: default build unchanged; core + menu has goal only on an empty new-session draft and has no attachment/workflow/plugins; file paste/drop produces no upload; long text paste remains text; @ panel shows only files; model/send/stop/permission usable. Browser E2E requires launched desktop fixture; source wiring tests cover mode and guard presence until runtime fixture is available.

Rust core also renders automatic question resolution and full model IO retention settings disabled/off; Host remains responsible for sending effective false preferences. Saved original preference values are not rewritten.

## Skills 桌面接线（2026-10-11）

Rust 的 `$` 复用 TS Skills provider、`skills/referenceCatalog` 与 canonical mention Markdown，保留所选 SKILL.md 绝对路径。MentionPlugin 仅开放 `$` Skills 和 `@` files；`#`、plugins、sessions、whiteboards 保持关闭。目录与加载由 Rust 会话持有，UI 不新增缓存或状态所有者。非 Rust `$` 路由、provider 过滤与同名优先级保持现有语义。失败显示现有 provider 错误，不回落文件组。验收用实际 Electron 输入 `$`、选择候选、Skill 工具结果回灌、停止终态与同 profile 冷恢复。

## MCP / Commands 桌面接线（2026-10-12）

Rust 开放 Composer 的 slash button、Lexical `/` 面板和既有 context usage 压缩回调。命令候选继续来自 `useSlashCommands` 的 workspace/identity Host 投影；UI 不补 init、compact 或自定义命令。`appSlashCommands=[]` 只排除 App 本地副屏命令，不屏蔽 Host catalog。`+` 菜单保留原版 goal 的「新会话 + 空草稿 + 未 excluded」规则；Rust workflow 即使 catalog 意外包含同名项仍不开放快捷入口。附件、plugins、session/whiteboard mention、fork 与副屏门禁保持原有策略。

MCP 设置继续由现有设置服务负责目录编辑、启停与连接状态；UI 复用现有错误展示，不维护第二份能力状态。压缩沿用 SessionPane → V4 compact 命令，不新增回调或本地压缩状态。验收：输入 `/` 可选择 Host 发布的 init/compact/自定义命令；实际 runtime 手动压缩入口按 `/compact` 验收；context usage 压缩回调透传至原版组件（当前 TS 组件没有消费该回调或渲染压缩按钮，手动压缩通过 `/compact` 验收）；不支持能力仍以 Host 的明确错误为准。实际 MCP 设置 → 工具执行及 slash 选择 → 结果的 Electron GUI 场景由整体交付验收执行，源码门禁测试不能替代 GUI 验收。
