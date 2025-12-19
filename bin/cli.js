#!/usr/bin/env node

const Workflow = require('../lib/workflow');
const chalk = require('chalk');
const path = require('path');

// 获取命令参数
// 支持两种方式：
// 1. git-workflow to-test (全局安装后)
// 2. to-test (通过 npm scripts 或直接调用)
let command = process.argv[2];

// 如果没有参数，尝试从命令名推断（支持 npm scripts 中的 to-test 和 to-main）
if (!command) {
  const scriptName = process.argv[1];
  const basename = path.basename(scriptName);
  
  if (basename === 'to-test' || scriptName.includes('to-test')) {
    command = 'to-test';
  } else if (basename === 'to-main' || scriptName.includes('to-main')) {
    command = 'to-main';
  }
}

if (!command) {
  console.log(chalk.red('错误: 请指定命令'));
  console.log(chalk.cyan('用法:'));
  console.log('  git-workflow to-test [--dry-run]  合并当前分支到 test 分支');
  console.log('  git-workflow to-main [--dry-run]  合并当前分支到 main 分支');
  console.log('  或');
  console.log('  npm run to-test  合并当前分支到 test 分支');
  console.log('  npm run to-main  合并当前分支到 main 分支');
  console.log('\n选项:');
  console.log('  --dry-run  演练模式，只打印操作不实际执行');
  process.exit(1);
}

// 检查是否启用 dry-run 模式
const dryRunIndex = process.argv.indexOf('--dry-run');
const dryRun = dryRunIndex !== -1 || process.env.DRY_RUN === 'true';

// 如果找到 --dry-run，从 argv 中移除（避免被当作命令处理）
if (dryRunIndex !== -1) {
  process.argv.splice(dryRunIndex, 1);
}

// 调试信息（开发时使用）
if (process.env.DEBUG) {
  console.log('DEBUG: process.argv =', process.argv);
  console.log('DEBUG: dryRunIndex =', dryRunIndex);
  console.log('DEBUG: dryRun =', dryRun);
  console.log('DEBUG: command =', command);
  console.log('DEBUG: DRY_RUN env =', process.env.DRY_RUN);
}

// 创建 workflow 实例
const workflow = new Workflow(process.cwd(), dryRun);

// 执行对应命令
switch (command) {
  case 'to-test':
    workflow.toTest().catch(error => {
      console.error(chalk.red('执行失败:'), error);
      process.exit(1);
    });
    break;

  case 'to-main':
    workflow.toMain().catch(error => {
      console.error(chalk.red('执行失败:'), error);
      process.exit(1);
    });
    break;

  default:
    console.log(chalk.red(`未知命令: ${command}`));
    console.log(chalk.cyan('可用命令:'));
    console.log('  to-test  合并当前分支到 test 分支');
    console.log('  to-main  合并当前分支到 main 分支');
    process.exit(1);
}

