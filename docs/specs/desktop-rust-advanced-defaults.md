# Rust Desktop 普通会话的高级默认值

Services 的工具支持门和动态工作流门拥有 Host 自动注入的默认值。显式 Rust Desktop 不支持这些功能，因此两个门直接关闭；既有非 Rust 模式门禁保持不变。关闭同源门同时覆盖 workspace policy 同步、legacy create/resume 和 V4 createSession 自动注入。

显式 createSession payload 中的高级 flag、MCP 配置不得过滤：请求仍到执行端，由真实能力拒绝。普通会话未请求高级功能时不得因为 Host 默认注入而失败。MCP 仅由已有请求参数透传，不新增默认列表。

验收：支持门在 Rust 模式始终关闭，非 Rust 模式保留输入值；V4 显式请求字段保持不变。不存在新的状态所有者、缓存或协议路径。
