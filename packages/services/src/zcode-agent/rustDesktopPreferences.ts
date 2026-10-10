/** 显式 Rust Desktop 的服务偏好投影；不改写用户设置或跳过执行端确认。 */
export function resolveRustDesktopPreferences(
  env: Readonly<Record<string, string | undefined>> = process.env,
): { askUserQuestionAutoResolutionEnabled: false; modelIoFullRetentionEnabled: false } | undefined {
  return env.ZCODE_RUST_DESKTOP === "1"
    ? { askUserQuestionAutoResolutionEnabled: false, modelIoFullRetentionEnabled: false }
    : undefined;
}

/** Host 自动注册高级工具的支持门；显式请求 payload 不经过此默认门。 */
export function resolveDesktopAdvancedToolDefault(
  supported: boolean,
  env: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return env.ZCODE_RUST_DESKTOP === "1" ? false : supported;
}
