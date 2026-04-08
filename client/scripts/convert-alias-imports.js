import fs from 'fs';
import path from 'path';

const __dirname = path.dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'src');

function walk(dir) {
  const files = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      files.push(...walk(p));
    } else if (/\.(ts|tsx|js|jsx)$/.test(name)) {
      files.push(p);
    }
  }
  return files;
}

function convertImport(file, content) {
  // match import ... from '@/...'
  return content.replace(/(from\s+['\"])@\/(.+?)['\"]/g, (m, pre, imp) => {
    const target = path.join(src, imp);
    let rel = path.relative(path.dirname(file), target);
    if (!rel.startsWith('.')) rel = './' + rel;
    rel = rel.replace(/\\\\/g, '/');
    return `${pre}${rel}'`;
  }).replace(/(require\(['\"])@\/(.+?)['\"]\)/g, (m, pre, imp) => {
    const target = path.join(src, imp);
    let rel = path.relative(path.dirname(file), target);
    if (!rel.startsWith('.')) rel = './' + rel;
    rel = rel.replace(/\\\\/g, '/');
    return `${pre}${rel}')`;
  });
}

const files = walk(src);
let changed = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes("@/")) continue;
  const updated = convertImport(file, content);
  if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Updated', path.relative(root, file));
    changed++;
  }
}
console.log('Done. Files changed:', changed);
