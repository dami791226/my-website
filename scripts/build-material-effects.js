const fs = require("node:fs");
const path = require("node:path");
const { stripTypeScriptTypes } = require("node:module");
const folder = path.resolve(__dirname, "../vendor/material-lab");
const source = fs.readFileSync(path.join(folder, "effects.ts"), "utf8");
const header = "// Adapted from Material Lab, Copyright (C) 2026 Material Lab contributors.\n// SPDX-License-Identifier: AGPL-3.0-only. See LICENSE and THIRD_PARTY_NOTICES.md.\n";
fs.writeFileSync(path.join(folder, "effects.js"), header + stripTypeScriptTypes(source, { mode: "strip" }));
