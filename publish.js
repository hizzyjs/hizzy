const fs = require("fs");
const {exec} = require("child_process");

const run = command => new Promise(r => {
    const proc = exec(command);
    proc.stdout.on("data", chunk => process.stdout.write(chunk));
    proc.on("exit", r);
    proc.on("disconnect", r);
});

(async () => {
    let printer;
    const request = async () => process.argv.includes("--yes-all") || (await printer.readLine()).toLowerCase() === "y";
    if (!fs.existsSync("node_modules")) await run("npm install");
    else {
        printer = require("fancy-printer");
        process.stdout.write("Want to update dependencies? (y/n) ");
        if (await request()) await run("npm install");
    }
    printer = require("fancy-printer");
    if (fs.existsSync("./package-lock.json")) fs.rmSync("./package-lock.json");
    const files = [
        "./api.js",
        "./hizzy.js"
    ];
    files.forEach(i => {
        if (i.endsWith(".js")) {
            const min = require("uglify-js").minify(fs.readFileSync(i, "utf8"));
            if (!min.code) throw min;
            fs.writeFileSync(i.replace(".js", ".min.js"), min.code);
        }
    });
    const indexSpl = fs.readFileSync("./hizzy.d.ts", "utf8")
        .replaceAll("\"preact", "\"react")
        .replaceAll("VNode", "ReactNode")
        .replaceAll("/hooks/src/index", "")
        .replaceAll("/hooks", "")
        .replaceAll(/\/\/[^\n]+/g, "")
        .split("/* ### TYPES ### */");
    fs.writeFileSync("./types/index.d.ts", `/*AUTO GENERATED FILE*/
${indexSpl[0]}
declare module "hizzy" {${indexSpl[1]}}`
        .replaceAll("\n", "")
        .replaceAll("\r", "")
    );
    const apiSpl = fs.readFileSync("./api.d.ts", "utf8")
        .replaceAll("\"preact", "\"react")
        .replaceAll("VNode", "ReactNode")
        .replaceAll(/\/\/[^\n]+/g, "")
        .split("/* ### TYPES ### */");
    fs.writeFileSync("./types/api.d.ts", `/*AUTO GENERATED FILE*/
${apiSpl[0]}
declare module "hizzy/api" {${apiSpl[1]}}`
        .replaceAll("\n", "")
        .replaceAll("\r", "")
    );
    const j = require("./types/package.json");
    j.version = require("./package.json").version;
    fs.writeFileSync("./types/package.json", JSON.stringify(j, null, 2));

    printer.dev = printer;
    global.__PRODUCT__ = "hizzy";
    global.__PRODUCT_U__ = "Hizzy";
    global.__VERSION__ = require("./package.json").version;
    require("./api");

    process.stdout.write("Want to publish addons? (y/n) ");
    if (await request()) {
        for (const f of fs.readdirSync("./addons")) {
            process.stdout.write("Want to publish the addon at '/addons/" + f + "'? (y/n) ");
            if (await request()) await run("cd ./addons/" + f + " && npm publish --access public");
        }
    }
    process.stdout.write("Want to publish the package? (y/n) ");
    if (await request()) await run("npm publish --access public && cd types && npm publish --access public");
})();