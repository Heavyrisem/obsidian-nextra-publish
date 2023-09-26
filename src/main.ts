import { Notice, Plugin } from 'obsidian';
import NextraPublishSettingTab, { NextraPublishSettings, DEFAULT_SETTINGS } from './setting';
import Publisher, { PublishData, PublishType } from './components/publisher';
import getClassName from './utils/className';
import { convertToUploadPath } from './utils/path';

export default class NextraPublishPlugin extends Plugin {
  settings: NextraPublishSettings;

  publisher: Publisher;

  async onload() {
    await this.loadSettings();

    this.publisher = new Publisher(this.app.vault, this.app.metadataCache, this.settings);

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
    console.log('=== PUBLISHING ===');

    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.innerHTML = 'Collecting Notes Info for Publish...';

    const mdForPublish = await this.publisher.getAllMarkdownsForPublish();

    const publishList: PublishData[] = [];

    await Promise.all(
      mdForPublish.map(async (markdown) => {
        const images = await this.publisher.getPublishImages(markdown);

        let content = String(markdown.content);
        // eslint-disable-next-line no-restricted-syntax
        for (const image of images) {
          content = content.replaceAll(image.original, image.imageMarkdown);

          const shouldPush = !publishList.some((publish) => publish.path === image.uploadPath);
          if (shouldPush) {
            publishList.push({
              path: image.uploadPath,
              message: `Upload Image: ${image.name}`,
              content: image.imageBinary,
              type: PublishType.Image,
            });
          }
        }

        publishList.push({
          path: markdown.path,
          message: `Upload File: ${markdown.name}`,
          content,
          type: PublishType.MarkDown,
        });
      }),
    );

    const nextraMetaMap = this.publisher.generateNextraMetadata(publishList);
    console.log({ nextraMetaMap });
    Object.entries(nextraMetaMap).forEach(([key, value]) => {
      publishList.push({
        path: key,
        content: JSON.stringify(value),
        message: `Update MetaJSON: ${key}`,
        type: PublishType.NextraMetadata,
      });
    });

    console.log({ publishList });
    const trnasformedPublishList = this.publisher.transformPublishList(publishList);
    console.log({ trnasformedPublishList });

    const allFilesAtGithub = await this.publisher.getAllFilesAtGithub();
    // console.log({ allFilesAtGithub });
    const shouldDeleteFiles = allFilesAtGithub.filter(
      (file) =>
        !trnasformedPublishList.some((publishFile) => file.path === publishFile.path) &&
        (file.path.startsWith(convertToUploadPath(this.settings.imagePublishPath)) ||
          file.path.startsWith(convertToUploadPath(this.settings.markdownPublishPath))),
    );
    await Promise.all(shouldDeleteFiles.map((file) => this.publisher.deleteFileAtGithub(file)));
    new Notice(`Deleted ${shouldDeleteFiles.length} Files at Github`);
    console.log({ shouldDeleteFiles });

    await this.publisher.publish(trnasformedPublishList, (published) => {
      statusBarItemEl.className = getClassName('statusBar', 'statusBar_orange');
      statusBarItemEl.setText(
        `Publishing to github: ${published}/${trnasformedPublishList.length}`,
      );
    });

    new Notice(`${trnasformedPublishList.length} has published`);
    statusBarItemEl.className = getClassName('statusBar', 'statusBar_green');
    statusBarItemEl.innerHTML = `${trnasformedPublishList.length} has published`;
    setTimeout(() => {
      statusBarItemEl.remove();
    }, 2000);
  }
}
