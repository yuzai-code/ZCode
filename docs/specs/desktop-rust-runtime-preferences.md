# Rust Desktop 不支持的运行时偏好

Services 是 workspace preference 同步的唯一所有者。显式 ZCODE_RUST_DESKTOP=1 时，自动问题解析和完整模型 IO 留存投影为 false，再向实际 runtime 提交；不得跳过 RPC 或伪造 ACK。session runtime preference 响应使用同一 false 规则。其余模式保持既有偏好。

验收：Rust mode 输入 true 也得到两个 false；未指定或其他值保持原有开关。同步仍等待实际执行端确认及原有失败传播，不改变串行队列、重试或状态所有权。UI 应显示 false 并禁用不支持的设置，由设置 UI 单独落实；本改动不写用户原始设置。
