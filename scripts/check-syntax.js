// 零依赖 JavaScript 语法门禁：页面脚本即使不在 Node 测试中执行，也必须能被解析。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const roots = ['miniprogram', 'scripts', 'tests'];
const files = [];

function collect(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute);
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(absolute);
  });
}

roots.forEach((directory) => collect(path.join(root, directory)));

const failures = [];
files.forEach((file) => {
  try {
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: path.relative(root, file) });
  } catch (error) {
    failures.push(`${path.relative(root, file)}: ${error.message}`);
  }
});

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`JavaScript syntax OK: ${files.length} files`);
}
