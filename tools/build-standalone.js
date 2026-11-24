/* 把 index.html + css + js 打包成一个可以直接发给别人的 HTML */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const out = path.resolve(root, '..', 'AdmitLab-单文件版.html');

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => '<style>\n' + css + '\n</style>');

['data', 'core', 'radar', 'app'].forEach((name) => {
  const js = fs.readFileSync(path.join(root, 'js', name + '.js'), 'utf8');
  const tag = '<script src="js/' + name + '.js" defer></script>';
  if (html.indexOf(tag) < 0) throw new Error('找不到脚本标签: ' + tag);
  html = html.replace(tag, () => '<script>\n' + js + '\n</script>');
});

if (/<script src="js\//.test(html) || /href="css\//.test(html)) {
  throw new Error('还有没内联的资源');
}
fs.writeFileSync(out, html, 'utf8');
console.log('written ' + out + ' (' + Math.round(html.length / 1024) + ' KB)');
