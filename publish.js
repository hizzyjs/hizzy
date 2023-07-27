const fs = require("fs");
const {exec} = require("child_process");
const path = require("path");

const run = command => new Promise(r => {
    const proc = exec(command);
    proc.stdout.on("data", d => process.stdout.write(d));
    proc.on("exit", r);
    proc.on("disconnect", r);
});
const D = __dirname;
const S = path.sep;
const DS = D + S;
const ED = `cd "${DS}" && `;

(async () => {
    let printer;
    const request = async () => process.argv.includes("--yes-all") || (await printer.readLine()).toLowerCase() === "y";
    if (!fs.existsSync("node_modules")) await run(ED + "npm install");
    else {
        printer = require("fancy-printer");
        process.stdout.write("Want to update dependencies? (y/n) ");
        if (await request()) await run(ED + "npm install");
    }
    printer = require("fancy-printer");
    if (fs.existsSync(DS + "package-lock.json")) fs.rmSync(DS + "package-lock.json");
    const files = [
        "api.js",
        "hizzy.js"
    ];
    files.forEach(i => {
        if (i.endsWith(".js")) {
            const min = require("uglify-js").minify(fs.readFileSync(DS + i, "utf8"));
            if (!min.code) throw min;
            fs.writeFileSync(DS + i.replace(".js", ".min.js"), min.code);
        }
    });
    const indexSpl = fs.readFileSync(DS + "hizzy.d.ts", "utf8")
        .replaceAll("\"preact", "\"react")
        .replaceAll("VNode", "ReactNode")
        .replaceAll("/hooks/src/index", "")
        .replaceAll("/hooks", "")
        .replaceAll(/\/\/[^\n]+/g, "")
        .split("/* ### TYPES ### */");
    fs.writeFileSync(DS + "types/index.d.ts", `/*AUTO GENERATED FILE*/
${indexSpl[0]}
declare module "hizzy" {${indexSpl[1]}}`
        .replaceAll("\n", "")
        .replaceAll("\r", "")
    );
    const apiSpl = fs.readFileSync(DS + "api.d.ts", "utf8")
        .replaceAll("\"preact", "\"react")
        .replaceAll("VNode", "ReactNode")
        .replaceAll(/\/\/[^\n]+/g, "")
        .split("/* ### TYPES ### */");
    fs.writeFileSync(DS + "types/api.d.ts", `/*AUTO GENERATED FILE*/
${apiSpl[0]}
declare module "hizzy/api" {${apiSpl[1]}}`
        .replaceAll("\n", "")
        .replaceAll("\r", "")
    );
    const j = require(DS + "types/package.json");
    printer.dev = printer;
    global.__PRODUCT__ = "hizzy";
    global.__PRODUCT_U__ = "Hizzy";
    global.__VERSION__ = require(DS + "package.json").version;
    j.version = __VERSION__;
    fs.writeFileSync(DS + "types/package.json", JSON.stringify(j, null, 2));

    require(DS + "api.js");

    const readdirRecursive = (dir, sub = 0, sep = S, exc = []) => {
        const obj = [];
        fs.readdirSync(dir).forEach(i => {
            if (exc.includes(i)) return;
            i = dir + sep + i;
            if (fs.statSync(i).isDirectory()) Object.assign(obj, readdirRecursive(i, sub, sep, exc));
            else obj[i.substring(sub)] = fs.readFileSync(i);
        });
        return obj;
    };

    process.stdout.write("Want to publish create-app packages? (y/n) ");
    if (await request()) {
        const Zip = require("jszip");

        const doFiles = async name => {
            const dir = DS + "addons/hizzy-init/projects/" + name;
            const files = readdirRecursive(dir, dir.length + 1, "/", ["package.json", "package-lock.json", "node_modules"]);
            const zip = new Zip;
            for (const file in files) zip.file(file, files[file]);
            fs.writeFileSync(DS + "addons/hizzy-init/dist/" + name + ".zip", await zip.generateAsync({
                type: "nodebuffer"
            }));
        };
        await doFiles("js");
        await doFiles("ts");

        const json = require(DS + "addons/hizzy-init/package.json");
        json.version = __VERSION__;
        for (const name of [
            "create-hizzy-project",
            "create-hizzy-app",
            "create-hizzy"
        ]) {
            json.name = name;
            json.bin = {
                [name]: "index.js"
            };
            fs.writeFileSync(DS + "addons/hizzy-init/package.json", JSON.stringify(json, null, 2));
            await run(ED + "cd ./addons/hizzy-init && npm publish --access public");
        }
    }
    process.stdout.write("Want to publish addons? (y/n) ");
    if (await request()) for (const f of fs.readdirSync(DS + "addons")) {
        if (f === "hizzy-init") continue;
        process.stdout.write("Want to publish the addon at '/addons/" + f + "'? (y/n) ");
        if (await request()) await run(ED + "cd ./addons/" + f + " && npm publish --access public");
    }
    process.stdout.write("Want to publish the package? (y/n) ");
    if (await request()) await run(ED + "npm publish --access public && cd types && npm publish --access public");
})();