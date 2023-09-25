import {
  CachedMetadata,
  Editor,
  MarkdownView,
  MetadataCache,
  Notice,
  TFile,
  Vault,
  getLinkpath,
} from 'obsidian';
import { Octokit } from 'octokit';
import { NextraPublishSettings } from 'src/setting';
import { isDirectory } from '../utils/path';
import { arrayBufferToBase64, toBuffer } from '../utils/buffer';

export interface PublishData {
  path: string;
  message: string;
  content: Buffer | string;
}

interface ImageInfo {
  original: string;
  name: string;
  uploadPath: string;
  imageMarkdown: string;
  imageBinary: Buffer;
}

interface UploadGithubArgs {
  auth: string;
  owner: string;
  repo: string;
  path: string;
  message: string;
  content: Buffer | string;
}

export interface MarkdownFileWithMetadata extends TFile {
  metadata: CachedMetadata | null;
  content: string;
}

export default class Publisher {
  constructor(
    private readonly vault: Vault,
    private readonly metadataCache: MetadataCache,
    private readonly settings: NextraPublishSettings,
  ) {}

  async getAllMarkdownsForPublish(): Promise<MarkdownFileWithMetadata[]> {
    const { publishFontmatterKey } = this.settings;

    const mdFiles = await Promise.all(
      this.vault.getMarkdownFiles().map(async (file) => ({
        ...file,
        content: await this.vault.cachedRead(file),
        metadata: this.metadataCache.getFileCache(file),
      })),
    );

    return mdFiles.filter((file) => file.metadata?.frontmatter?.[publishFontmatterKey]);
  }

  async uploadGithub({ auth, owner, repo, path, message, content }: UploadGithubArgs) {
    const octokit = new Octokit({ auth });

    const existContent = await octokit.rest.repos
      .getContent({
        owner,
        repo,
        path,
      })
      .catch((err) => err);

    const base64Content = Buffer.from(content).toString('base64');

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      content: base64Content,
      message,
      sha: (existContent?.data as any)?.sha,
    });

    return response;
  }

  generateNextraMetadata(markdownFiles: MarkdownFileWithMetadata[]) {
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

  getFileUploadName(file: TFile, metadata: CachedMetadata) {
    const customName = metadata?.frontmatter?.['nextra-filename'];
    return customName ?? file.name;
  }

  async getPublishImages(markdownFile: MarkdownFileWithMetadata) {
    const images = await Promise.all(
      markdownFile.metadata?.embeds?.map(async (embed) => {
        const imagePath = getLinkpath(embed.link);
        const linkedFile = this.metadataCache.getFirstLinkpathDest(imagePath, markdownFile.path);
        if (!linkedFile) return undefined;

        const imageBinary = toBuffer(await this.vault.readBinary(linkedFile));

        const uploadPath = encodeURI(`img/${embed.link}`);
        const imageMarkdown = `![${embed.link}](${uploadPath})`;
        console.log({ imageMarkdown });

        const imageInfo: ImageInfo = {
          original: embed.original,
          name: embed.link,
          uploadPath,
          imageMarkdown,
          imageBinary,
        };

        return imageInfo;
      }) ?? [],
    );

    return images.filter((value) => value !== undefined) as ImageInfo[];
  }

  publish(publishList: PublishData[], onPublish?: (published: number) => void) {
    if (!this.settings?.userName || !this.settings?.githubToken || !this.settings?.repositoryName) {
      new Notice('❌ Github Authentication info is required!');
      return;
    }
    const { userName, githubToken, repositoryName } = this.settings;

    let published = 0;

    publishList.forEach(async (publish) => {
      await this.uploadGithub({
        auth: githubToken,
        owner: userName,
        repo: repositoryName,
        ...publish,
      });

      onPublish?.((published += 1));
    });
  }
}
