import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Theme, Color } from '@adobe/leonardo-contrast-colors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const themePath = path.join(__dirname, '../src/theme.json');
const outputPath = path.join(__dirname, '../src/spectrum-palette.json');

const themeData = JSON.parse(fs.readFileSync(themePath, 'utf-8'));

// Adobe Leonardo configuration
// We create a Theme with a base color and our brand colors
const brandColors = themeData.colors.brand;

if (!brandColors || brandColors.length === 0) {
    console.error("No brand colors found in theme.json");
    process.exit(1);
}

const leonardoBrand = new Color({
    name: 'brand',
    colorKeys: brandColors,
    colorSpace: 'CAM02',
    ratios: [1.1, 1.2, 1.3, 1.4, 1.5, 2, 3, 4.5, 7, 9, 13, 17, 21] // standard contrast ratios for scale
});

const leonardoTheme = new Theme({
    colors: [leonardoBrand],
    backgroundColor: '#ffffff',
    lightness: 100
});

// Generate colors
const generatedColors = leonardoTheme.contrastColors;

// Format the output
const spectrumInfo = [];

// Find the 'brand' color array in the output
const brandOutput = generatedColors.find(c => !!c.values)?.values || [];

// Map to simple array of hexes (from lightest/lowest ratio to darkest/highest, depending on how leonardo orders them, usually ratio)
const spectrumPalette = brandOutput.map(c => c.value);

// We want to generate an array of N colors to pick from randomly if needed, mimicking the previous CozyText arrays. 
// We will output an array of 20 colors by mathematically interpolating between the provided brand color array.
// Actually, simple and direct:
function interpolateHex(hex1, hex2, factor) {
    const hexToRgb = hex => hex.match(/\w\w/g).map(x => parseInt(x, 16));
    const rgbToHex = (r, g, b) => '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    const result = c1.map((c, i) => c + factor * (c2[i] - c));
    return rgbToHex(...result);
}

// Generate a smooth 50 color spectrum from the brand array for our specific CozyText / graph needs
function generateSmoothSpectrum(colors, count) {
    const result = [];
    const segments = colors.length - 1;
    const colorsPerSegment = Math.ceil(count / segments);

    for (let s = 0; s < segments; s++) {
        const c1 = colors[s];
        const c2 = colors[s + 1];

        for (let i = 0; i < colorsPerSegment; i++) {
            if (result.length >= count) break;
            const factor = i / colorsPerSegment;
            result.push(interpolateHex(c1, c2, factor));
        }
    }
    // Ensure last color is included if we didn't hit count precisely at the bound
    while (result.length < count) {
        result.push(colors[colors.length - 1]);
    }
    return result;
}

const spectrum50 = generateSmoothSpectrum(brandColors, 50);

const finalOutput = {
    leonardoBrandScale: spectrumPalette,
    spectrum50: spectrum50
};

fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));

console.log(`Successfully generated spectrum-palette.json with ${spectrum50.length} colors.`);

// Tailwind v4 uses CSS variables. We must inject these into index.css for @reference to work
const indexCssPath = path.join(__dirname, '../src/index.css');

let rootBlock = `\n/* Auto-generated :root by generate-palette.mjs */\n:root {\n`;
let themeBlock = `\n/* Auto-generated @theme by generate-palette.mjs */\n@theme inline {\n`;

const addVar = (name, val) => {
    rootBlock += `  --${name}: ${val};\n`;
    themeBlock += `  --color-${name}: var(--${name});\n`;
};

// 1. Core Brand & Neutral
themeData.colors.brand.forEach((hex, i) => addVar(`brand-${i + 1}`, hex));
themeData.colors.neutral.forEach((hex, i) => {
    addVar(`neutral-${i + 1}`, hex);
    if (i === 0) addVar('neutral', hex); // Default neutral
});

// 2. Semantic Colors
Object.entries(themeData.colors.semantic).forEach(([key, hex]) => {
    addVar(key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(), hex);
});

// 3. States
Object.entries(themeData.colors.states).forEach(([key, val]) => {
    addVar(key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase(), val);
});

// 4. Sidebar
Object.entries(themeData.colors.sidebar).forEach(([key, hex]) => {
    addVar(`sidebar-${key.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}`, hex);
});
// Alias: bg-sidebar needs --color-sidebar (not --color-sidebar-background)
addVar('sidebar', themeData.colors.sidebar.background);

// 5. Spectrum 50 Scale
spectrum50.forEach((hex, i) => addVar(`spectrum-${i + 1}`, hex));

rootBlock += `}\n/* End Auto-generated :root */\n`;
themeBlock += `}\n/* End Auto-generated @theme */\n`;

// 6. Fonts & Radii goes directly into a standalone @theme
let globalThemeBlock = `\n/* Auto-generated @theme fonts by generate-palette.mjs */\n@theme {\n`;
Object.entries(themeData.radii).forEach(([key, val]) => {
    globalThemeBlock += `  --radius-${key}: ${val};\n`;
    if (key === 'md') globalThemeBlock += `  --radius: ${val};\n`;
});
globalThemeBlock += `  --font-sans: ${themeData.typography.fonts.sans};\n`;
globalThemeBlock += `  --font-display: ${themeData.typography.fonts.display};\n`;
globalThemeBlock += `  --font-mono: ${themeData.typography.fonts.mono};\n`;
globalThemeBlock += `}\n/* End Auto-generated global */\n`;

// We will rewrite index.css entirely to ensure CSS cascade order is correct and no old Shadcn defaults override us.

const baseImports = `@import "tailwindcss";\n@import "tw-animate-css";\n\n@custom-variant dark (&:is(.dark *));\n`;

const baseLayer = `
/* Base layer styles */
@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground font-sans antialiased;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-display);
    @apply font-semibold tracking-tight;
  }
  code, pre, kbd {
    font-family: var(--font-mono);
  }
}

/* Subtle page fade-in animation */
@layer utilities {
  .animate-fade-in { animation: fade-in 200ms ease-out; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  .animate-collapse-down { animation: collapse-down 200ms ease-out; }
  .animate-collapse-up { animation: collapse-up 200ms ease-out; }
  @keyframes collapse-down { from { height: 0; } to { height: var(--radix-collapsible-content-height); } }
  @keyframes collapse-up { from { height: var(--radix-collapsible-content-height); } to { height: 0; } }
}

@keyframes cozy-stream {
  0% { background-position: 0% 0%; }
  100% { background-position: 0% 100%; }
}
`;

const fontFace = `
@font-face {
  font-family: 'TypeMates Cera Round Pro Bold';
  src: url('/TypeMates  Cera Round Pro Bold.otf') format('opentype');
  font-weight: bold;
  font-style: normal;
  font-display: swap;
}
`;

fs.writeFileSync(indexCssPath, baseImports + globalThemeBlock + themeBlock + rootBlock + fontFace + baseLayer);
console.log(`Successfully rewrote index.css with strict theme ordering.`);
