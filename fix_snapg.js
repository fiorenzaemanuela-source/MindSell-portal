const fs = require('fs');
const path = 'src/App.js';
let c = fs.readFileSync(path, 'utf8');

const OLD = 'const [snapS, snapL] = await Promise.all([';
const NEW = 'const [snapS, snapL, snapG] = await Promise.all([';

if (c.includes(OLD)) {
  c = c.replace(OLD, NEW);
  fs.writeFileSync(path, c);
  console.log('Done!');
} else {
  console.log('❌ not found');
}
