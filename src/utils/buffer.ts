import { Base64 } from 'js-base64';

export const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return Base64.btoa(binary);
};

export const toBuffer = (arrayBuffer: ArrayBuffer): Buffer => {
  const buffer = Buffer.alloc(arrayBuffer.byteLength);
  const view = new Uint8Array(arrayBuffer);
  for (let i = 0; i < buffer.length; i += 1) {
    buffer[i] = view[i];
  }
  return buffer;
};
