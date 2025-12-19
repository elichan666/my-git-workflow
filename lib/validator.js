const chalk = require('chalk');
// const Git = require('./git');

class Validator {
  constructor(git) {
    this.git = git;
  }

  /**
   * 执行所有前置校验
   */
  async validateAll() {
    const errors = [];

    // 1. 检查是否为 Git 仓库
    console.log(chalk.blue('✓ 检查 Git 仓库...'));
    const isRepo = await this.git.isGitRepo();
    if (!isRepo) {
      errors.push('当前目录不是 Git 仓库');
    }

    // 2. 检查远程是否存在
    if (isRepo) {
      console.log(chalk.blue('✓ 检查远程仓库...'));
      const hasRemote = await this.git.hasRemote();
      if (!hasRemote) {
        errors.push('未找到远程仓库 origin');
      }
    }

    // 3. 检查是否处于进行中的操作
    if (isRepo) {
      console.log(chalk.blue('✓ 检查 Git 操作状态...'));
      const inProgress = await this.git.isInProgress();
      if (inProgress) {
        errors.push('检测到进行中的 Git 操作（rebase/merge/cherry-pick 等），请先完成或中止当前操作');
      }
    }

    // 4. 检查用户配置（可选，仅提示）
    if (isRepo) {
      console.log(chalk.blue('✓ 检查用户配置...'));
      const config = await this.git.getUserConfig();
      if (!config.name || !config.email) {
        console.log(chalk.yellow('⚠  警告: Git 用户信息未配置，建议设置 user.name 和 user.email'));
      }
    }

    if (errors.length > 0) {
      console.log(chalk.red('\n❌ 前置校验失败:'));
      errors.forEach(err => console.log(chalk.red(`  - ${err}`)));
      return { valid: false, errors };
    }

    console.log(chalk.green('✓ 前置校验通过\n'));
    return { valid: true, errors: [] };
  }

  /**
   * 检查目标分支是否存在
   */
  async validateTargetBranch(branchName) {
    const exists = await this.git.branchExists(branchName, true);
    if (!exists) {
      return {
        valid: false,
        error: `远程分支 ${branchName} 不存在`
      };
    }
    return { valid: true };
  }
}

module.exports = Validator;

