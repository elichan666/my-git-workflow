const simpleGit = require('simple-git');
const chalk = require('chalk');
const path = require('path');

class Git {
  constructor(repoPath = process.cwd(), dryRun = false) {
    this.git = simpleGit(repoPath);
    this.repoPath = repoPath;
    // 优先使用传入的参数，其次使用环境变量
    this.dryRun = Boolean(dryRun) || process.env.DRY_RUN === 'true';
  }

  /**
   * 执行 git 命令并返回结果
   */
  async exec(command, options = {}) {
    if (this.dryRun) {
      console.log(chalk.yellow(`[DRY-RUN] 将执行: git ${command}`));
      return { success: true, output: '[DRY-RUN] 模拟执行成功' };
    }
    try {
      const result = await this.git.raw(command.split(' '));
      return { success: true, output: result.trim() };
    } catch (error) {
      return { success: false, error: error.message, output: error.stdout || error.stderr || '' };
    }
  }

  /**
   * 检查是否为 Git 仓库
   */
  async isGitRepo() {
    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前分支名
   */
  async getCurrentBranch() {
    try {
      const branches = await this.git.branchLocal();
      return branches.current;
    } catch (error) {
      throw new Error(`获取当前分支失败: ${error.message}`);
    }
  }

  /**
   * 检查分支是否存在（本地或远程）
   */
  async branchExists(branchName, remote = false) {
    try {
      if (remote) {
        const branches = await this.git.branch(['-r']);
        return branches.all.some(b => b.includes(`origin/${branchName}`));
      } else {
        const branches = await this.git.branchLocal();
        return branches.all.includes(branchName);
      }
    } catch {
      return false;
    }
  }

  /**
   * 检查远程是否存在
   */
  async hasRemote(remoteName = 'origin') {
    try {
      const remotes = await this.git.getRemotes();
      return remotes.some(r => r.name === remoteName);
    } catch {
      return false;
    }
  }

  /**
   * 检查工作区状态
   */
  async getStatus() {
    try {
      const status = await this.git.status();
      
      // 安全地获取数组长度，处理可能为 undefined 的情况
      const staged = Array.isArray(status.staged) ? status.staged.length : 0;
      const notStaged = Array.isArray(status.notStaged) ? status.notStaged.length : 0;
      const untracked = Array.isArray(status.untracked) ? status.untracked.length : 0;
      const files = Array.isArray(status.files) ? status.files : [];
      
      return {
        isClean: status.isClean ? status.isClean() : (staged === 0 && notStaged === 0 && untracked === 0),
        files: files,
        staged: staged,
        notStaged: notStaged,
        untracked: untracked
      };
    } catch (error) {
      throw new Error(`获取工作区状态失败: ${error.message}`);
    }
  }

  /**
   * 检查是否有未提交的变更
   */
  async hasUncommittedChanges() {
    const status = await this.getStatus();
    return !status.isClean;
  }

  /**
   * 检查是否处于进行中的操作（rebase, merge 等）
   */
  async isInProgress() {
    try {
      const gitDir = path.join(this.repoPath, '.git');
      const fs = require('fs');
      
      const checks = [
        fs.existsSync(path.join(gitDir, 'rebase-apply')),
        fs.existsSync(path.join(gitDir, 'rebase-merge')),
        fs.existsSync(path.join(gitDir, 'MERGE_HEAD')),
        fs.existsSync(path.join(gitDir, 'CHERRY_PICK_HEAD')),
        fs.existsSync(path.join(gitDir, 'BISECT_LOG'))
      ];
      
      return checks.some(exists => exists);
    } catch {
      return false;
    }
  }

  /**
   * 检查远程分支是否有更新
   */
  async hasRemoteUpdates(branchName) {
    try {
      // 先检查远程分支是否存在
      const hasRemote = await this.hasRemoteBranch(branchName);
      if (!hasRemote) {
        return false;
      }

      await this.git.fetch(['origin', branchName]);
      const localCommit = await this.git.revparse(['HEAD']);
      const remoteCommit = await this.git.revparse([`origin/${branchName}`]);
      return localCommit !== remoteCommit;
    } catch {
      // 如果远程分支不存在或获取失败，返回 false
      return false;
    }
  }

  /**
   * 检查当前分支是否有远程分支
   */
  async hasRemoteBranch(branchName) {
    return await this.branchExists(branchName, true);
  }

  /**
   * 获取用户配置
   */
  async getUserConfig() {
    try {
      const name = await this.git.getConfig('user.name');
      const email = await this.git.getConfig('user.email');
      return {
        name: name.value || null,
        email: email.value || null
      };
    } catch {
      return { name: null, email: null };
    }
  }

  /**
   * 添加所有文件
   */
  async addAll() {
    if (this.dryRun) {
      console.log(chalk.yellow('[DRY-RUN] 将执行: git add -A'));
      return { success: true };
    }
    try {
      await this.git.add('./*');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 提交变更
   */
  async commit(message) {
    if (this.dryRun) {
      console.log(chalk.yellow(`[DRY-RUN] 将执行: git commit -m "${message}"`));
      return { success: true };
    }
    try {
      await this.git.commit(message);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 推送分支
   */
  async push(remote = 'origin', branch, options = {}) {
    if (this.dryRun) {
      const pushOptions = [];
      if (options.setUpstream) {
        pushOptions.push('-u');
      }
      if (options.forceWithLease) {
        pushOptions.push('--force-with-lease');
      }
      const optsStr = pushOptions.length > 0 ? ' ' + pushOptions.join(' ') : '';
      console.log(chalk.yellow(`[DRY-RUN] 将执行: git push${optsStr} ${remote} ${branch}`));
      return { success: true };
    }
    try {
      const pushOptions = [];
      if (options.setUpstream) {
        pushOptions.push('-u');
      }
      if (options.forceWithLease) {
        pushOptions.push('--force-with-lease');
      }
      
      await this.git.push(remote, branch, pushOptions);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 拉取代码
   */
  async pull(remote = 'origin', branch, rebase = true) {
    if (this.dryRun) {
      const cmd = rebase ? `git pull --rebase ${remote} ${branch}` : `git pull ${remote} ${branch}`;
      console.log(chalk.yellow(`[DRY-RUN] 将执行: ${cmd}`));
      // 在 dry-run 模式下，仍然检查状态以模拟冲突检测
      try {
        const status = await this.getStatus();
        const hasConflicts = Array.isArray(status.files) && status.files.some(f => f && f.conflict);
        if (hasConflicts) {
          return {
            success: false,
            error: '[DRY-RUN] 模拟拉取冲突',
            hasConflicts: true,
            conflictFiles: Array.isArray(status.files) 
              ? status.files.filter(f => f && f.conflict).map(f => f.path) 
              : []
          };
        }
        return { success: true };
      } catch {
        return { success: true };
      }
    }
    try {
      // 使用 raw 命令来支持 rebase 选项
      if (rebase) {
        await this.git.raw(['pull', '--rebase', remote, branch]);
      } else {
        await this.git.raw(['pull', remote, branch]);
      }
      
      // 拉取后检查是否有冲突
      const status = await this.getStatus();
      const hasConflicts = Array.isArray(status.files) && status.files.some(f => f && f.conflict);
      
      if (hasConflicts) {
        return {
          success: false,
          error: '拉取时发生冲突',
          hasConflicts: true,
          conflictFiles: status.files.filter(f => f && f.conflict).map(f => f.path)
        };
      }
      
      return { success: true };
    } catch (error) {
      // 检查是否是冲突
      try {
        const status = await this.getStatus();
        const hasConflicts = Array.isArray(status.files) && status.files.some(f => f && f.conflict);
        
        return {
          success: false,
          error: error.message,
          hasConflicts,
          conflictFiles: hasConflicts && Array.isArray(status.files) 
            ? status.files.filter(f => f && f.conflict).map(f => f.path) 
            : []
        };
      } catch {
        return {
          success: false,
          error: error.message,
          hasConflicts: false,
          conflictFiles: []
        };
      }
    }
  }

  /**
   * 切换分支
   */
  async checkout(branchName, createFromRemote = false) {
    if (this.dryRun) {
      const cmd = createFromRemote 
        ? `git checkout -b ${branchName} origin/${branchName}`
        : `git checkout ${branchName}`;
      console.log(chalk.yellow(`[DRY-RUN] 将执行: ${cmd}`));
      return { success: true };
    }
    try {
      if (createFromRemote) {
        await this.git.checkout(['-b', branchName, `origin/${branchName}`]);
      } else {
        await this.git.checkout(branchName);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 合并分支
   */
  async merge(branchName, options = {}) {
    if (this.dryRun) {
      const mergeOptions = [];
      if (options.noFF) {
        mergeOptions.push('--no-ff');
      } else if (options.ffOnly) {
        mergeOptions.push('--ff-only');
      } else if (options.squash) {
        mergeOptions.push('--squash');
      }
      const optsStr = mergeOptions.length > 0 ? ' ' + mergeOptions.join(' ') : '';
      console.log(chalk.yellow(`[DRY-RUN] 将执行: git merge${optsStr} ${branchName}`));
      
      // 在 dry-run 模式下，仍然检查状态以模拟冲突检测
      try {
        const status = await this.getStatus();
        const hasConflicts = Array.isArray(status.files) && status.files.some(f => f && f.conflict);
        if (hasConflicts) {
          return {
            success: false,
            error: '[DRY-RUN] 模拟合并冲突',
            hasConflicts: true,
            conflictFiles: Array.isArray(status.files) 
              ? status.files.filter(f => f && f.conflict).map(f => f.path) 
              : []
          };
        }
        
        if (options.squash) {
          if (!status.isClean && status.staged > 0) {
            return { success: true, needsCommit: true };
          }
        }
        
        return { success: true };
      } catch {
        return { success: true };
      }
    }
    try {
      const mergeOptions = [];
      if (options.noFF) {
        mergeOptions.push('--no-ff');
      } else if (options.ffOnly) {
        mergeOptions.push('--ff-only');
      } else if (options.squash) {
        mergeOptions.push('--squash');
      }

      await this.git.merge([branchName, ...mergeOptions]);
      
      // 如果是 squash，需要检查是否需要手动提交
      if (options.squash) {
        const status = await this.getStatus();
        if (!status.isClean && status.staged > 0) {
          return { success: true, needsCommit: true };
        }
      }
      
      return { success: true };
    } catch (error) {
      // 检查是否是冲突
      const status = await this.getStatus();
      const hasConflicts = Array.isArray(status.files) && status.files.some(f => f && f.conflict);
      
      return {
        success: false,
        error: error.message,
        hasConflicts,
        conflictFiles: hasConflicts && Array.isArray(status.files)
          ? status.files.filter(f => f && f.conflict).map(f => f.path)
          : []
      };
    }
  }

  /**
   * 获取远程 URL（用于推断 CI 链接）
   */
  async getRemoteUrl(remote = 'origin') {
    try {
      const remotes = await this.git.getRemotes(true);
      const origin = remotes.find(r => r.name === remote);
      return origin ? origin.refs.fetch : null;
    } catch {
      return null;
    }
  }

  /**
   * 获取最近的提交信息
   */
  async getRecentCommits(count = 10) {
    try {
      const log = await this.git.log({ maxCount: count });
      return log.all;
    } catch {
      return [];
    }
  }
}

module.exports = Git;

