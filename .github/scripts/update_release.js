const fs = require('fs');
const path = require('path');

const releaseFile = 'release.json';
const artifactDir = 'artifacts';

const RELEASE_TAG = process.env.RELEASE_TAG; // Passed from workflow

try {
    let releases = [];
    if (fs.existsSync(releaseFile)) {
        const data = fs.readFileSync(releaseFile, 'utf8');
        try {
            releases = JSON.parse(data);
        } catch (e) {
            console.warn("Could not parse existing release.json, starting fresh.");
        }
    }

    if (!fs.existsSync(artifactDir)) {
        console.log("No artifacts directory found. Nothing to update.");
        process.exit(0);
    }

    function findFiles(dir, filter, fileList = []) {
        const files = fs.readdirSync(dir);
        files.forEach((file) => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                findFiles(filePath, filter, fileList);
            } else if (filter.test(file)) {
                fileList.push(filePath);
            }
        });
        return fileList;
    }

    const infoFiles = findFiles(artifactDir, /^info\.json$/);

    if (infoFiles.length === 0) {
        console.log("No info.json files found.");
        process.exit(0);
    }

    infoFiles.forEach(infoPath => {
        const rawInfo = fs.readFileSync(infoPath, 'utf8');
        const info = JSON.parse(rawInfo);

        console.log(`Processing ${info.filename} (${info.version})...`);

        const version = info.version;
        const filename = info.filename;

        // Check for duplicates
        const existingIndex = releases.findIndex(r =>
            r.version === version &&
            r.arch === info.arch &&
            r.dpi === info.dpi &&
            r.variant === info.variant &&
            r.filename === filename
        );

        const newRelease = {
            ...info,
            // Use the unified release tag for the URL if available, otherwise fall back to version (legacy behavior)
            downloadUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/releases/download/${RELEASE_TAG || version}/${filename}`,
            updatedAt: new Date().toISOString()
        };

        if (existingIndex !== -1) {
            console.log(`Updating existing release entry for ${filename}`);
            releases[existingIndex] = newRelease;
        } else {
            console.log(`Adding new release entry for ${filename}`);
            releases.push(newRelease);
        }
    });

    fs.writeFileSync(releaseFile, JSON.stringify(releases, null, 2));
    console.log(`Updated ${releaseFile} with ${infoFiles.length} new entries.`);

} catch (error) {
    console.error("Error updating release.json:", error);
    process.exit(1);
}
