#!/usr/bin/env node

import fs from "fs";
import path from "path";
import chalk from "chalk";
import Zip from "jszip";
import {exec} from "child_process";
import url from "url";
import {cwd, exit, stdin, stdout} from "node:process";

const makeLogger = (c = "") => str => {
    const t = c + chalk.reset(str);
    stdout.write(t);
    return t.replaceAll(CLEAR, "").length;
}
const log = makeLogger();
log.success = makeLogger(chalk.greenBright("✓ "));
log.fail = makeLogger(chalk.redBright("× "));
log.question = makeLogger(chalk.blueBright("? "));
const run = (command, p = true) => new Promise(r => {
    const proc = exec(command);
    if (p) proc.stdout.on("data", d => stdout.write(d));
    proc.on("exit", r);
    proc.on("disconnect", r);
});
const CLEAR = /(\x1B\[38;2;\d{1,3};\d{1,3};\d{1,3}m)|(\x1B\[48;2;\d{1,3};\d{1,3};\d{1,3}m)|(\x1B\[\d+;\d+m)|(\x1B\[\d+m)/g;
const BACKSPACE = "\b \b";
const ARROW_UP = "\x1b[A";
const ARROW_DOWN = "\x1b[B";
const ARROW_RIGHT = "\x1b[C";
const ARROW_LEFT = "\x1b[D";
const HIDE = "\x1b[?25l";
const SHOW = "\x1b[?25h";
/**
 * @type {{selection: (function(*, *, number=): Promise<number>), text: (function(*, string=, RegExp=): Promise<string>)}}
 */
const ask = {
    selection: async (question, list, def = 0) => new Promise(r => {
        let current = def;
        const currTxt = () => list.map((i, j) => current === j ? chalk.underline(chalk.blueBright(chalk.bold(i))) : i).join(` ${chalk.gray("/")} `);
        const len1 = log.question(question);
        let len2 = log(currTxt());
        stdin.resume();
        stdin.setRawMode(true);
        log(HIDE);
        const end = s => {
            stdin.setRawMode(false);
            stdin.pause();
            stdin.off("data", fn);
            log(SHOW + ARROW_LEFT.repeat(len1 + len2) + s);
            r(current);
        };
        let fn;
        stdin.on("data", fn = text => {
            if (!(text instanceof Buffer)) return;
            const str = text.toString();
            if (text.length === 1 && text[0] === 0x3) {
                end(chalk.redBright("×"));
                return exit();
            }
            if (text.length === 1 && text[0] === 0xd) return end(chalk.greenBright("✓") + "\n");
            if (str === ARROW_LEFT) current--;
            else if (str === ARROW_RIGHT || str === "\t") current++;
            else return;
            if (current < 0) current = list.length - 1;
            if (current > list.length - 1) current = 0;
            log(BACKSPACE.repeat(len2));
            len2 = log(currTxt());
        });
    }),
    text: async (question, def = "", regex = /[a-zA-Z\d ]/) => new Promise(r => {
        const len = log.question(question);
        const defClear = def.replaceAll(CLEAR, "");
        const defLen = defClear.length;
        const defTxt = def + ARROW_LEFT.repeat(defLen);
        log(defTxt + SHOW);
        stdin.resume();
        stdin.setRawMode(true);
        let content = "";
        let cursor = -1;
        const end = s => {
            stdin.setRawMode(false);
            stdin.pause();
            if (content.length === 0) log(content = defClear);
            log(ARROW_LEFT.repeat(len + content.length) + s);
            stdin.off("data", fn);
            r(content);
        };
        let fn;
        stdin.on("data", fn = text => {
            if (!(text instanceof Buffer)) return;
            const str = text.toString();
            if (text.length === 1 && text[0] === 0x3) {
                end(chalk.redBright("×"));
                return exit();
            }
            if (text.length === 1 && text[0] === 0xd) return end(chalk.greenBright("✓") + "\n");
            if (text.length === 1 && (text[0] === 0x8 || text[0] === 0x7f)) {
                const cl = content.length;
                const cn = cl - 1 - cursor;
                content = content.substring(0, cursor) + content.substring(cursor + 1);
                cursor--;
                if (cursor < -1) cursor = -1;
                log(" ".repeat(cn) + BACKSPACE.repeat(cl) + content + ARROW_LEFT.repeat(content.length - cursor - 1));
                if (content.length === 0) log(defTxt);
                return;
            }
            if ([ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT].includes(str)) {
                if (str === ARROW_LEFT) cursor--;
                else if (str === ARROW_RIGHT) cursor++;
                else return;
                if (cursor > content.length - 1) return cursor = content.length - 1;
                if (cursor < -1) return cursor = -1;
                log(str);
                return;
            }
            let typed = "";
            for (let i = 0; i < text.length; i++) {
                const c = String.fromCharCode(text[i]);
                if (regex.test(c)) typed += c;
            }
            if (!typed) return;
            const beforeLen = content.length;
            log(typed);
            const rest = content.substring(cursor + 1);
            log(rest);
            log(ARROW_LEFT.repeat(rest.length));
            content = content.substring(0, cursor + 1) + typed + content.substring(cursor + 1);
            cursor++;
            if (beforeLen === 0 && content.length > 0 && content.length < defLen)
                log(" ".repeat(defLen - content.length) + ARROW_LEFT.repeat(defLen - content.length));
        });
    })
};

const name = await ask.text(
    "What is your project named? " + chalk.gray("» "), chalk.gray("my-app")
);
const hasTS = await ask.selection(
    "Would you like to use " + chalk.blueBright("TypeScript") + "? " + chalk.gray("» "),
    ["No", "Yes"], 0
);
const hasTailwindCSS = await ask.selection(
    "Would you like to use " + chalk.blueBright("Tailwind CSS") + "? " + chalk.gray("» "),
    ["No", "Yes"], 0
);
const initGit = await ask.selection(
    "Would you like to initialize " + chalk.blueBright("git") + "? " + chalk.gray("» "),
    ["No", "Yes"], 0
);
const hasHizzy = await ask.selection(
    "Would you like to install the " + chalk.blueBright("hizzy") + " for intellisense? " + chalk.gray("» "),
    ["No", "Yes"], 1
);

const packages = [];
if (hasHizzy) packages.push("hizzy");
if (hasTS) packages.push("@types/react");
if (hasTailwindCSS) packages.push("tailwindcss", "postcss");
if (packages.length) {
    const customizeInstaller = await ask.selection(
        "Would you like to customize the " + chalk.blueBright("default installer(npm)") + "? " + chalk.gray("» "),
        ["No", "Yes"], 0
    );
    let installer = "npm";
    if (customizeInstaller) installer = await ask.text(
        "What " + chalk.blueBright("installer") + " would you like to be used? " + chalk.gray("» "), chalk.gray("npm")
    );
}

const startTime = Date.now();

// const file = ["js", "twjs", "ts", "twts"][(hasTS << 1) + hasTailwindCSS];
const file = ["js", "ts"][hasTS];
const zip = new Zip;
await zip.loadAsync(fs.readFileSync(path.dirname(url.fileURLToPath(import.meta.url)) + "/dist/" + file + ".zip"));
const dir = path.join(cwd(), name);
if (fs.existsSync(dir)) {
    printer.fail("Please provide a non-existing project name!");
    exit();
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
const st = `cd "${dir}" && `;
if (hasTailwindCSS) {
    fs.writeFileSync(path.join(dir, "tailwind.config.js"), `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {},
  },
  plugins: [],
}`);
    fs.writeFileSync(path.join(dir, "postcss.config.js"), `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`);
}
if (packages.length) {
    const start = Date.now();
    log("\n");
    await run(st + "npm install -D " + packages.join(" "), false);
    log.success("Installed packages: " + packages.map(i => chalk.blueBright(i)).join(", ") + " in " + chalk.greenBright((Date.now() - start) / 1000 + "s") + "\n\n");
}
if (initGit) {
    const start = Date.now();
    await run(st + "git init", false);
    log.success("Initialized a git repository in " + chalk.greenBright((Date.now() - start) / 1000 + "s") + "\n\n");
}
fs.rmSync(path.join(dir, "package-lock.json"));
log.success("Your project has been created at " + chalk.greenBright(dir) + " in " + chalk.greenBright((Date.now() - startTime) / 1000 + "s") + "\n\n");
log.success("You can now run your project by first typing " + chalk.greenBright(`cd ${name}`) + " to enter your project's directory, then typing " + chalk.greenBright("npx hizzy") + " to start your project!\n");