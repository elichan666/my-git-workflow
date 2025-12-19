const inquirer = require('inquirer');
const chalk = require('chalk');

class Prompter {
  /**
   * 收集 commit 信息
   */
  async getCommitMessage() {
    const { message } = await inquirer.prompt([
      {
        type: 'input',
        name: 'message',
        message: '请输入 commit 信息（建议使用 Conventional Commits 规范）:',
        validate: (input) => {
          if (!input || !input.trim()) {
            return 'commit 信息不能为空';
          }
          return true;
        }
      }
    ]);
    return message.trim();
  }

  /**
   * 询问是否创建并推送远程分支
   */
  async confirmCreateRemoteBranch(branchName) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `当前分支 ${chalk.cyan(branchName)} 没有远程分支，是否创建并推送？`,
        default: true
      }
    ]);
    return confirm;
  }

  /**
   * 选择拉取策略
   */
  async selectPullStrategy(defaultStrategy = 'rebase') {
    const { strategy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'strategy',
        message: '选择拉取策略:',
        choices: [
          { name: 'Rebase (推荐，保持线性历史)', value: 'rebase' },
          { name: 'Merge (保留完整合并历史)', value: 'merge' }
        ],
        default: defaultStrategy === 'rebase' ? 0 : 1
      }
    ]);
    return strategy;
  }

  /**
   * 选择合并策略
   */
  async selectMergeStrategy(defaultStrategy = 'no-ff') {
    const { strategy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'strategy',
        message: '选择合并策略:',
        choices: [
          { name: '--no-ff (推荐，保留合并提交，便于回滚)', value: 'no-ff' },
          { name: '--ff-only (仅快进合并，要求基于目标分支)', value: 'ff-only' },
          { name: '--squash (压缩提交为一个)', value: 'squash' }
        ],
        default: defaultStrategy === 'no-ff' ? 0 : defaultStrategy === 'ff-only' ? 1 : 2
      }
    ]);
    return strategy;
  }

  /**
   * 确认是否切换回原分支
   */
  async confirmSwitchBack(originalBranch) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `是否切换回原分支 ${chalk.cyan(originalBranch)}？`,
        default: true
      }
    ]);
    return confirm;
  }

  /**
   * 确认是否使用 force-with-lease
   */
  async confirmForceWithLease() {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('警告: 是否使用 --force-with-lease 强制推送？'),
        default: false
      }
    ]);
    return confirm;
  }
}

module.exports = Prompter;

