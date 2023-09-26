export const isDirectory = (path: string) => !path.includes('.');

export const convertToUploadPath = (path: string) =>
  path.startsWith('/') ? path.replace('/', '') : path;
