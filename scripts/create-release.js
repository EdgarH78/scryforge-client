const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Read the module.json file
const moduleJson = JSON.parse(fs.readFileSync('module.json', 'utf8'));
const version = moduleJson.version;
const packageName = `scryforge-v${version}.zip`;

// Create output directory if it doesn't exist
if (!fs.existsSync('package')) {
    fs.mkdirSync('package');
}

// Create a write stream
const output = fs.createWriteStream(path.join('package', packageName));
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
    const stats = fs.statSync(file);
    if (stats.isDirectory()) {
        archive.directory(file, file);
    } else {
        archive.file(file, { name: file });
    }
});

// Finalize the archive
archive.finalize();

console.log(`Creating release package: ${packageName}`);
output.on('close', function() {
    console.log(`Release package created: ${packageName}`);
    console.log(`Total bytes: ${archive.pointer()}`);
}); 