const fs = require('fs');

// Fix index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com[^>]*><\/script>/, '');
html = html.replace(/<script>\s*tailwind\.config[\s\S]*?<\/script>/, '');
fs.writeFileSync('index.html', html);

// Fix __root.jsx
let rootJsx = fs.readFileSync('src/routes/__root.jsx', 'utf8');
const configIndex = rootJsx.indexOf('const TW_CONFIG');
if (configIndex > -1) {
    const endTick = rootJsx.indexOf('`', rootJsx.indexOf('`', configIndex) + 1);
    if (endTick > -1) {
        rootJsx = rootJsx.substring(0, configIndex) + rootJsx.substring(endTick + 1);
    }
}
rootJsx = rootJsx.replace(/\{\s*src:\s*"https:\/\/cdn\.tailwindcss\.com[^"]*"\s*\},?/, '');
rootJsx = rootJsx.replace(/\{\s*children:\s*TW_CONFIG\s*\},?/, '');
fs.writeFileSync('src/routes/__root.jsx', rootJsx);

console.log('Cleanup complete');
