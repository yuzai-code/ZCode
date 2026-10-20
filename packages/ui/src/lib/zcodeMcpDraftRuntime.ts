import { getWorkspaceKey } from "./workspaceKey.js";

/** TS 版 packages/ui/src/settings/McpSettingsSection.tsx：MCP 保存按表单 scope 选择 workspace。 */
export interface McpDraftRuntimeTarget {
  workspacePath: string;
  workspaceIdentity?: string;
  remoteSessionId?: string;
  remoteTarget?: unknown;
}

/**
 * TS 版 packages/ui/src/settings/PluginsSection.tsx：workspace tabs 按 identity/path 去重；
 * 远端 attachment 以 remoteSessionId 隔离，不能用同路径把不同 host 的草稿串起来。
 */
export function selectMcpDraftRuntimeTargets(params: {
  scope: "workspace" | "user";
  target: McpDraftRuntimeTarget;
  workspaces: readonly McpDraftRuntimeTarget[];
}): McpDraftRuntimeTarget[] {
  const { scope, target, workspaces } = params;
  if (scope === "workspace") {
    return [target];
  }

  const isRemoteTarget = Boolean(
    target.remoteSessionId || target.remoteTarget || target.workspaceIdentity?.trim(),
  );
  const candidates = [target, ...workspaces];
  const selected = candidates.filter((candidate) => {
    if (!isRemoteTarget) {
      return !candidate.remoteSessionId && !candidate.remoteTarget && !candidate.workspaceIdentity;
    }
    if (target.remoteSessionId) {
      return candidate.remoteSessionId === target.remoteSessionId;
    }
    return (
      getWorkspaceKey(candidate.workspacePath, candidate.workspaceIdentity) ===
      getWorkspaceKey(target.workspacePath, target.workspaceIdentity)
    );
  });

  const seen = new Set<string>();
  return selected.filter((candidate) => {
    const key = getWorkspaceKey(candidate.workspacePath, candidate.workspaceIdentity);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * MCP 配置保存与草稿 runtime 换代的顺序边界。
 *
 * TS 版 MCP 设置保存先完成持久化，再由运行中的 workspace runtime 读取新配置；
 * 失败时不得回收草稿，否则用户仍在编辑的草稿会被无效配置写入打断。
 */
export async function saveMcpServerAndInvalidateDraft(params: {
  save: () => Promise<void>;
  invalidateDraft: () => Promise<void>;
}): Promise<void> {
  await params.save();
  await params.invalidateDraft();
}
