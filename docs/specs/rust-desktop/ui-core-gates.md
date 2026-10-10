# Rust desktop core UI gates

Explicit build flag `VITE_ZCODE_RUST_DESKTOP=1` owns this static UI policy; no runtime/session state or protocol extension. Default builds retain original behavior.

Core mode preserves project/session navigation, text editing and paste, file mentions as plain prompt context, model selection, streaming, tool cards, permission and stop. It hides attachment picking, ignores file paste/drop and whiteboard attachment collection, excludes plugin/skill/session/whiteboard mention discovery, hides slash/goal/workflow shortcuts and compression/fork controls. Runtime still rejects unsupported commands; these gates do not grant capabilities.

Attachment collection has one owner, useComposerAttachments: every intake converges on addPreparedAttachments, and native picker/paste/drop return before side effects in core mode. Plain text paste must fall through without preventDefault. Workspace file drag remains a textual file reference. Hidden UI does not strip ordinary body text or hand-typed instructions.

Acceptance: default build unchanged; core + menu has no attachment/goal/workflow/plugins; file paste/drop produces no upload; long text paste remains text; @ panel shows only files; model/send/stop/permission usable. Browser E2E requires launched desktop fixture; source wiring tests cover mode and guard presence until runtime fixture is available.

Rust core also renders automatic question resolution and full model IO retention settings disabled/off; Host remains responsible for sending effective false preferences. Saved original preference values are not rewritten.
