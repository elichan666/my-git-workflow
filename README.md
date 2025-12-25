# Git 分支合并 CLI 工具

一个安全、可控的 Git 分支合并 CLI 工具，支持自动将当前分支合并到 `test` 或 `main` 分支并触发 CI。

## 功能特性

- ✅ 自动处理本地变更提交
- ✅ 智能同步远程分支
- ✅ 安全的冲突检测和处理
- ✅ 可配置的合并策略（no-ff, ff-only, squash）
- ✅ 可配置的拉取策略（rebase, merge）
- ✅ 完整的错误处理和回退建议
- ✅ 清晰的步骤输出和日志

## 安装

### 方式 1: 从 Git 仓库安装

```bash
# 安装
npm install git+https://github.com/<your-username>/<your-repo>.git

# 在 package.json 中添加 scripts
{
  "scripts": {
    "to-test": "git-workflow to-test",
    "to-main": "git-workflow to-main"
  }
}
```

### 方式 2: 本地开发（使用 npm link）

```bash
# 1. 在工具库目录下执行
cd <工具库目录>
npm install
npm link

# 2. 在目标项目目录下执行
cd /path/to/your/project
npm link my-git-workflow

# 3. 在目标项目的 package.json 中添加 scripts
{
  "scripts": {
    "to-test": "git-workflow to-test",
    "to-main": "git-workflow to-main"
  }
}
```

### 方式 3: 全局安装

```bash
npm install -g <工具库目录>
```

然后可以在任何项目中使用：
```bash
git-workflow to-test
git-workflow to-main
```

## 使用方法

在目标项目的 `package.json` 中添加 scripts 后：

```bash
npm run to-test   # 合并到 test 分支
npm run to-main   # 合并到 main 分支
```

或全局安装后直接使用：

```bash
git-workflow to-test   # 合并到 test 分支
git-workflow to-main   # 合并到 main 分支
```

## 工作流程

### to-test 流程

1. **环境校验**: 检查 Git 仓库、远程分支、操作状态等
2. **处理本地变更**: 检测并提交工作区变更
3. **同步远程分支**: 确保当前分支与远程同步
4. **切换到 test**: 切换到 test 分支并拉取最新代码
5. **合并分支**: 将当前分支合并到 test
6. **推送触发 CI**: 推送到远程并触发 CI
7. **收尾**: 显示操作摘要和回退建议

## 配置

### 全局配置

在 `~/.git-workflow-config.json` 中配置：

```json
{
  "pullStrategy": "rebase",
  "mergeStrategy": "no-ff",
  "autoSwitchBack": true,
  "skipInteractive": false
}
```

### 项目配置

在项目根目录创建 `.git-workflow.json`（优先级高于全局配置）：

```json
{
  "pullStrategy": "rebase",
  "mergeStrategy": "no-ff",
  "skipInteractive": true
}
```

### 配置项说明

- `pullStrategy`: 拉取策略，可选 `rebase` 或 `merge`，默认 `rebase`
- `mergeStrategy`: 合并策略，可选 `no-ff`、`ff-only` 或 `squash`，默认 `no-ff`
- `autoSwitchBack`: 是否自动切换回原分支，默认 `true`
- `skipInteractive`: 是否跳过交互式选择，直接使用配置的策略，默认 `false`。设置为 `true` 后，将不再询问拉取和合并策略，只需要输入 commit 信息

### 快速配置示例

如果你只想输入 commit 信息，不想每次都选择 merge 和 pull 策略，可以在项目根目录创建 `.git-workflow.json`：

```json
{
  "pullStrategy": "rebase",
  "mergeStrategy": "no-ff",
  "skipInteractive": true
}
```

这样配置后，工具将：
- 自动使用 `rebase` 策略拉取代码
- 自动使用 `no-ff` 策略合并分支
- 不再弹出交互式选择，只需要输入 commit 信息即可

## 安全策略

- ✅ 默认不使用任何形式的强推（`--force`）
- ✅ 默认使用 `--no-ff` 保留合并提交，便于审计与回退
- ✅ 默认使用 `rebase` 拉取，减少无意义的合并提交
- ✅ 遇到冲突立即中止，不做自动解决
- ✅ 所有潜在破坏性操作必须有交互确认

## 冲突处理

当遇到冲突时，工具会：

1. 立即停止自动流程
2. 显示冲突文件列表
3. 提供解决步骤指引
4. 等待用户手动解决后重新执行

## 回退建议

### 已完成合并但未推送

```bash
git reset --hard HEAD~1
```

或使用 revert（推荐）：

```bash
git revert -m 1 <merge-commit>
```

### 已推送产生问题

```bash
git revert -m 1 <merge-commit>
git push origin test
```

## 典型使用场景

### 场景 1: 有本地变更，无远程分支

```bash
npm run to-test
# → 检测到工作区有未提交文件
# → 输入 commit 信息
# → 询问是否创建远程分支
# → 合并到 test 并推送
```

### 场景 2: 有本地变更，远程有更新

```bash
npm run to-test
# → 检测到工作区有未提交文件
# → 提交本地变更
# → 检测到远程有更新
# → 拉取远程代码（可选择 rebase 或 merge）
# → 合并到 test 并推送
```

### 场景 3: 拉取时发生冲突

```bash
npm run to-test
# → 拉取远程代码时发生冲突
# → 工具退出，显示冲突文件
# → 手动解决冲突后重新执行
```

## 注意事项

1. **简化流程**: 直接支持当前分支（feature/bugfix 等）合并到 `test`
2. **远程同步**: 确保当前分支与远程同步，避免合并过时的代码
3. **冲突处理**: 任何步骤遇到冲突都立即退出，交由用户手动处理
4. **可观测性**: 每一步操作都有清晰的输出和日志

## License

MIT
