#!/usr/bin/env node

import fs from "fs";
import path from "path";
import Printer from "fancy-printer";
import Zip from "jszip";
import {exec} from "child_process";
import url from "url";

Printer.makeGlobal();
const zip = new Zip;
await zip.loadAsync(fs.readFileSync(path.dirname(url.fileURLToPath(import.meta.url)) + "/files.zip"));
printer.print(printer.substitute("%c?%c What is your project named? %c» ", "color: blue", "", "color: gray"));
const name = await printer.readLine();
const dir = path.join(process.cwd(), name);
if (fs.existsSync(dir)) {
    printer.raw.log("%c×%c Please provide a non-existing project name!", "color: red", "");
    process.exit();
}
fs.mkdirSync(dir);
for (const file in zip.files) {
    if (zip.files[file].dir) fs.mkdirSync(path.join(dir, file));
    else fs.writeFileSync(path.join(dir, file), await zip.files[file].async("nodebuffer"));
}
fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    name,
    description: name + " is a project made with Hizzy!",
    version: "1.0.0",
    scripts: {
        start: "npx hizzy",
        build: "npx hizzy -b",
        dev: "npx hizzy -d",
        production: "npx hizzy -d=no"
    },
    keywords: [],
    author: "",
    license: "ISC"
}, null, 2));
const run = (command, p = true) => new Promise(r => {
    const proc = exec(command);
    if (p) proc.stdout.on("data", d => process.stdout.write(d));
    proc.on("exit", r);
    proc.on("disconnect", r);
});
printer.raw.log("%c√%c Installing %c@hizzyjs/types%c for IDE intellisense...", "color: green", "", "color: orange", "");
const st = `cd "${dir}" && `;
await run(st + "npm install @hizzyjs/types", false);
fs.rmSync(path.join(dir, "package-lock.json"));
printer.raw.log("%c√%c Your project has been created at %c" + dir, "color: green", "", "color: orange");
printer.raw.log("%c√%c You can now run your project with%c npx hizzy", "color: green", "", "color: orange");