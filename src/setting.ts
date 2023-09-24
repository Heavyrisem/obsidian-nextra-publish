import { PluginSettingTab, App, Setting } from 'obsidian';
import NextraPublishPlugin from './main';
import getClassName from './utils/className';

export interface NextraPublishSettings {
  repositoryName?: string;
  userName?: string;
  githubToken?: string;
  publishFontmatterKey: string;
}

export const DEFAULT_SETTINGS: NextraPublishSettings = {
  publishFontmatterKey: 'nextra-publish',
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

    const settingMenuGroups = [this.githubAuthSetting(), this.commonSetting()];
    settingMenuGroups.forEach((settingMenu) =>
      containerEl.appendChild(settingMenu),
    );
  }

  private githubAuthSetting() {
    const containerEl = document.createElement('div');
    containerEl.className = getClassName('setting_group');

    const statusIconClassName = getClassName('setting_statusIcon');
    const updateValidStatus = () => {
      const { repositoryName, userName, githubToken } = this.plugin.settings;
      const statusIcon =
        repositoryName && userName && githubToken ? '✅' : '❌';

      const statusIconEl = document.querySelector(`.${statusIconClassName}`);
      if (statusIconEl) statusIconEl.innerHTML = statusIcon;

      return statusIcon;
    };

    const grouptitle = this.createGroupTitle(
      `Github Authentication (required)`,
    );
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
          .setValue(this.plugin.settings.repositoryName ?? '')
          .onChange(async (value) => {
            this.plugin.settings.repositoryName = value;
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
          .setValue(this.plugin.settings.userName ?? '')
          .onChange(async (value) => {
            this.plugin.settings.userName = value;
            updateValidStatus();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Github Access Token')
      .setDesc(
        'Access Token for Publish to Github, require repository push permission',
      )
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

  private createGroupTitle(title: string) {
    const titleEl = document.createElement('div');
    titleEl.innerHTML = title;
    titleEl.className = getClassName('setting_group_title');

    return titleEl;
  }
}
