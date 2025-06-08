import * as fs from 'fs';
import * as path from 'path';

function copyDir(src, dest) {
    // Create destination directory if it doesn't exist
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }

    // Read source directory
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            // Recursively copy subdirectories
            copyDir(srcPath, destPath);
        } else {
            // Copy files
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

// Copy assets directory
const assetsSource = path.join(process.cwd(), 'assets');
const assetsDest = path.join(process.cwd(), 'dist', 'assets');

if (fs.existsSync(assetsSource)) {
    console.log('Copying assets...');
    copyDir(assetsSource, assetsDest);
    console.log('Assets copied successfully!');
} else {
    console.log('No assets directory found.');
}

// Copy module.json
const moduleSource = path.join(process.cwd(), 'module.json');
const moduleDest = path.join(process.cwd(), 'dist', 'module.json');

if (fs.existsSync(moduleSource)) {
    console.log('Copying module.json...');
    fs.copyFileSync(moduleSource, moduleDest);
    console.log('module.json copied successfully!');
} else {
    console.log('No module.json found.');
}

// Copy templates directory if it exists
const templatesSource = path.join(process.cwd(), 'templates');
const templatesDest = path.join(process.cwd(), 'dist', 'templates');

if (fs.existsSync(templatesSource)) {
    console.log('Copying templates...');
    copyDir(templatesSource, templatesDest);
    console.log('Templates copied successfully!');
} else {
    console.log('No templates directory found.');
} 