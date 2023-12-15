import { PluginSettingTab, App, Setting } from 'obsidian';
import NextraPublishPlugin from './main';
import getClassName from './utils/className';

export interface NextraPublishSettings {
  githubRepositoryName?: string;
  githubUserName?: string;
  githubToken?: string;

  gitlabRepositoryID?: string;
  gitlabToken?: string;
  gitlabUrl?: string;
  gitlabBranchName?: string;

  publishFontmatterKey: string;
  imagePublishPath: string;
  markdownPublishPath: string;
}

export const DEFAULT_SETTINGS: NextraPublishSettings = {
  publishFontmatterKey: 'nextra-publish',
  imagePublishPath: '/public',
  markdownPublishPath: '/pages',
};

export default class NextraPublishSettingTab extends PluginSettingTab {
  plugin: NextraPublishPlugin;

  constructor(app: App, plugin: NextraPublishPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.classList.add(getClassName('settings'));

    // const tailwindcssEl = document.createElement('script');
    // tailwindcssEl.src = 'https://cdn.tailwindcss.com';
    // containerEl.appendChild(tailwindcssEl);
    // containerEl.style

    const titleEl = document.createElement('h1');
    titleEl.innerHTML = 'Nextra Publish Settings';
    titleEl.className = getClassName('title');
    containerEl.appendChild(titleEl);

    const settingMenuGroups = [
      this.githubAuthSetting(),
      this.gitlabAuthSetting(),
      this.commonSetting(),
      this.publishSetting(),
    ];
    settingMenuGroups.forEach((settingMenu) => containerEl.appendChild(settingMenu));
  }

  private githubAuthSetting() {
    const containerEl = document.createElement('div');
    containerEl.className = getClassName('setting_group');

    const statusIconClassName = getClassName('setting_statusIcon', 'github');
    const updateValidStatus = () => {
      const { githubRepositoryName, githubUserName, githubToken } = this.plugin.settings;
      const statusIcon = githubRepositoryName && githubUserName && githubToken ? '✅' : '❌';

      const statusIconEl = document.querySelector(`.${statusIconClassName.split(' ').join('.')}`);
      if (statusIconEl) statusIconEl.innerHTML = statusIcon;

      return statusIcon;
    };

    const grouptitle = this.createGroupTitle(`Github Authentication (required)`);
    const statusIconEl = document.createElement('span');
    statusIconEl.innerHTML = updateValidStatus();
    statusIconEl.className = statusIconClassName;
    grouptitle.appendChild(statusIconEl);
    containerEl.appendChild(grouptitle);

    new Setting(containerEl)
      .setName('Github Repository Name')
      .setDesc('Github repository name for publish')
      .addText((text) =>
        text
          .setPlaceholder('repo name')
          .setValue(this.plugin.settings.githubRepositoryName ?? '')
          .onChange(async (value) => {
            this.plugin.settings.githubRepositoryName = value;
            updateValidStatus();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Github User Name')
      .setDesc('Github username permission to publish repository')
      .addText((text) =>
        text
          .setPlaceholder('username')
          .setValue(this.plugin.settings.githubUserName ?? '')
          .onChange(async (value) => {
            this.plugin.settings.githubUserName = value;
            updateValidStatus();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Github Access Token')
      .setDesc('Access Token for Publish to Github, require repository push permission')
      .addText((text) =>
        text
          .setPlaceholder('access token')
          .setValue(this.plugin.settings?.githubToken ?? '')
          .onChange(async (value) => {
            this.plugin.settings.githubToken = value;
            updateValidStatus();
            await this.plugin.saveSettings();
          }),
      );

    return containerEl;
  }

  private gitlabAuthSetting() {
    const containerEl = document.createElement('div');
    containerEl.className = getClassName('setting_group');

    const statusIconClassName = getClassName('setting_statusIcon', 'gitlab');
    console.log({ statusIconClassName });
    const updateValidStatus = () => {
      const { gitlabRepositoryID, gitlabToken } = this.plugin.settings;
      const statusIcon = gitlabRepositoryID && gitlabToken ? '✅' : '❌';

      const statusIconEl = document.querySelector(`.${statusIconClassName.split(' ').join('.')}`);
      if (statusIconEl) statusIconEl.innerHTML = statusIcon;

      return statusIcon;
    };

    const grouptitle = this.createGroupTitle(`Gitlab Authentication (required)`);
    const statusIconEl = document.createElement('span');
    statusIconEl.innerHTML = updateValidStatus();
    statusIconEl.className = statusIconClassName;
    grouptitle.appendChild(statusIconEl);
    containerEl.appendChild(grouptitle);

    new Setting(containerEl)
      .setName('Gitlab URL')
      .setDesc('Gitlab url for connect')
      .addText((text) =>
        text
          .setPlaceholder('https://gitlab.com')
          .setValue(this.plugin.settings.gitlabUrl ?? '')
          .onChange(async (value) => {
            this.plugin.settings.gitlabUrl = value;
            updateValidStatus();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Gitlab Repository ID')
      .setDesc('Gitlab repository id for publish')
      .addText((text) =>
        text
          .setPlaceholder('repo ID')
          .setValue(this.plugin.settings.gitlabRepositoryID ?? '')
          .onChange(async (value) => {
            this.plugin.settings.gitlabRepositoryID = value;
            updateValidStatus();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Gitlab Branch Name')
      .setDesc('Gitlab branch name for publish')
      .addText((text) =>
        text
          .setPlaceholder('master')
          .setValue(this.plugin.settings.gitlabBranchName ?? '')
          .onChange(async (value) => {
            this.plugin.settings.gitlabBranchName = value;
            updateValidStatus();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Gitlab Access Token')
      .setDesc('Access Token for Publish to Gitlab, require repository push permission')
      .addText((text) =>
        text
          .setPlaceholder('access token')
          .setValue(this.plugin.settings?.gitlabToken ?? '')
          .onChange(async (value) => {
            this.plugin.settings.gitlabToken = value;
            updateValidStatus();
            await this.plugin.saveSettings();
          }),
      );

    return containerEl;
  }

  private commonSetting() {
    const containerEl = document.createElement('div');
    containerEl.className = getClassName('setting_group');

    const grouptitle = this.createGroupTitle('Common Settings');
    containerEl.appendChild(grouptitle);

    new Setting(containerEl)
      .setName('Fontmatter Publish Key')
      .setDesc('Specify custom fontmatter key for determine publish or not')
      .addText((text) =>
        text
          .setPlaceholder('nextra-publish')
          .setValue(this.plugin.settings.publishFontmatterKey)
          .onChange(async (value) => {
            this.plugin.settings.publishFontmatterKey = value;
            await this.plugin.saveSettings();
          }),
      );

    return containerEl;
  }

  private publishSetting() {
    const containerEl = document.createElement('div');
    containerEl.className = getClassName('setting_group');

    const groupTitle = this.createGroupTitle('Publish Settings');
    containerEl.appendChild(groupTitle);

    new Setting(containerEl)
      .setName('Image Publish Path')
      .setDesc('Path for where Image Files Publish')
      .addText((text) =>
        text
          .setPlaceholder('/public')
          .setValue(this.plugin.settings.imagePublishPath)
          .onChange(async (value) => {
            this.plugin.settings.imagePublishPath = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Markdown Publish Path')
      .setDesc('Path for where Markdown Files Publish')
      .addText((text) =>
        text
          .setPlaceholder('/pages')
          .setValue(this.plugin.settings.markdownPublishPath)
          .onChange(async (value) => {
            this.plugin.settings.markdownPublishPath = value;
            await this.plugin.saveSettings();
          }),
      );

    return containerEl;
  }

  private createGroupTitle(title: string) {
    const titleEl = document.createElement('div');
    titleEl.innerHTML = title;
    titleEl.className = getClassName('setting_group_title');

    return titleEl;
  }
}
