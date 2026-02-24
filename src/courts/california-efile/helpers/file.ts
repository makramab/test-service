import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Download a file from a URL to a temporary location.
 */
export async function downloadFile(
  url: string,
  filename: string,
  log: (msg: string) => void,
): Promise<string> {
  log(`Downloading file from: ${url}`);

  const tempDir = path.join(__dirname, '../../../../temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    log(`Created temp directory: ${tempDir}`);
  }

  const tempFilePath = path.join(tempDir, filename);
  const response = await axios.get(url, { responseType: 'stream' });

  const writer = fs.createWriteStream(tempFilePath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => {
      log(`File downloaded to: ${tempFilePath}`);
      resolve(tempFilePath);
    });
    writer.on('error', (error) => {
      log(`Error downloading file: ${error.message}`);
      reject(error);
    });
  });
}

/**
 * Clean up a temporary file if it exists.
 */
export function cleanupTempFile(filePath: string | null, log: (msg: string) => void): void {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    log('Temporary file deleted');
  }
}
