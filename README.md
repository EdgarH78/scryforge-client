# Scryforge Client

A Foundry VTT module that enables real-time camera calibration and marker detection for enhanced virtual tabletop gaming experiences. This client module works in conjunction with the Scryforge server to provide accurate viewport calibration and marker tracking.

## Server Access

While this client module is open-source under the MIT License, it requires access to the Scryforge server for full functionality. Server access is available through a subscription service. This provides:

- Dedicated server infrastructure
- Real-time marker detection and processing
- Reliable and maintained API endpoints
- Technical support

Visit [your-website-here] to learn more about subscription options and pricing.

## Features

- Advanced viewport calibration using marker detection
- Real-time camera feed processing
- Automatic marker tracking and position adjustment
- Robust error handling and recovery
- Fine-tuning capabilities for precise calibration

## Prerequisites

- Foundry VTT (tested with version 11.x)
- Node.js (version 18 or higher)
- npm (version 9 or higher)
- A compatible webcam or camera device

## Installation

1. Clone the repository:
```bash
git clone https://github.com/EdgarH78/scryforge-client.git
cd scryforge-client
```

2. Install dependencies:
```bash
npm install
```

3. Build the module:
```bash
npm run build
```

4. Copy or symlink the built module to your Foundry VTT modules directory:
```bash
# Windows (PowerShell)
New-Item -ItemType SymbolicLink -Path "C:\Users\[YourUsername]\AppData\Local\FoundryVTT\Data\modules\scryforge" -Target ".\dist"

# Linux/MacOS
ln -s ./dist ~/.local/share/FoundryVTT/Data/modules/scryforge
```

## Development

### Building

- Development build with watch mode:
```bash
npm run dev
```

- Production build:
```bash
npm run build
```

### Testing

The project uses Vitest for testing. The following commands are available:

- Run tests:
```bash
npm test
```

- Run tests with coverage:
```bash
npm run test:coverage
```

Current test coverage:
- Statements: 91.67%
- Branches: 92.55%
- Functions: 75%
- Lines: 91.67%

### Contributing

1. Fork the repository
2. Create your feature branch:
```bash
git checkout -b feature/my-new-feature
```
3. Commit your changes:
```bash
git commit -am 'Add some feature'
```
4. Push to the branch:
```bash
git push origin feature/my-new-feature
```
5. Submit a pull request

## GitHub Setup

If you're setting up a new repository:

```bash
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/EdgarH78/scryforge-client.git
git push -u origin main
```

If you're pushing an existing repository:

```bash
git remote add origin https://github.com/EdgarH78/scryforge-client.git
git branch -M main
git push -u origin main
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Thanks to the Foundry VTT community for their support and feedback
- Special thanks to all contributors who have helped improve this module

## Creating a Release

When you're ready to release a new version of the module, follow these steps:

1. Update the version number in `module.json`:
```json
{
  "version": "1.0.0",
  // ... other fields ...
  "download": "https://github.com/EdgarH78/scryforge-client/releases/download/v1.0.0/scryforge-v1.0.0.zip"
}
```

2. Create the release package:
```bash
npm run package
```
This will:
- Build the module
- Create a zip file in the `package` directory
- Include all necessary files (dist, assets, templates, etc.)

3. Create a GitHub Release:
- Go to the [releases page](https://github.com/EdgarH78/scryforge-client/releases)
- Click "Draft a new release"
- Tag version: `v1.0.0` (matching your module.json version)
- Title: "Release v1.0.0"
- Upload the following files from the `package` directory:
  - `scryforge-v1.0.0.zip`
  - `module.json`

## Installation

### Method 1: Install via Foundry VTT
1. Open Foundry VTT
2. Go to "Add-on Modules"
3. Click "Install Module"
4. Paste the following manifest URL:
```
https://github.com/EdgarH78/scryforge-client/releases/latest/download/module.json
```

### Method 2: Manual Installation
1. Download the latest release from the [releases page](https://github.com/EdgarH78/scryforge-client/releases)
2. Extract the zip file
3. Copy the extracted folder to your Foundry VTT modules directory:
   - Windows: `%localappdata%/FoundryVTT/Data/modules/`
   - Linux: `~/.local/share/FoundryVTT/Data/modules/`
   - macOS: `~/Library/Application Support/FoundryVTT/Data/modules/`
