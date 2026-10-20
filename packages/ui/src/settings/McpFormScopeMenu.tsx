import { useZCodeIntl } from "@/i18n/IntlProvider.js";
import { PluginScopeMenu } from "@/settings/PluginScopeMenu.js";
import type { WorkspaceTabState } from "@/store/tabStore.js";

// TS 版 settings/McpServerForm.tsx：scope wrapper 只展示既有 PluginScopeMenu，不持有 scope 状态。
export function McpScopeMenu({
  disabled,
  scopeKey,
  workspaceTabs,
  onChange,
}: {
  disabled: boolean;
  scopeKey: string;
  workspaceTabs: WorkspaceTabState[];
  onChange: (scopeKey: string) => void;
}) {
  const { intl } = useZCodeIntl();
  const scopeLabel = intl.formatMessage({ id: "settings.scope.label" });

  return (
    <label className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <span className="shrink-0 text-ui-base text-foreground-subtle">{scopeLabel}</span>
      <PluginScopeMenu
        align="end"
        disabled={disabled}
        selectedScopeKey={scopeKey}
        workspaceTabs={workspaceTabs}
        onScopeKeyChange={onChange}
      />
    </label>
  );
}
