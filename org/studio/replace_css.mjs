import fs from 'fs';
import path from 'path';

const srcDir = '/home/vasilis/GEANT/lmthing/app/src';
const elementsDir = path.join(srcDir, 'css', 'elements');
const mainCssPath = path.join(srcDir, 'index.css');

function walkDir(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walkDir(file));
        } else if (file.endsWith('.css')) {
            results.push(file);
        }
    });
    return results;
}

const cssFiles = walkDir(elementsDir);
let replaced = 0;

for (const file of cssFiles) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('@import "tailwindcss";') || content.includes("@import 'tailwindcss';")) {
        const relPath = path.relative(path.dirname(file), mainCssPath).replace(/\\/g, '/');
        const newContent = content.replace(/@import\s+["']tailwindcss["'];/g, `@reference "${relPath}";`);
        fs.writeFileSync(file, newContent);
        replaced++;
        console.log(`Updated ${file} with reference to ${relPath}`);
    } else if (content.includes('@reference')) {
        // Check if it's already updated, maybe it needs a better relative path
        const relPath = path.relative(path.dirname(file), mainCssPath).replace(/\\/g, '/');
        const newContent = content.replace(/@reference\s+["'][^"']+["'];/g, `@reference "${relPath}";`);
        if (content !== newContent) {
            fs.writeFileSync(file, newContent);
            replaced++;
            console.log(`Re-updated reference in ${file} to ${relPath}`);
        }
    }
}

console.log(`Done. Replaced ${replaced} files.`);
