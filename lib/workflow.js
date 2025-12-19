const chalk = require('chalk');
const Git = require('./git');
const Validator = require('./validator');
const Prompter = require('./prompter');
const Config = require('./config');

class Workflow {
  constructor(repoPath = process.cwd(), dryRun = false) {
    // 优先使用传入的参数，其次使用环境变量
    this.dryRun = Boolean(dryRun) || process.env.DRY_RUN === 'true';
    this.git = new Git(repoPath, this.dryRun);
    this.validator = new Validator(this.git);
    this.prompter = new Prompter();
    this.originalBranch = null;
    
    // 加载配置
    const configLoader = new Config();
    this.config = configLoader.loadFromProject(repoPath);
    
    if (this.dryRun) {
      console.log(chalk.bold.yellow('\n⚠️  DRY-RUN 模式：将只打印操作，不会实际执行 Git 命令\n'));
    }
  }

  /**
   * 设置配置
   */
  setConfig(config) {
    this.config = { ...this.config, ...config };
  }

  /**
   * 打印步骤标题
   */
  printStep(stepNum, title) {
    console.log(chalk.bold.cyan(`\nStep ${stepNum}: ${title}`));
    console.log(chalk.gray('─'.repeat(50)));
  }

  /**
   * 打印成功信息
   */
  printSuccess(message) {
    console.log(chalk.green(`✓ ${message}`));
  }

  /**
   * 打印错误信息
   */
  printError(message) {
    console.log(chalk.red(`✗ ${message}`));
  }

  /**
   * 打印警告信息
   */
  printWarning(message) {
    console.log(chalk.yellow(`⚠  ${message}`));
  }

  /**
   * 打印信息
   */
  printInfo(message) {
    console.log(chalk.blue(`→ ${message}`));
  }

  /**
   * 推断 CI 链接
   */
  async inferCiUrl(branchName) {
    try {
      const remoteUrl = await this.git.getRemoteUrl();
      if (!remoteUrl) return null;

      // GitHub
      if (remoteUrl.includes('github.com')) {
        const match = remoteUrl.match(/github\.com[:/](.+?)(?:\.git)?$/);
        if (match) {
          return `https://github.com/${match[1]}/actions`;
        }
      }

      // GitLab
      if (remoteUrl.includes('gitlab.com')) {
        const match = remoteUrl.match(/gitlab\.com[:/](.+?)(?:\.git)?$/);
        if (match) {
          return `https://gitlab.com/${match[1]}/-/pipelines`;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 处理冲突并退出
   */
  handleConflict(conflictFiles, step, additionalInfo = '') {
    this.printError(`\n在 ${step} 时发生冲突，流程已中止`);
    
    // 显示当前状态
    console.log(chalk.cyan('\n当前状态:'));
    console.log(`  当前分支: ${this.originalBranch || '未知'}`);
    console.log(`  目标分支: test`);
    
    if (conflictFiles && conflictFiles.length > 0) {
      console.log(chalk.yellow('\n冲突文件:'));
      conflictFiles.forEach(file => console.log(chalk.yellow(`  - ${file}`)));
    }
    
    console.log(chalk.cyan('\n解决步骤:'));
    console.log('  1. 手动解决冲突');
    console.log('  2. git add <解决的文件>');
    
    if (step.includes('rebase')) {
      console.log('  3. git rebase --continue');
      console.log('  4. 重新执行 npm run to-test');
    } else if (step.includes('merge')) {
      console.log('  3. git commit (或 git merge --continue)');
      console.log('  4. git push origin test');
      console.log(chalk.yellow('\n⚠️  重要提示:'));
      console.log(chalk.yellow('  - 解决冲突并提交后，需要手动推送到远程: git push origin test'));
      console.log(chalk.yellow(`  - 确保原始分支 ${this.originalBranch || 'feature'} 已推送到远程`));
      console.log(chalk.yellow('  - 如果原始分支未推送，请先执行: git push origin <分支名>'));
      console.log(chalk.yellow('  - 验证合并是否成功: git log --oneline --graph'));
    }
    
    if (additionalInfo) {
      console.log(chalk.gray(`\n${additionalInfo}`));
    }
    
    process.exit(1);
  }

  /**
   * 执行 to-test 流程
   */
  async toTest() {
    try {
      console.log(chalk.bold.cyan('\n🚀 开始执行 to-test 流程\n'));

      // Step 0: 环境与状态校验
      this.printStep(0, '环境与状态校验');
      
      // 先检查是否有未完成的合并（冲突已解决但未提交）
      const progressStatus = await this.git.isInProgress();
      if (progressStatus.inProgress && progressStatus.type === 'merge' && progressStatus.canContinue) {
        this.printWarning('检测到未完成的合并操作，但冲突已解决');
        this.printInfo('尝试自动完成合并提交...');
        
        try {
          // 获取当前分支信息
          const currentBranch = await this.git.getCurrentBranch();
          const status = await this.git.getStatus();
          
          // 如果有暂存的文件，说明冲突已解决，可以提交
          if (status.staged > 0) {
            const commitResult = await this.git.commit(`merge: 完成合并`);
            if (commitResult.success) {
              this.printSuccess('合并提交已完成');
              
              // 如果当前在 test 分支，直接推送
              if (currentBranch === 'test') {
                this.printStep(5, '推送以触发 CI');
                const pushResult = await this.git.push('origin', 'test');
                if (!pushResult.success) {
                  this.printError(`推送失败: ${pushResult.error}`);
                  process.exit(1);
                }
                this.printSuccess('已推送到 origin/test');
                
                // 收尾
                this.printStep(6, '收尾与提示');
                console.log(chalk.bold.green('\n✅ to-test 流程完成！\n'));
                return;
              }
              
              // 如果不在 test 分支，继续正常流程
              this.printInfo('合并已完成，继续正常流程...\n');
            } else {
              this.printError(`完成合并失败: ${commitResult.error}`);
              this.printInfo('请手动执行: git commit 或 git merge --continue');
              process.exit(1);
            }
          } else {
            this.printWarning('暂存区没有文件，无法自动完成合并');
            this.printInfo('请手动执行: git commit 或 git merge --continue');
            process.exit(1);
          }
        } catch (error) {
          this.printError(`完成合并时出错: ${error.message}`);
          this.printInfo('请手动执行: git commit 或 git merge --continue');
          process.exit(1);
        }
      }
      
      const validation = await this.validator.validateAll();
      if (!validation.valid) {
        process.exit(1);
      }

      // 校验目标分支
      const targetValidation = await this.validator.validateTargetBranch('test');
      if (!targetValidation.valid) {
        this.printError(targetValidation.error);
        process.exit(1);
      }

      // 获取当前分支
      this.originalBranch = await this.git.getCurrentBranch();
      console.log(chalk.cyan(`当前分支: ${this.originalBranch}\n`));

      // Step 1: 处理本地变更
      this.printStep(1, '处理本地变更');
      const status = await this.git.getStatus();
      
      if (status.isClean) {
        this.printWarning('工作区干净，没有需要提交的变更，退出流程。');
        process.exit(0);
      }

      this.printInfo(`检测到工作区有未提交文件 (已暂存: ${status.staged}, 未暂存: ${status.notStaged}, 未跟踪: ${status.untracked})`);
      
      const commitMessage = await this.prompter.getCommitMessage();
      this.printInfo(`执行: git add -A && git commit -m "${commitMessage}"`);

      const addResult = await this.git.addAll();
      if (!addResult.success) {
        this.printError(`添加文件失败: ${addResult.error}`);
        process.exit(1);
      }

      const commitResult = await this.git.commit(commitMessage);
      if (!commitResult.success) {
        this.printError(`提交失败: ${commitResult.error}`);
        process.exit(1);
      }

      this.printSuccess('本地变更已提交');

      // Step 2: 保障当前分支远程存在并同步
      this.printStep(2, '保障当前分支远程存在并同步');
      
      const hasRemote = await this.git.hasRemoteBranch(this.originalBranch);
      
      if (!hasRemote) {
        this.printInfo(`检查: ${this.originalBranch} 无远程分支`);
        const shouldCreate = await this.prompter.confirmCreateRemoteBranch(this.originalBranch);
        
        if (shouldCreate) {
          this.printInfo(`执行: git push -u origin ${this.originalBranch}`);
          const pushResult = await this.git.push('origin', this.originalBranch, { setUpstream: true });
          
          if (!pushResult.success) {
            this.printError(`推送失败: ${pushResult.error}`);
            process.exit(1);
          }
          
          this.printSuccess('远程分支已创建并推送');
        } else {
          this.printWarning('未创建远程分支，继续后续流程');
        }
      } else {
        this.printInfo(`检查: ${this.originalBranch} 存在远程分支`);
        
        // 检查本地是否有未推送的提交
        const hasLocalCommits = await this.git.hasLocalCommits(this.originalBranch);
        
        if (hasLocalCommits) {
          this.printInfo(`检测到 ${this.originalBranch} 有未推送的本地提交`);
          this.printInfo(`执行: git push origin ${this.originalBranch}`);
          
          const pushResult = await this.git.push('origin', this.originalBranch);
          
          if (!pushResult.success) {
            this.printError(`推送失败: ${pushResult.error}`);
            this.printWarning('原始分支未推送到远程，合并后可能无法追踪变更来源');
            const shouldContinue = await this.prompter.confirmContinue('是否继续合并？');
            if (!shouldContinue) {
              process.exit(1);
            }
          } else {
            this.printSuccess('原始分支已推送到远程');
          }
        }
        
        // 检查远程是否有更新
        const hasUpdates = await this.git.hasRemoteUpdates(this.originalBranch);
        
        if (hasUpdates) {
          this.printInfo('检查远程更新: 发现远程有本地未拉取的更新');
          
          // 选择拉取策略
          const pullStrategy = await this.prompter.selectPullStrategy(this.config.pullStrategy);
          const useRebase = pullStrategy === 'rebase';
          
          this.printInfo(`执行: git pull ${useRebase ? '--rebase' : ''} origin ${this.originalBranch}`);
          
          const pullResult = await this.git.pull('origin', this.originalBranch, useRebase);
          
          if (!pullResult.success) {
            if (pullResult.hasConflicts) {
              this.handleConflict(
                pullResult.conflictFiles,
                '拉取远程代码',
                '拉取远程代码时发生冲突，请手动解决冲突后重新执行命令。'
              );
            } else {
              this.printError(`拉取失败: ${pullResult.error}`);
              process.exit(1);
            }
          }
          
          this.printSuccess('拉取成功，无冲突');
        } else {
          this.printInfo('远程无更新或本地已是最新');
        }
      }

      // Step 3: 切换到 test 分支
      this.printStep(3, '切换到 test 分支');
      
      this.printInfo('执行: git fetch origin');
      await this.git.exec('fetch origin');

      const hasLocalTest = await this.git.branchExists('test', false);
      
      if (!hasLocalTest) {
        this.printInfo('本地无 test 分支，基于远程创建');
        const checkoutResult = await this.git.checkout('test', true);
        if (!checkoutResult.success) {
          this.printError(`切换失败: ${checkoutResult.error}`);
          process.exit(1);
        }
      } else {
        this.printInfo('执行: git checkout test');
        const checkoutResult = await this.git.checkout('test');
        if (!checkoutResult.success) {
          this.printError(`切换失败: ${checkoutResult.error}`);
          process.exit(1);
        }
      }

      // 拉取 test 最新代码
      const testPullStrategy = await this.prompter.selectPullStrategy(this.config.pullStrategy);
      const useTestRebase = testPullStrategy === 'rebase';
      
      this.printInfo(`拉取 test 最新: git pull ${useTestRebase ? '--rebase' : ''} origin test`);
      
      const testPullResult = await this.git.pull('origin', 'test', useTestRebase);
      
      if (!testPullResult.success) {
        if (testPullResult.hasConflicts) {
          this.handleConflict(
            testPullResult.conflictFiles,
            '拉取 test 分支',
            '拉取 test 分支时发生冲突，请手动解决冲突后重新执行命令。'
          );
        } else {
          this.printError(`拉取失败: ${testPullResult.error}`);
          process.exit(1);
        }
      }

      this.printSuccess('已切换到 test 分支并拉取最新代码');

      // Step 4: 合并当前分支到 test
      this.printStep(4, '合并当前分支到 test');
      
      const mergeStrategy = await this.prompter.selectMergeStrategy(this.config.mergeStrategy);
      
      const mergeOptions = {};
      if (mergeStrategy === 'no-ff') {
        mergeOptions.noFF = true;
      } else if (mergeStrategy === 'ff-only') {
        mergeOptions.ffOnly = true;
      } else if (mergeStrategy === 'squash') {
        mergeOptions.squash = true;
      }

      this.printInfo(`合并策略: ${mergeStrategy === 'no-ff' ? '--no-ff' : mergeStrategy === 'ff-only' ? '--ff-only' : '--squash'}`);
      this.printInfo(`执行: git merge ${mergeStrategy === 'no-ff' ? '--no-ff' : mergeStrategy === 'ff-only' ? '--ff-only' : '--squash'} ${this.originalBranch}`);

      const mergeResult = await this.git.merge(this.originalBranch, mergeOptions);
      
      if (!mergeResult.success) {
        if (mergeResult.hasConflicts) {
          this.handleConflict(
            mergeResult.conflictFiles,
            '合并分支',
            '合并分支时发生冲突，请手动解决冲突后继续。'
          );
        } else {
          this.printError(`合并失败: ${mergeResult.error}`);
          process.exit(1);
        }
      }

      if (mergeResult.needsCommit) {
        this.printWarning('使用 --squash 合并，需要手动提交');
        this.printInfo('请执行: git commit -m "merge: ..."');
        process.exit(0);
      }

      this.printSuccess('合并完成');

      // Step 5: 推送以触发 CI
      this.printStep(5, '推送以触发 CI');
      
      this.printInfo('执行: git push origin test');
      
      const pushResult = await this.git.push('origin', 'test');
      
      if (!pushResult.success) {
        // 检查是否是推送被拒绝（远端有更新）
        if (pushResult.error.includes('rejected') || pushResult.error.includes('non-fast-forward')) {
          this.printWarning('推送被拒绝，可能是远端有更新');
          this.printInfo('建议执行: git pull --rebase origin test 或 git fetch origin test && git merge origin/test');
          this.printInfo('然后重新执行: git push origin test');
          
          const useForce = await this.prompter.confirmForceWithLease();
          if (useForce) {
            this.printInfo('执行: git push --force-with-lease origin test');
            const forcePushResult = await this.git.push('origin', 'test', { forceWithLease: true });
            if (!forcePushResult.success) {
              this.printError(`强制推送失败: ${forcePushResult.error}`);
              process.exit(1);
            }
            this.printSuccess('强制推送成功');
          } else {
            process.exit(1);
          }
        } else {
          this.printError(`推送失败: ${pushResult.error}`);
          process.exit(1);
        }
      } else {
        this.printSuccess('已推送到 origin/test');
        
        // 尝试推断 CI 链接
        const ciUrl = await this.inferCiUrl('test');
        if (ciUrl) {
          console.log(chalk.cyan(`CI 链接: ${ciUrl}`));
        } else {
          this.printInfo('已触发 CI，请查看 CI 状态');
        }
      }

      // Step 6: 收尾与提示
      this.printStep(6, '收尾与提示');
      
      console.log(chalk.bold('\n操作摘要:'));
      console.log(chalk.cyan(`  起始分支: ${this.originalBranch}`));
      console.log(chalk.cyan(`  目标分支: test`));
      console.log(chalk.cyan(`  合并策略: ${mergeStrategy}`));
      console.log(chalk.cyan(`  推送目标: origin/test`));

      // 获取变更统计
      try {
        const commits = await this.git.getRecentCommits(5);
        if (commits.length > 0) {
          console.log(chalk.cyan(`  最近提交: ${commits[0].message}`));
        }
      } catch (e) {
        // 忽略错误
      }

      console.log(chalk.bold('\n回退建议:'));
      console.log('  如果已推送但需要回退:');
      console.log('    git revert -m 1 <merge-commit>');
      console.log('    git push origin test');

      // 切换回原分支
      if (this.config.autoSwitchBack) {
        const shouldSwitchBack = await this.prompter.confirmSwitchBack(this.originalBranch);
        if (shouldSwitchBack) {
          this.printInfo(`执行: git checkout ${this.originalBranch}`);
          const checkoutResult = await this.git.checkout(this.originalBranch);
          if (checkoutResult.success) {
            this.printSuccess(`已切换回 ${this.originalBranch}`);
          } else {
            this.printWarning(`切换回原分支失败: ${checkoutResult.error}`);
          }
        }
      }

      console.log(chalk.bold.green('\n✅ to-test 流程完成！\n'));

    } catch (error) {
      this.printError(`流程执行失败: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  }

  /**
   * 执行 to-main 流程（简化版，主要差异在保护更严格）
   */
  async toMain() {
    try {
      console.log(chalk.bold.cyan('\n🚀 开始执行 to-main 流程\n'));
      console.log(chalk.yellow('⚠  警告: to-main 流程通常需要更严格的保护，建议使用 PR 合并\n'));

      // Step 0: 前置校验
      this.printStep(0, '环境与状态校验');
      const validation = await this.validator.validateAll();
      if (!validation.valid) {
        process.exit(1);
      }

      // 校验目标分支
      const targetValidation = await this.validator.validateTargetBranch('main');
      if (!targetValidation.valid) {
        this.printError(targetValidation.error);
        process.exit(1);
      }

      // 获取当前分支
      this.originalBranch = await this.git.getCurrentBranch();
      console.log(chalk.cyan(`当前分支: ${this.originalBranch}\n`));

      // 前置检查：建议使用 PR
      const { usePR } = await require('inquirer').prompt([
        {
          type: 'confirm',
          name: 'usePR',
          message: chalk.yellow('建议使用 PR 合并到 main，是否继续直接合并？'),
          default: false
        }
      ]);

      if (!usePR) {
        this.printInfo('已取消，建议创建 PR 进行合并');
        process.exit(0);
      }

      // 后续流程与 to-test 类似，但合并策略更谨慎
      // 这里简化实现，实际可以复用 to-test 的逻辑
      this.printWarning('to-main 流程实现中，建议使用 PR 方式合并');
      process.exit(0);

    } catch (error) {
      this.printError(`流程执行失败: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  }
}

module.exports = Workflow;

