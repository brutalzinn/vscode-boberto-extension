const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

try {
    const root = process.cwd();

    const vsixFiles = fs
        .readdirSync(root)
        .filter(file => file.endsWith(".vsix"))
        .map(file => ({
            name: file,
            time: fs.statSync(path.join(root, file)).mtime.getTime()
        }))
        .sort((a, b) => b.time - a.time);

    if (vsixFiles.length === 0) {
        console.error("❌ No VSIX file found. Run npm run package first.");
        process.exit(1);
    }

    const latest = vsixFiles[0].name;

    console.log(`🚀 Installing ${latest}...`);

    execSync(`code --install-extension "${latest}" --force`, {
        stdio: "inherit"
    });

    console.log("✅ Extension installed successfully.");

} catch (err) {
    console.error("❌ Installation failed.");
    console.error(err.message);
    process.exit(1);
}