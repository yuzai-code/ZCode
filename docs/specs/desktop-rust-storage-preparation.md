# Desktop Rust 存储准备适配

Host 是存储准备握手和路径观察的唯一所有者。仅显式 ZCODE_RUST_DESKTOP=1 时，通过 ZCODE_AGENT_SERVER_COMMAND 启动 native app-server --stdio --desktop --prepare-storage；默认 Worker 路径保持原语义。原 CLI 数据库不会在 Rust 模式中初始化，Rust runtime 自己验证 sessions 目录。

事件顺序：spawn → startup/storagePath → Host observePath/复用判定 → startup/storagePathReady → checking/ready → storagePrepared → 子进程关闭且退出 0。只有完成握手并正常退出才登记 preparedPaths。失败帧、损坏/超长帧、超时、取消、非零退出都拒绝。取消须杀死 native 子进程，不能留下孤儿；stdout 仍走既有有界 schema，stderr 仅排空。环境由既有进程环境和 options.env 组成，cwd 使用命令解析器既有 cwd。

验收：native 假进程验证完整握手、路径观察先于确认、非零退出失败和取消退出；默认无显式开关仍要求原 storagePreparationEntry。无协议版本、UI 或持久化所有权迁移。
