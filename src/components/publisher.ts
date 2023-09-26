import { CachedMetadata, MetadataCache, Notice, TFile, Vault, getLinkpath } from 'obsidian';
import { Octokit } from 'octokit';
import { NextraPublishSettings } from 'src/setting';
import { join, normalize, resolve } from 'path';
import { convertToUploadPath, isDirectory } from '../utils/path';
import { toBuffer } from '../utils/buffer';

export enum PublishType {
  MarkDown,
  Image,
  NextraMetadata,
}

export interface PublishData {
  path: string;
  message: string;
  content: Buffer | string;
  type: PublishType;
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
  branch: string;
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

  async uploadGithub({ auth, owner, repo, path, message, content, branch }: UploadGithubArgs) {
    console.log({ path });
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
      branch,
      sha: (existContent?.data as any)?.sha,
    });

    return response;
  }

  generateNextraMetadata(publishList: PublishData[]) {
    const nextraMetaMap: Record<string, Record<string, string>> = {};
    const filteredList = publishList.filter((publish) => publish.type === PublishType.MarkDown);

    filteredList.forEach((markdown) => {
      const childName = markdown.path.split('/').at(0)?.replace('.md', '');
      const path = '_meta.json';
      if (nextraMetaMap[path] === undefined) nextraMetaMap[path] = {};
      if (childName) nextraMetaMap[path][encodeURI(childName)] = childName;
    });

    filteredList.forEach((markdown) => {
      markdown.path.split('/').forEach((name, idx, arr) => {
        const currentPath = arr.filter((_, i) => i <= idx).join('/');
        if (!isDirectory(currentPath)) return;

        const childs = filteredList.filter((md) => md.path.startsWith(currentPath));
        const childNames = childs.map(
          (child) => child.path.replace(`${currentPath}/`, '').split('/').at(0)?.replace('.md', ''),
        );
        console.log({ currentPath, childNames });

        childNames.forEach((childName) => {
          const path = `${currentPath}/_meta.json`;
          if (nextraMetaMap[path] === undefined) nextraMetaMap[path] = {};
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

  async getAllFilesAtGithub() {
    if (!this.settings?.userName || !this.settings?.githubToken || !this.settings?.repositoryName) {
      new Notice('❌ Github Authentication info is required!');
      throw new Error('Github Authentication info is required');
    }
    const { userName, githubToken, repositoryName } = this.settings;

    const octokit = new Octokit({ auth: githubToken });

    const response = await octokit.rest.git.getTree({
      owner: userName,
      repo: repositoryName,
      tree_sha: 'HEAD',
      recursive: String(Math.ceil(Math.random() * 1000)),
    });

    return response.data.tree
      .filter((file) => file.type === 'blob' && file.path && file.sha)
      .map((file) => ({ path: String(file.path), sha: String(file.sha) }));
  }

  async deleteFileAtGithub(file: { path: string; sha: string }) {
    if (!this.settings?.userName || !this.settings?.githubToken || !this.settings?.repositoryName) {
      new Notice('❌ Github Authentication info is required!');
      throw new Error('Github Authentication info is required');
    }
    const { userName, githubToken, repositoryName } = this.settings;

    const octokit = new Octokit({ auth: githubToken });

    await octokit.rest.repos.deleteFile({
      owner: userName,
      repo: repositoryName,
      path: file.path,
      sha: file.sha,
      message: `Delete File: ${file.path}`,
    });
  }

  async getPublishImages(markdownFile: MarkdownFileWithMetadata) {
    const images = await Promise.all(
      markdownFile.metadata?.embeds?.map(async (embed) => {
        const imagePath = getLinkpath(embed.link);
        const linkedFile = this.metadataCache.getFirstLinkpathDest(imagePath, markdownFile.path);
        if (!linkedFile) return undefined;

        const imageBinary = toBuffer(await this.vault.readBinary(linkedFile));

        const name = embed.link.replaceAll(' ', '_');
        const uploadPath = `${name}`;
        const imageMarkdown = `![${embed.link}](/${uploadPath})`;
        // console.log({ uploadPath });

        const imageInfo: ImageInfo = {
          original: embed.original,
          name,
          uploadPath,
          imageMarkdown,
          imageBinary,
        };

        return imageInfo;
      }) ?? [],
    );

    return images.filter((value) => value !== undefined) as ImageInfo[];
  }

  transformPublishList(publishList: PublishData[]) {
    const { imagePublishPath, markdownPublishPath } = this.settings;

    return publishList.map(({ path, type, ...publish }) => {
      let transformedPath = encodeURI(path);

      switch (type) {
        case PublishType.Image:
          transformedPath = join(imagePublishPath, path);
          break;
        case PublishType.NextraMetadata:
        case PublishType.MarkDown:
        default:
          transformedPath = encodeURI(join(markdownPublishPath, path).replace(/\\/g, '/'));
      }

      return { path: convertToUploadPath(transformedPath.replace(/\\/g, '/')), type, ...publish };
    });
  }

  async publish(publishList: PublishData[], onPublish?: (published: number) => void) {
    if (!this.settings?.userName || !this.settings?.githubToken || !this.settings?.repositoryName) {
      new Notice('❌ Github Authentication info is required!');
      return;
    }
    const { userName, githubToken, repositoryName } = this.settings;

    const octokit = new Octokit({ auth: githubToken });
    const payload = { owner: userName, repo: repositoryName };

    const mrBranchName = Date.now().toString();
    const mainBranch = await octokit.rest.git.getRef({ ...payload, ref: `heads/main` });
    await octokit.rest.git.createRef({
      ...payload,
      ref: `refs/heads/${mrBranchName}`,
      sha: mainBranch.data.object.sha,
    });
    let published = 0;

    await Promise.all(
      publishList.map(async ({ path, ...publish }) => {
        await this.uploadGithub({
          ...payload,
          auth: githubToken,
          path,
          branch: mrBranchName,
          ...publish,
        });

        onPublish?.((published += 1));
      }),
    );

    const mergeRequest = await octokit.rest.pulls.create({
      ...payload,
      base: 'main',
      head: mrBranchName,
      title: `[${mrBranchName}] Obsidian Publish`,
      body: `This MR is Created by obsidian-nextra-publish Plugin`,
    });

    await octokit.rest.pulls.merge({
      ...payload,
      pull_number: mergeRequest.data.number,
      commit_title: `[${mrBranchName}] Merge Obsidian Publish`,
    });

    await octokit.rest.git.deleteRef({
      ...payload,
      ref: `heads/${mrBranchName}`,
    });
  }
}
