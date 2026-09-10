const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const check = process.argv.includes('--check');
for (const file of ['contracts.js', 'catalog.js']) {
  const source = fs.readFileSync(
    path.join(root, 'miniprogram/community/shared', file),
  );
  const target = path.join(root, 'cloudfunctions/community', file);
  if (check) {
    if (!fs.existsSync(target) || !source.equals(fs.readFileSync(target)))
      throw new Error(`Cloud contract out of sync: ${file}`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, source);
  }
}
console.log(
  check ? 'Community contracts match' : 'Community contracts synchronized',
);
