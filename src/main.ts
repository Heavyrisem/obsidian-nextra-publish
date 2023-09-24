import { CachedMetadata, Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';
import { dirname } from 'path';
import NextraPublishSettingTab, { NextraPublishSettings, DEFAULT_SETTINGS } from './setting';
import { uploadGithub } from './utils/publish';
import { isDirectory } from './utils/path';

interface PublishData {
  path: string;
  message: string;
  content: Buffer | string;
}

interface MarkdownFileWithMetadata extends TFile {
  metadata: CachedMetadata | null;
  content: string;
}

export default class NextraPublishPlugin extends Plugin {
  settings: NextraPublishSettings;

  async onload() {
    await this.loadSettings();

    // This creates an icon in the left ribbon.
    // const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
    //   // Called when the user clicks the icon.
    //   new Notice('This is a notice!');
    // });
    // Perform additional things with the ribbon
    // ribbonIconEl.addClass('my-plugin-ribbon-class');

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    // const statusBarItemEl = this.addStatusBarItem();
    // statusBarItemEl.setText('Status Bar Text');

    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: 'publish-all-notes-nextra',
      name: 'Publish All Notes to Nextra',
      editorCallback: this.handlePublishAllNotes.bind(this),
    });

    this.addSettingTab(new NextraPublishSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(await this.loadData()),
    };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async getAllMarkdowns(): Promise<MarkdownFileWithMetadata[]> {
    const { vault, metadataCache } = this.app;
    const mdFiles = await Promise.all(
      vault.getMarkdownFiles().map(async (file) => ({
        ...file,
        content: await vault.cachedRead(file),
        metadata: metadataCache.getFileCache(file),
      })),
    );

    return mdFiles;
  }

  private async handlePublishAllNotes(editor: Editor, view: MarkdownView) {
    if (!this.settings?.userName || !this.settings?.githubToken || !this.settings?.repositoryName) {
      new Notice('❌ Github Authentication info is required!');
      return;
    }

    const { publishFontmatterKey } = this.settings;

    const mdForPublish = (await this.getAllMarkdowns()).filter(
      (file) => file.metadata?.frontmatter?.[publishFontmatterKey],
    );

    const publishList: PublishData[] = [];

    mdForPublish.forEach((markdown) => {
      const path = encodeURI(markdown.path.replace(' ', '_'));
      publishList.push({
        path,
        message: `Upload File: ${markdown.name}`,
        content: markdown.content,
      });
    });

    const nextraMetaMap = this.generateNextraMetadata(mdForPublish);
    Object.entries(nextraMetaMap).forEach(([key, value]) => {
      publishList.push({
        path: key,
        content: JSON.stringify(value),
        message: `Update MetaJSON: ${key}`,
      });
    });

    console.log({ publishList });
    this.publish(publishList);
  }

  private publish(publishList: PublishData[]) {
    if (!this.settings?.userName || !this.settings?.githubToken || !this.settings?.repositoryName) {
      new Notice('❌ Github Authentication info is required!');
      return;
    }
    const { userName, githubToken, repositoryName } = this.settings;

    let published = 0;
    const statusBarItemEl = this.addStatusBarItem();
    const updateStatusBar = (n: number) =>
      statusBarItemEl.setText(`Publishing to github: ${n}/${publishList.length}`);

    publishList.forEach(async (publish) => {
      // const path = encodeURI(publish.path);
      await uploadGithub({
        auth: githubToken,
        owner: userName,
        repo: repositoryName,
        ...publish,
      });

      updateStatusBar((published += 1));
      if (published === publishList.length) {
        new Notice(`${published} has published`);
        setTimeout(() => {
          statusBarItemEl.remove();
        }, 2000);
      }
    });
  }

  private generateNextraMetadata(markdownFiles: MarkdownFileWithMetadata[]) {
    const nextraMetaMap: { [key: string]: { [key: string]: string } } = {};

    markdownFiles.forEach((markdown) => {
      const ROOT_PATH = '';
      const childName = markdown.path.split('/').at(0)?.replace('.md', '');
      const path = `_meta.json`;
      if (nextraMetaMap[ROOT_PATH] === undefined) nextraMetaMap[path] = {};
      if (childName) nextraMetaMap[path][encodeURI(childName)] = childName;
    });

    markdownFiles.forEach((markdown) => {
      markdown.path.split('/').forEach((name, idx, arr) => {
        const currentPath = arr.filter((_, i) => i <= idx).join('/');
        if (!isDirectory(currentPath)) return;

        const childs = markdownFiles.filter((md) => md.path.startsWith(currentPath));
        const childNames = childs.map(
          (child) => child.path.replace(`${currentPath}/`, '').split('/').at(0)?.replace('.md', ''),
        );

        childNames.forEach((childName) => {
          const path = `${encodeURI(currentPath)}/_meta.json`;
          if (nextraMetaMap[currentPath] === undefined) nextraMetaMap[path] = {};
          if (childName) nextraMetaMap[path][encodeURI(childName)] = childName;
        });
      });
    });

    return nextraMetaMap;
  }
}
