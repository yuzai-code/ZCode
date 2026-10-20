# MCP 保存后的草稿 runtime 热刷新

## 行为与所有者

MCP 设置保存成功后，必须通过既有 `invalidateDeferredDraftSessionForRuntimeChange`
发布草稿 runtime 失效版本。版本由 `useZCodeSessionStore.invalidateDraftRuntime` 唯一持有；
草稿协调器只回收未提升的预热会话。正式会话、显式运行时覆盖保持既有行为。
不重启进程、不恢复或停止运行中的会话。

```text
设置保存 → MCP store 完成持久化 → 草稿 owner 发布失效版本 → pane 回收未提升草稿并重建
                   └─失败 → 表单保留错误与原草稿，失效版本不变
```

## 作用域与时序

- workspace 保存仅刷新该 workspace identity；身份规则沿用 `workspaceIdentity?.trim() || workspacePath`。
- 本地用户配置保存刷新当前窗口全部本地 workspace 草稿，远端 identity 不受影响。
- 远端用户配置保存仅刷新同一 remote attachment 内的 workspace 草稿，不能仅按路径匹配。
- 保存目标、identity、服务和候选 workspace 在提交时捕获，等待持久化期间切换目标不能把结果路由到新目标。
- 用户配置候选来源为既有 workspace tabs 加当前目标，按身份去重；不新增 runtime 缓存或任务状态。
- 成功后关闭表单并清理编辑态，触发既有列表重绘；失败时不执行这些成功动作。
- 首次新建与编辑都走同一顺序；未加载成功的保存不执行任何动作。

## 表单异步保存契约

`McpServerForm.onSave` 返回 `Promise<void>`。真实保存按钮等待该 Promise，
捕获持久化 false/throw 转成的错误，在普通与 JSON 两种模式下显示同一错误区域。
失败保留输入、JSON 草稿、编辑态和原 runtime，不触发成功清理，也不产生未处理 rejection。
表单局部 saving 状态只负责阻止重复提交，不持有持久化或会话事实；重试前清除旧保存错误。
JSON 解析错误仍由既有 jsonError 显示。

```text
保存按钮 → 解析（JSON 模式）→ 设置 saving → await 父级保存 → 成功清理
                                    └─ reject → 共用错误区域 + 保留输入 → 解除 saving
```

## 验收

自动化覆盖保存顺序、持久化失败与不可用、同路径不同远端 identity、本地用户范围、远端用户 attachment 范围、去重、成功重绘与既有 owner。
root 以隔离 profile 验证设置保存前已存在预热会话，保存后无需重启即可创建新草稿并携带 MCP tools。
本模块不执行用户 App 或配置操作。
