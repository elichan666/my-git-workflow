const fs = require('fs');
const path = require('path');
const os = require('os');

class Config {
  constructor() {
    this.configPath = path.join(os.homedir(), '.git-workflow-config.json');
    this.defaultConfig = {
      pullStrategy: 'rebase',
      mergeStrategy: 'no-ff',
      autoSwitchBack: true,
      allowForcePush: false,
      enforceConventionalCommits: false,
      branchPrefixes: ['feature/', 'bugfix/', 'hotfix/']
    };
  }

  /**
   * 加载配置
   */
  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf8');
        const userConfig = JSON.parse(content);
        return { ...this.defaultConfig, ...userConfig };
      }
    } catch (error) {
      console.warn(`读取配置文件失败: ${error.message}，使用默认配置`);
    }
    return this.defaultConfig;
  }

  /**
   * 保存配置
   */
  save(config) {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`保存配置文件失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 从项目根目录加载配置（优先级更高）
   */
  loadFromProject(projectPath = process.cwd()) {
    const projectConfigPath = path.join(projectPath, '.git-workflow.json');
    try {
      if (fs.existsSync(projectConfigPath)) {
        const content = fs.readFileSync(projectConfigPath, 'utf8');
        const projectConfig = JSON.parse(content);
        const globalConfig = this.load();
        return { ...globalConfig, ...projectConfig };
      }
    } catch (error) {
      // 忽略项目配置读取错误
    }
    return this.load();
  }
}

module.exports = Config;

