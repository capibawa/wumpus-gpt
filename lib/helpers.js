import { dirname } from 'path';
import { fileURLToPath } from 'url';

export function getDirectoryName(meta) {
  return dirname(fileURLToPath(meta.url));
}
