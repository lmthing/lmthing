import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const themePath = path.join(__dirname, '../src/theme.json');
const themeData = JSON.parse(fs.readFileSync(themePath, 'utf-8'));
const brandColors = themeData.colors.brand;

const demosPath = path.join(__dirname, '../src/demos');

let replacedCount = 0;

function processDirectory(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.json') || fullPath.endsWith('.md')) {
            let content = fs.readFileSync(fullPath, 'utf-8');
            let modified = false;

            // Simple regex to find hex colors. E.g. "#10b981"
            const hexRegex = /#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})/g;

            content = content.replace(hexRegex, (match) => {
                // If it's already one of our brand/neutral/semantic colors, leave it.
                // Otherwise replace with a random brand color.
                if (brandColors.includes(match.toLowerCase()) || match.toLowerCase() === themeData.colors.neutral[0]) {
                    return match;
                }

                // Let's just pick a random brand color
                modified = true;
                return brandColors[Math.floor(Math.random() * brandColors.length)];
            });

            if (modified) {
                fs.writeFileSync(fullPath, content);
                replacedCount++;
            }
        }
    }
}

processDirectory(demosPath);
console.log(`Replaced colors in ${replacedCount} files directly in demos folder.`);
