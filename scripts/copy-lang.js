import fs from 'fs';
import path from 'path';

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
}

// Copy all files from lang to dist
const langFiles = fs.readdirSync('lang');
langFiles.forEach(file => {
    fs.copyFileSync(
        path.join('lang', file),
        path.join('dist', file)
    );
    console.log(`Copied ${file} to dist/`);
});

// Copy module.json to dist
fs.copyFileSync('module.json', 'dist/module.json');
console.log('Copied module.json to dist/'); 