# Desktop 显式隔离 Profile 的启动设置

Desktop main 是启动设置路径的唯一解析所有者。设置内容仍由既有 SettingService 负责，不新增缓存或写入路径。

当 ZCODE_DESKTOP_HOME_DIR 去除空白后非空，early dataBaseDir、early Chromium hardware acceleration 与 startup workspace 的 setting.json 均从该 home 下 .zcode/v2 读取；未指定时沿用 os.homedir。环境覆盖不修改 HOME，不影响普通产品启动。路径辅助函数位于 desktop main，同层 bootstrap/index 复用，不跨包引入内部实现。

事件顺序：环境 → main 统一路径 → early 只读 bootstrap → Electron ready → 既有 SettingService/启动工作区恢复。缺文件/损坏文件沿用现有失败语义；本变更只统一路径，不新增恢复状态。

验收：显式隔离 home 与真实 home 不同时，三个启动读取点使用同一隔离 setting.json；未设置/空白环境保持原路径。用户真实 setting.json 不被读取或写入。无协议迁移、无 UI 行为变更；手机链路不受影响。
