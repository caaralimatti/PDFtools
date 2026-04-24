import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const indexes = [
  {
    source: 'public/pdfjs-annotation-viewer/web/viewer.html',
    target: 'public/pdfjs-annotation-viewer/web/viewer/index.html',
    base: '/pdfjs-annotation-viewer/web/',
  },
  {
    source: 'public/pdfjs-viewer/viewer.html',
    target: 'public/pdfjs-viewer/viewer/index.html',
    base: '/pdfjs-viewer/',
  },
];

for (const { source, target, base } of indexes) {
  const html = await readFile(source, 'utf8');
  const withBase = html.includes('<base ')
    ? html
    : html.replace(/(<head>\s*)/i, `$1\n  <base href="${base}">`);

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, withBase);
  console.log(`Created ${join(process.cwd(), target)}`);
}
