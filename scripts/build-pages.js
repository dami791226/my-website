const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
fs.mkdirSync(output, { recursive: true });
for (const name of ["index.html", "app.js", "styles.css"]) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}
copyDirectory(path.join(root, "assets"), path.join(output, "assets"));
fs.writeFileSync(path.join(output, "site-config.js"), "window.SITE_CONFIG = { staticPreview: true };\n");
fs.writeFileSync(path.join(output, ".nojekyll"), "");
console.log("GitHub Pages files built in dist/ (no backend or credentials).");
