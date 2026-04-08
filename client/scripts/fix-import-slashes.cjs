const fs = require('fs');
const path = require('path');
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

const files = walk(src);
let changed = 0;
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("from '") && !content.includes('from "')) continue;
  const updated = content.replace(/(from\s+['"])([^'"]*\\[^'"]*)(['"])/g, (m, pre, imp, post) => {
    const fixed = imp.replace(/\\/g, '/');
    return pre + fixed + post;
  }).replace(/(require\(\s*['"])([^'"]*\\[^'"]*)(['"]\s*\))/g, (m, pre, imp, post) => {
    const fixed = imp.replace(/\\/g, '/');
    return pre + fixed + post;
  });
  if (updated !== content) {
    fs.writeFileSync(file, updated, 'utf8');
    console.log('Fixed slashes in', path.relative(root, file));
    changed++;
  }
}
console.log('Done. Files changed:', changed);
