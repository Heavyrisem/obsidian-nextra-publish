import { Notice, Plugin } from 'obsidian';
import NextraPublishSettingTab, { NextraPublishSettings, DEFAULT_SETTINGS } from './setting';
import Publisher, { PublishData } from './components/publisher';

export default class NextraPublishPlugin extends Plugin {
  settings: NextraPublishSettings;

  publisher: Publisher;

  async onload() {
    await this.loadSettings();

    this.publisher = new Publisher(this.app.vault, this.app.metadataCache, this.settings);

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

  async handlePublishAllNotes() {
    if (!this.settings?.userName || !this.settings?.githubToken || !this.settings?.repositoryName) {
      new Notice('❌ Github Authentication info is required!');
      return;
    }

    const mdForPublish = await this.publisher.getAllMarkdownsForPublish();

    const publishList: PublishData[] = [];

    await Promise.all(
      mdForPublish.map(async (markdown) => {
        const images = await this.publisher.getPublishImages(markdown);

        let content = String(markdown.content);
        // eslint-disable-next-line no-restricted-syntax
        for (const image of images) {
          content = content.replace(image.original, image.imageMarkdown);
          publishList.push({
            path: image.uploadPath,
            message: `Upload Image: ${image.name}`,
            content: image.imageBinary,
          });
        }

        publishList.push({
          path: encodeURI(markdown.path),
          message: `Upload File: ${markdown.name}`,
          content,
        });
      }),
    );

    console.log(mdForPublish);

    const nextraMetaMap = this.publisher.generateNextraMetadata(mdForPublish);
    Object.entries(nextraMetaMap).forEach(([key, value]) => {
      publishList.push({
        path: key,
        content: JSON.stringify(value),
        message: `Update MetaJSON: ${key}`,
      });
    });

    console.log({ publishList });

    const statusBarItemEl = this.addStatusBarItem();
    this.publisher.publish(publishList, (published) => {
      statusBarItemEl.setText(`Publishing to github: ${published}/${publishList.length}`);

      if (published === publishList.length) {
        new Notice(`${published} has published`);
        setTimeout(() => {
          statusBarItemEl.remove();
        }, 2000);
      }
    });
  }
}
