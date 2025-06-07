import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Read the module.json file
const moduleJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'module.json'), 'utf8'));
const version = moduleJson.version;
const packageName = `scryforge-v${version}.zip`;

// Create output directory if it doesn't exist
const packageDir = path.join(rootDir, 'package');
if (!fs.existsSync(packageDir)) {
    fs.mkdirSync(packageDir);
}

// Create a write stream
const output = fs.createWriteStream(path.join(packageDir, packageName));
const archive = archiver('zip', {
    zlib: { level: 9 } // Maximum compression
});

// Listen for warnings
archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
        console.warn(err);
    } else {
        throw err;
    }
});

// Listen for errors
archive.on('error', function(err) {
    throw err;
});

// Pipe archive data to the output file
archive.pipe(output);

// Add the required files
const filesToInclude = [
    'module.json',
    'LICENSE.txt',
    'README.md',
    'dist',
    'assets',
    'templates'
];

filesToInclude.forEach(file => {
    const filePath = path.join(rootDir, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
        archive.directory(filePath, file);
    } else {
        archive.file(filePath, { name: file });
    }
});

// Finalize the archive
archive.finalize();

console.log(`Creating release package: ${packageName}`);
output.on('close', function() {
    console.log(`Release package created: ${packageName}`);
    console.log(`Total bytes: ${archive.pointer()}`);
}); 