import { CachedMetadata, TFile } from 'obsidian';
import { Octokit } from 'octokit';

interface UploadGithubArgs {
  auth: string;
  owner: string;
  repo: string;
  path: string;
  message: string;
  content: Buffer | string;
}
export const uploadGithub = async ({
  auth,
  owner,
  repo,
  path,
  message,
  content,
}: UploadGithubArgs) => {
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
};

export const getFileUploadName = (file: TFile, metadata: CachedMetadata) => {
  const customName = metadata?.frontmatter?.['nextra-filename'];
  return customName ?? file.name;
};
