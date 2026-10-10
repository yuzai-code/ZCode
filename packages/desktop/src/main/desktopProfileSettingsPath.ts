import { homedir } from "node:os";
import { join } from "node:path";

/** Main 的 early bootstrap 与 startup 恢复复用同一显式 profile 设置路径。 */
export function resolveDesktopProfileSettingsFile(
  env: Readonly<Record<string, string | undefined>> = process.env,
  defaultHome: string = homedir(),
): string {
  // settingService 已支持显式 home；early 仍读真实 home 会重定向数据目录并恢复其他实例项目。
  const home = env.ZCODE_DESKTOP_HOME_DIR?.trim() || defaultHome;
  return join(home, ".zcode", "v2", "setting.json");
}
