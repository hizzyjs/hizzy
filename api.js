// noinspection JSUnusedGlobalSymbols,ExceptionCaughtLocallyJS,JSPotentiallyInvalidConstructorUsage

const random = () => crypto.getRandomValues(new BigUint64Array([0n]))[0].toString(36);

const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const http = require("http");
const path = require("path");
const mime = require("mime");
const os = require("os");
const {exec} = require("child_process");
const {stdin} = process;
const {EventEmitter} = require("events");
const WS = require("ws");
const open = require("open");
const babel = require("@babel/core");
const babelParser = require("@babel/parser");
const babelGenerator = require("@babel/generator");
const traverse = require("@babel/traverse").default;
const printer = require("fancy-printer");
const esbuild = require("esbuild");
const minify = {
    js: (...r) => require("uglify-js").minify(...r).code,
    css: (...r) => require("csso").minify(...r).css,
    html: (...r) => require("html-minifier-terser").minify(...r)
};
const xss = require("xss");
const url = require("url");
const exit = (...msg) => {
    printer.dev.error(...msg);
    process.exit(1);
};
process.on("exit", () => {
    if (global.Hizzy) {
        const addons = Hizzy.getAddons && Hizzy.getAddons();
        for (const i in addons) addons[i].module.disable("termination");
    }
});
process.on("SIGINT", () => {
    process.exit(0);
});
process.on("uncaughtException", error => {
    printer.dev.error(error);
    process.exit(1);
});
const isTerminal = require.main.filename === path.join(__dirname, "hizzy.js") || require.main.filename === path.join(__dirname, "hizzy.min.js");
let hizzy = {};
const hizzyPath = path.join(__dirname, "hizzy.js");
const hizzyMinPath = path.join(__dirname, "hizzy.min.js");
if (isTerminal) hizzy = require(fs.existsSync(hizzyPath) ? hizzyPath : hizzyMinPath);
const {args: argv, config} = hizzy;
const staticJSON = JSON.stringify(config?.static);

// todo: a playground in the web page, update: idk if i will do this, this requires a sandbox server, i might use something like repl.it or glitch.com
// no-odo: variable transaction? bad idea, just use functions to move them around
// todo: test it on mac
// todo: add a package that installs example projects: npx @hizzyjs/example example-name-here

const runtimeId = random();
const pack = s => {
    /*if(typeof s === "bigint") return `\x00\x00${s.toString()}`;
    if(typeof s === "function") return `\x00\x01${s.toString()}`;*/
    return JSON.stringify(s); // todo: sophisticated packing; date, bigint, function or objects/arrays including these
};
const EVERYONE = f => {
    if (!f["__FUNCTION__"]) throw new Error("EVERYONE function only allows client-sided functions!");
    const cl = [];
    const toCl = TO_CLIENTS(f)(cl);
    return async (...a) => {
        cl.length = 0;
        cl.push(...Hizzy.clientUUIDs());
        return await toCl(...a);
    }
};
const TO_CLIENTS = f => {
    if (!f["__FUNCTION__"]) throw new Error("TO_CLIENTS function only allows client-sided functions!");
    return clients => {
        return async (...a) => {
            const res = {};
            for (const uuid of clients)
                res[uuid] = (await makeClientFunction(f["__FUNCTION__FILE__"], f["__FUNCTION__"], typeof uuid === "string" ? uuid : uuid.uuid, f["__FROM__"]))(...a);
            return res;
        };
    }
};
Object.defineProperty(Function.prototype, "everyone", {
    get: function () {
        return EVERYONE(this);
    }
});
Object.defineProperty(Function.prototype, "toClients", {
    get: function () {
        return TO_CLIENTS(this);
    }
});
const makeClientFunction = (file, name, uuid = null, fromFunction = null) => {
    file = path.join(file);
    const fJ = JSON.stringify(file);
    const f = async (...a) => {
        if (uuid === null) throw new Error("This client-sided function wasn't assigned to any clients! Although you can still use the function with the '.everyone' property of this function!");
        const hash = Hizzy.getHash(uuid);
        return await Hizzy.sendEvalTo(uuid, fromFunction ?
            `args=${JSON.stringify(a)};__hizzy_run${hash}__2["${fromFunction}"]("${name}(...args)")` :
            `args=${JSON.stringify(a)};__hizzy_run${hash}__[${fJ}].normal.${name}(...args)` // old fashion way
        );
    };
    f.__FUNCTION__ = name;
    f.__FUNCTION__FILE__ = file;
    f.__FUNCTION__FILE_J__ = fJ;
    f.__FROM__ = fromFunction;
    // f.everyone = EVERYONE(f);
    return f;
};
const makeBeginCode = (uuid, clientFunctions, fJ, fromFunction = null) => clientFunctions.map(i => `const ${i} = Hizzy.makeClientFunction(${fJ}, ${JSON.stringify(i)}, ${JSON.stringify(uuid)}, "${fromFunction}");`).join("");

const {CLIENT2SERVER, SERVER2CLIENT} = {
    CLIENT2SERVER: {
        HANDSHAKE_RESPONSE: "0", // agreed on shaking the hand
        CLIENT_FUNCTION_RESPONSE: "1", // the response got from running a client-sided function
        SERVER_FUNCTION_REQUEST: "2", // requested to run a function with the @server decorator
        KEEPALIVE: "3", // keep alive packet
        "0": "HANDSHAKE_RESPONSE",
        "1": "SERVER_FUNCTION_REQUEST",
        "2": "CLIENT_FUNCTION_RESPONSE",
        "3": "KEEPALIVE"
    },
    SERVER2CLIENT: {
        FILE_REFRESH: "0", // requests to refresh the page, so it can load the new contents
        HANDSHAKE_REQUESTED: "1", // requests handshake
        CLIENT_FUNCTION_REQUEST: "2", // requested to run a client-sided function
        SERVER_FUNCTION_RESPONSE: "3", // the response got from running a function with the @server decorator
        SURE_HANDSHAKE: "4", // server agreed on shaking the hand as well, what a friendship!
        PAGE_PAYLOAD: "5",
        "0": "FILE_REFRESH",
        "1": "HANDSHAKE_REQUESTED",
        "2": "CLIENT_FUNCTION_REQUEST",
        "3": "SERVER_FUNCTION_RESPONSE",
        "4": "SURE_HANDSHAKE",
        "5": "PAGE_PAYLOAD"
    }
};
const fx = (a, b) => {
    a = a.toString();
    const spl = a.split(".");
    let d = spl[1] || "";
    if (d.length > b) d = d.substring(0, b);
    return spl[0] + (d ? "." + d : "");
};
const timeForm = ms => {
    if (ms >= 24 * 60 * 60 * 1000) return fx(ms / 24 / 60 / 60 / 1000, 3) + "d";
    if (ms >= 60 * 60 * 1000) return fx(ms / 60 / 60 / 1000, 3) + "h";
    if (ms >= 60 * 1000) return fx(ms / 60 / 1000, 3) + "m";
    if (ms >= 1000) return fx(ms / 1000, 3) + "s";
    return ms + "ms";
};

const ck = "__" + __PRODUCT__ + "__";
const jsOpt = {
    mangle: {toplevel: true},
    module: true
};
const HIZZY_EXPERIMENTAL = process.argv.includes("--injections");
let experimentalId = Date.now().toString(36);
let jsxInjection, htmlInjection, preactCode, preactHooksCode;
const generateInjections = async () => {
    try {
        const t = Date.now();
        jsxInjection = minify.js(fs.readFileSync(path.join(__dirname, "injections/jsx.js"), "utf8"), jsOpt);
        fs.writeFileSync(path.join(__dirname, "injections/jsx.min.js"), jsxInjection);
        htmlInjection = minify.js(fs.readFileSync(path.join(__dirname, "injections/html.js"), "utf8")
            .replace("$CKL", ck.length + 1 + "")
            .replaceAll("$CK", ck), jsOpt);
        fs.writeFileSync(path.join(__dirname, "injections/html.min.js"), htmlInjection);
        preactCode = (await (await fetch("https://esm.sh/stable/preact/es2022/preact.mjs")).text())
            .replace("sourceMappingURL", "");
        fs.writeFileSync(path.join(__dirname, "injections/preact.min.js"), preactCode); // todo: update 2022 to 2023(or 2024) when needed
        preactHooksCode = (await (await fetch("https://esm.sh/stable/preact/es2022/hooks.js")).text())
                .replace("sourceMappingURL", "")
                .replace(/"\/stable\/preact@(\d.?)+\/es2022\/preact\.mjs"/, `"./__${__PRODUCT__}__preact__"`) +
            `\nimport *as React from "./__${__PRODUCT__}__preact__"; export{React}`;
        fs.writeFileSync(path.join(__dirname, "injections/hooks.min.js"), preactHooksCode);
        fs.writeFileSync(path.join(__dirname, "injections/.last"), experimentalId);
        const sT = Date.now() - t;
        printer.dev.pass("Injections have been minified. (%c" + timeForm(sT) + "&t)", "color: orange");
    } catch (e) {
        printer.dev.fail("Couldn't compile the injections!");
        printer.dev.error(e);
    }
};
if (HIZZY_EXPERIMENTAL) generateInjections().then(r => r);
else {
    jsxInjection = fs.readFileSync(path.join(__dirname, "injections/jsx.min.js"), "utf8");
    htmlInjection = fs.readFileSync(path.join(__dirname, "injections/html.min.js"), "utf8");
    preactCode = fs.readFileSync(path.join(__dirname, "injections/preact.min.js"), "utf8");
    preactHooksCode = fs.readFileSync(path.join(__dirname, "injections/hooks.min.js"), "utf8");
    experimentalId = fs.readFileSync(path.join(__dirname, "injections/.last"), "utf8");
}

const interfaces = os.networkInterfaces();
const addresses = [];
for (const interfaceName in interfaces) {
    const iFace = interfaces[interfaceName];
    for (const alias of iFace) if (alias.family === "IPv4" && !alias.internal) addresses.push(alias.address);
}
const ideaCmd = {win32: "idea64.exe", darwin: "idea"}[os.platform()] || "idea.sh";
const phpStormCmd = {win32: "phpstorm64.exe", darwin: "phpstorm"}[os.platform()] || "phpstorm.sh";
const webStormCmd = {win32: "webstorm.exe", darwin: "webstorm"}[os.platform()] || "webstorm.sh";

const codeAtCache = {};
const runCodeAt = async (code, at) => {
    const k = at + "\x00" + code;
    if (codeAtCache[k]) return codeAtCache[k];
    at += random() + ".mjs";
    fs.writeFileSync(at, code);
    let res;
    try {
        res = {success: true, result: await import(url.pathToFileURL(at))};
    } catch (e) {
        res = {success: false, result: e};
    }
    fs.rmSync(at);
    return codeAtCache[k] = res;
};
const runCodeAtSpecial = async (code, args, at) => await runCodeAt(`export default async (${args.join(",")}) => {${code}}`, at);

class Client {
    static clients = {};
    __socket;
    class = Client;
    attributes = {};
    routes = {};

    constructor(socket) {
        if (Client.clients[socket._uuid]) return Client.clients[socket._uuid];
        this.__socket = socket;
        Client.clients[socket._uuid] = this;
    };

    get uuid() {
        return this.__socket._uuid;
    };

    get ip() {
        return this.__socket._req.ip;
    };

    get request() {
        return this.__socket._req;
    };

    get actualRequest() {
        return this.__socket._actualReq;
    };

    async eval(code) {
        return await API.API.sendEvalTo(this.uuid, code);
    };

    remove(reason = "forced") {
        this.__socket._close(reason);
    };

    run(file, name, ...args) {
        return makeClientFunction(file, name, this.uuid)(...args);
    };
}

class Addon {
    static addons = {};
    #name;
    #options;
    #module;
    #init = false;

    static async create(name, options) {
        const p = new Addon(name, options);
        await p.init();
        return p;
    };

    constructor(a, options) {
        const name = a instanceof AddonModule ? a.name : a;
        if (Addon.addons[name]) return Addon.addons[name];
        if (a instanceof AddonModule) {
            this.#init = true;
            this.#module = a;
            printer.dev.pass("Loaded addon: %c" + this.#module.name + "@" + this.#module.version, "color: blue");
        }
        this.#name = name;
        this.#options = options;
    };

    async init() {
        const t = Date.now();
        let {name} = this;
        Addon.addons[name] = this;
        if (this.#init) return;
        this.#init = true;
        try {
            let pkgPath = path.join(Hizzy.directory, "node_modules", name, "package.json");
            /*
            if (HIZZY_EXPERIMENTAL && name.startsWith("@hizzyjs/")) {
                name = path.join(__dirname, "addons", name.substring(6));
                pkgPath = path.join(name, "package.json");
                name = url.pathToFileURL(name).href;
            }*/
            if (!fs.existsSync(pkgPath) || !fs.statSync(pkgPath).isFile()) {
                printer.dev.fail("No package.json found for the addon %c" + name + "&t. Try installing it by using%c npm install " + name + "&t", "color: orange", "color: orange");
                throw "";
            }
            const cont = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
            this.#module = new (await import(url.pathToFileURL(path.join(Hizzy.directory, "node_modules", name, cont.main)))).default(cont, this.#options);
        } catch (e) {
            printer.dev.fail("Failed to require addon: %c" + this.name + "&t, disabling it...", "color: orange");
            printer.dev.error(e);
            delete Addon.addons[name];
            return;
        }
        if (typeof this.#module.onLoad === "function") this.#module.onLoad();
        const dt = Date.now() - t;
        printer.dev.pass("Loaded addon: %c" + this.#module.name + "@" + this.#module.version + " &t(%c" + timeForm(dt) + "&t)", "color: blue", "color: orange");
    };

    get options() {
        return this.#options;
    };

    get name() {
        return this.#name;
    };

    get module() {
        return this.#module;
    };
}

class AddonModule {
    #pkg;
    #options;

    constructor(pkg, options) {
        this.#pkg = pkg;
        this.#options = options;
    };

    get name() {
        return this.#pkg.name;
    };

    get description() {
        return this.#pkg.description;
    };

    get version() {
        return this.#pkg.version;
    };

    get options() {
        return this.#options;
    };

    onLoad() {
    };

    onEnable() {
    };

    onDisable(reason) {
    };

    onClientSideLoad = "";

    onClientSideRendered = "";

    onClientSideError = "";

    disable(reason) {
        printer.dev[reason ? "fail" : "debug"]("Disabling addon %c" + this.name + "&t" + (reason ? " for " + reason : "") + "...", "color: orange");
        this.onDisable();
    };

    log(...s) {
        printer.dev.log("[" + this.constructor.name + "] ", ...s);
    };
}

class API extends EventEmitter {
    /*** @type {API | null} */
    static API = null;
    Addon = Addon;
    Client = Client;
    AddonModule = AddonModule;
    #listening = false;
    #realtime = false;
    #isBuilding = false;
    #isScanningBuild = false;
    #dir;
    #buildCache = null;
    #buildPromise = new Promise(r => r());
    #builtAt = null;
    #buildRuntimeId = null;
    #scanPromise = new Promise(r => r());
    #webUUIDs = {};
    #clients = {};
    #jsxCache = {};
    #jsxFunctions = {};
    #port = -1;
    #https = config.https;
    #serverAddress;
    #evalId = 0;
    #evalResponses = {};
    #isInputOn = false;
    #hashes = {};
    #initFunctions = [];
    #importMap = {};
    #watchingFiles = {};
    #isInit = false;
    #uuidTimeout = {};
    #builtJSXCache = {};
    #builtJSXPage = {};
    #clientPages = {};
    #firstBuild = true;
    #firstScan = true;
    #addonCache = null;
    #globalStates = new Map;
    #startPacket = {};
    #mainDoneCb = {};
    server;
    socketServer;
    autoRefresh = false;
    dev = false;
    customShortcuts = {};
    preRequests = [];
    preRawSend = [];
    buildHandlers = {};
    scanHandlers = {};
    functionDecorators = {};
    preFileHandlers = {};
    filePacketHandlers = {};

    constructor(dir) {
        if (API.API) return API.API;
        super();
        API.API = this;
        this.#dir = dir;
        const app = this.app = require("express")();
        app.disable("x-powered-by");
        this.server = (this.#https ? https : http).createServer(app);
    };

    async init() {
        if (this.#isInit) return;
        this.#isInit = true;
        this.app.use(async (req, res, next) => {
            // if (!req.headers.referer) return res.send("Made with Hizzy!");
            res.setHeader("X-Powered-By", "Hizzy");
            const uuid = this.getCookie(req.headers.cookie, ck);
            const socket = this.#clients[uuid];
            printer.dev.debug("request: " + req.url + ", method: " + req.method + ", ip: " + (req.ip.startsWith("::ffff:") ? req.ip.substring(7) : req.ip));
            if (!this.dev && (this.#isBuilding || this.#isScanningBuild)) return res.send("Building, please be patient.<script>setTimeout(()=>location.reload(),1000)</script>");
            let l = req.url.split("?")[0].split("#")[0];
            if (l[0] !== "/") return;
            l = l.substring(1);
            req.__socket = socket;
            req._uuid = uuid;
            if (socket) socket._req = req;
            if (socket && l === runtimeId + `/__${__PRODUCT__}__addons__`) {
                const cache = config.cache["addons"] * 1;
                if (cache && cache > 0) res.setHeader("Cache-Control", "max-age=" + cache);
                await this.sendRawFile(".json", this.#addonCache, req, res);
                return;
            }
            if (socket && l.includes("/") && l.split("/")[0] === `__${__PRODUCT__}__npm__`) {
                const cache = config.cache["npm"] * 1;
                if (cache && cache > 0) res.setHeader("Cache-Control", "max-age=" + cache);
                const name = l.split("/")[2];
                if (!name) return;
                if (!this.#importMap[name]) return this.sendRawFile(".js", `throw "Module not found: ${JSON.stringify(name)}"`, req, res);
                await this.sendRawFile(".js", this.#importMap[name].code, req, res);
                return;
            }
            if (socket && l === experimentalId + "/__" + __PRODUCT__ + "__preact__") {
                const cache = config.cache["preact"] || 0;
                if (cache && cache > 0) res.setHeader("Cache-Control", "max-age=" + cache);
                await this.sendRawFile(".js", preactCode, req, res);
                return;
            }
            if (socket && l === experimentalId + "/__" + __PRODUCT__ + "__preact__hooks__") {
                // noinspection PointlessArithmeticExpressionJS
                const cache = config.cache["preact-hooks"] || 0;
                if (cache && cache > 0) res.setHeader("Cache-Control", "max-age=" + cache);
                await this.sendRawFile(".js", preactHooksCode, req, res);
                return;
            }
            if (this.#webUUIDs[uuid] && !socket && l === experimentalId + "/__" + __PRODUCT__ + "__injection__html__") {
                const cache = config.cache["html-injection"] || 0;
                if (cache && cache > 0) res.setHeader("Cache-Control", "max-age=" + cache);
                await this.sendRawFile(".js", `(async()=>{${htmlInjection}})()`, req, res);
                return;
            }
            if (this.#webUUIDs[uuid] && !socket && l === experimentalId + "/__" + __PRODUCT__ + "__injection__jsx__") {
                const cache = config.cache["jsx-injection"] || 0;
                if (cache && cache > 0) res.setHeader("Cache-Control", "max-age=" + cache);
                await this.sendRawFile(".js", `(async()=>{${jsxInjection}})()`, req, res);
                return;
            }
            const r = i => {
                if (i === this.preRequests.length) return next();
                this.preRequests[i](req, res, () => r(i + 1));
            };
            await r(0);
        });
        if (this.dev && !fs.existsSync(path.join(this.#dir, config.srcFolder))) {
            printer.dev.warn("No %c/" + config.srcFolder + "&t found. Forcing to disable the developer mode.", "color: orange");
            this.dev = false;
        }
        this.buildHandlers.jsx = this.buildHandlers.tsx = [async (file, get, set, zip, ext, pt) => {
            const norm = await this.readClientJSX([...pt, file].join("/"), get.toString());
            set(norm.code);
            delete norm.code;
            zip.file("jsx/" + pt.map(i => i + "/").join("") + file.substring(0, file.length - 4) + ".json", JSON.stringify(norm));
        }];
        const pureHandler = async (file, get, set, zip, ext) => {
            set(get.length ? await minify[ext](get.toString()) : "");
        };
        this.buildHandlers.html = [pureHandler];
        this.buildHandlers.js = [pureHandler];
        this.buildHandlers.css = [pureHandler];

        const sourceJSXHandler = async (file, data, files) => {
            data = data.toString();
            const jsxJson = "jsx/" + file.substring(0, file.length - 4) + ".json";
            let jsonData;
            try {
                if (!files[jsxJson]) throw new Error("File not found: " + jsxJson);
                jsonData = JSON.parse(await files[jsxJson].async("string"));
                await this.#pseudoBuildJSX(file, data, jsonData, this.#initFunctions);
            } catch (e) {
                printer.dev.warn("Couldn't scan JSX: '" + file + "', meta file is missing or corrupted. Try rebuilding.");
                printer.dev.error(e);
            }
        };
        this.scanHandlers.source = {
            jsx: [sourceJSXHandler],
            tsx: [sourceJSXHandler],
            __default__: [(file, data) => this.#buildCache[file] = data]
        };
        const srvRpl = ({name, pth, json, getIdentifiers, tempName}) => {
            const identifiers = config.serverClientVariables ? getIdentifiers(pth) : null;
            json.functionIdentifiers[tempName] = identifiers;
            json.after.push(() => pth.replaceWithMultiple(babelParser.parse(`function ${name}(...args){return FN${runtimeId}("${tempName}",args` +
                (identifiers && identifiers.length ? `,${JSON.stringify(identifiers)}.map(i=>eval(\`try{\${i}}catch(e){undefined}\`))` : "")
                + `);}SRH${runtimeId}("${tempName}",r=>eval(r));`).program.body));
        }
        this.functionDecorators["@server"] = ({name, pth, json, code, getIdentifiers}) => {
            const tempName = random();
            srvRpl({name, pth, json, code, getIdentifiers, tempName});
            json.serverFunctions[tempName] = {name, r: false, code};
            // json.serverFunctionDepths[tempName] = getDepth(pth);
        };
        this.functionDecorators["@server/respond"] = ({name, pth, json, code, getIdentifiers}) => {
            const tempName = random();
            srvRpl({name, pth, json, code, getIdentifiers, tempName});
            json.serverFunctions[tempName] = {name, r: true, code};
            // json.serverFunctionDepths[tempName] = getDepth(pth);
        };
        this.functionDecorators["@server/start"] = ({name, pth, json, code}) => {
            pth.remove();
            json.serverInit.push({name, code});
        };
        this.functionDecorators["@server/join"] = ({name, pth, json, code}) => {
            pth.remove();
            json.joinEvent.push({name, code});
        };
        this.functionDecorators["@server/leave"] = ({name, pth, json, code}) => {
            pth.remove();
            json.leaveEvent.push({name, code});
        };
        this.functionDecorators["@client"] = ({name, pth, json}) => {
            pth.insertAfter(babelParser.parse(`CFN${runtimeId}.normal.${name}=${name};`).program.body[0]);
            json.clientFunctionList.push(name);
        };
        this.functionDecorators["@client/render"] = ({name, pth}) => {
            pth.insertAfter(babelParser.parse(`CFN${runtimeId}.load.${name}=${name};`).program.body[0]);
        };
        this.functionDecorators["@client/navigate"] = ({name, pth}) => {
            pth.insertAfter(babelParser.parse(`CFN${runtimeId}.navigate.${name}=${name};`).program.body[0]);
        };

        this.preFileHandlers.css = (file, content, f, c) => {
            f(".js");
            c(`let st=document.createElement("style");st.innerHTML=${JSON.stringify(content.toString())};document.head.appendChild(st);export default st`);
        };
        this.preFileHandlers.html = (file, content, f, c) => {
            f(".js");
            c(`export default new DOMParser().parseFromString(${JSON.stringify(content.toString())},"text/html")`);
        };
    };

    findOptimalFile(file) {
        return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
    };

    cacheDevFile(file) {
        return fs.readFileSync(file);
    };

    async cacheBuildFile(file) {
        if (!this.#buildCache) {
            await this.#scanPromise;
            await this.scanBuild();
        }
        return this.#buildCache[file];
    };

    async notFound(req, res) {
        if (!res.headersSent) res.send(`<pre>Not found: ${xss.filterXSS(req.url)}</pre>`);
    };

    prepLoad(req, res) {
        req._uuid = res._uuid = crypto.randomUUID();
        this.#webUUIDs[req._uuid] = req._Route;
        res.cookie(ck, res._uuid);
        if (config.connectionTimeout > 0 && this.#realtime) this.#uuidTimeout[req._uuid] = setTimeout(() => {
            delete this.#webUUIDs[req._uuid];
        }, config.connectionTimeout);
    };

    random() {
        return random();
    };

    enableRealtime() {
        if (this.#realtime) return;
        this.#realtime = true;
        const server_ = this.socketServer = new WS.WebSocketServer({server: this.server});
        server_.on("connection", (socket, req) => {
            const uuid = this.getCookie(req.headers.cookie, ck);
            socket._uuid = uuid;
            let beginCode = {}; // note: begin code is server-sided
            socket._handshook = false;
            socket._closed = false;
            socket._req = req;
            socket._actualReq = req;

            const o = this.#clientPages[uuid] || [];
            socket._clientPages = o[0];
            socket._mainFile = o[1];
            socket._URL_ = this.#webUUIDs[uuid];

            const isJSX = !!o[0];

            delete this.#clientPages[uuid];
            const client = new Client(socket);
            socket._send = s => {
                if (argv["debug-socket"]) printer.dev.debug("> " + s);
                if (!socket._closed) socket.send(s);
            };
            clearTimeout(this.#uuidTimeout[uuid]);
            const close = socket._close = (reason, t = true) => {
                clearTimeout(timeout);
                clearTimeout(keepalive);
                if (socket._closed) return;
                if (socket._handshook && isJSX) if (socket._mainFile) {
                    const jsx = socket._clientPages[socket._mainFile].json;
                    const leaveEvents = jsx.leaveEvent;
                    (async () => { // it could break some functionality of _close() function, so I moved async to here
                        const f = await runCodeAtSpecial(
                            `${jsx.serverImportCode};${beginCode[socket._mainFile]()};${leaveEvents.map(i => `try{(${i.code})()}catch(e){printer.dev.error(e)}`).join("")}`,
                            ["currentUUID", "currentClient"],
                            path.join(this.#dir, config.srcFolder, socket._mainFile)
                        );
                        if (!f.success) return printer.dev.error(f.result);
                        try {
                            await f.result.default(uuid, client);
                        } catch (e) {
                            printer.dev.error(e);
                        }
                    })();
                }
                if (t) {
                    socket.close();
                    printer.dev.debug("socket remove: " + (socket._uuid || "-1") + ", " + reason);
                }
                socket._closed = true;
                delete this.#clients[uuid];
                if (Client.clients[uuid]) delete Client.clients[uuid];
            };
            let keepalive;
            let keepaliveStart;
            const ka = () => {
                if (config.keepaliveTimeout < 0 || !(socket._URL_.endsWith(".jsx") || socket._URL_.endsWith(".tsx"))) return;
                if (!keepaliveStart || keepaliveStart + config.minClientKeepalive < Date.now()) {
                    clearTimeout(keepalive);
                    keepaliveStart = Date.now();
                    keepalive = setTimeout(() => close("couldn't stay alive"), config.keepaliveTimeout);
                }
            };
            const timeout = config.connectionTimeout > 0 ? setTimeout(_ => close("timeout"), config.connectionTimeout) : null;
            if (!uuid || this.#clients[uuid] || !(uuid in this.#webUUIDs)) return close("invalid key");
            this.#clients[uuid] = socket;
            delete this.#webUUIDs[uuid];
            printer.dev.debug("socket add: " + uuid);
            socket._send(SERVER2CLIENT.HANDSHAKE_REQUESTED);
            const prepareCodes = () => socket._clientPages && Object.keys(socket._clientPages).forEach(f => {
                if (!f || !(f.endsWith(".jsx") || f.endsWith(".tsx"))) return;
                const jsx = socket._clientPages[f].json;
                const clientFunctions = jsx.clientFunctionList;
                const fJ = JSON.stringify(f);
                beginCode[f] = funcId => makeBeginCode(uuid, clientFunctions, fJ, funcId);
            });
            prepareCodes();
            const onPageLoad = async () => {
                if (!socket._mainFile) return;
                const jsx = socket._clientPages[socket._mainFile].json;
                const joinEvents = jsx.joinEvent;
                const f = await runCodeAtSpecial(
                    `${jsx.serverImportCode};${beginCode[socket._mainFile]()};${joinEvents.map(i => `try{(${i.code})()}catch(e){printer.dev.error(e)}`).join("")}`,
                    ["currentUUID", "currentClient"],
                    path.join(this.#dir, config.srcFolder, socket._mainFile)
                );
                if (!f.success) {
                    close("internal server error");
                    return printer.dev.error(f.result);
                }
                try {
                    await f.result.default(uuid, client);
                } catch (e) {
                    close("internal server error");
                    return printer.dev.error(e);
                }
            };
            const sendPagePayload = pk => {
                if (socket._closed) return;
                socket.send(SERVER2CLIENT.PAGE_PAYLOAD + "" + pk);
            };
            socket._externalLoad = (url, cPages, pk, isCached) => {
                if (!cPages) return;
                socket._clientPages = cPages[0];
                socket._mainFile = cPages[1];
                socket._URL_ = url;
                prepareCodes();
                onPageLoad().then(r => r);
                if (!isCached) sendPagePayload(pk);
            };
            ka();
            socket.on("message", async data => {
                if (socket._closed) return close("bypass attempt");
                clearTimeout(timeout);
                try {
                    data = data.toString();
                    if (socket._closed) return;
                    if (argv["debug-socket"]) printer.dev.debug("< " + data);
                    if (data[0] === CLIENT2SERVER.HANDSHAKE_RESPONSE) { // handshake finished
                        if (socket._handshook) return close("one handshake is enough");
                        socket._handshook = true;
                        socket._send(SERVER2CLIENT.SURE_HANDSHAKE);
                        const pk = this.#startPacket[socket._uuid];
                        delete this.#startPacket[socket._uuid];
                        if (pk) sendPagePayload(pk);
                        return;
                    }
                    if (!socket._handshook) return close("haven't handshook"); // todo: try to use jsx packets in html process and see if it can be exploited
                    if (!(socket._URL_.endsWith(".jsx") || socket._URL_.endsWith(".tsx"))) return;
                    if (data[0] === CLIENT2SERVER.SERVER_FUNCTION_REQUEST) { // @server function run request
                        if (!isJSX) return close("unauthorized");
                        const spl = data.substring(1).split(":")
                        const evalId = spl[0];
                        const page = spl[1];
                        const fnName = spl[2];
                        if (typeof beginCode[page] !== "function" || typeof socket._clientPages[page] !== "object") return close("invalid jsx");
                        const jsx = socket._clientPages[page].json;
                        const fn = jsx.serverFunctions[fnName];
                        if (!fn) return close("invalid function");
                        const hash = this.#hashes[uuid];
                        if (!hash) return;
                        let args;
                        try {
                            args = JSON.parse(spl.slice(3).join(":"));
                        } catch (e) {
                            return close("invalid json");
                        }
                        if (
                            typeof args !== "object" || !Array.isArray(args) ||
                            typeof args[0] !== "object" || !Array.isArray(args[0]) ||
                            typeof args[1] !== "object" || !Array.isArray(args[1]) ||
                            args.length !== 2
                        ) return close("invalid function args");
                        let res;
                        let err;
                        let identifierPk = {};
                        const fnIds = jsx.functionIdentifiers[fnName];
                        if (config.serverClientVariables && fnIds && fnIds.length) {
                            if (fnIds.length !== args[1].length) return close("an attempt of an exploit");
                            fnIds
                                .map((i, j) => [i, args[1][j]])
                                .filter(i => !global[i[0]])
                                .forEach(i => {
                                    if (!i[1]) return;
                                    identifierPk[i[0]] = i[1];
                                });
                        }
                        const k = Object.keys(identifierPk);
                        const definer = `${k.map(i => `if((typeof ${i})[0]=="u"){var ${i}=I${runtimeId}.${i}}`).join("")}`;
                        try {
                            const f = await runCodeAtSpecial(
                                `${jsx.serverImportCode};${beginCode[page](fnName)};${definer}return await (${fn.code})(...ARGS${runtimeId})`,
                                ["currentUUID", "currentClient", "I" + runtimeId, "...ARGS" + runtimeId],
                                path.join(this.#dir, config.srcFolder, socket._mainFile)
                            );
                            if (f.success) res = await f.result.default(uuid, client, identifierPk, ...args[0]);
                            else err = f.result;
                        } catch (e) {
                            err = e;
                        }
                        if (err) {
                            printer.dev.error(err);
                            return close("internal server error");
                        }
                        if (fn.r) {
                            let r;
                            try {
                                r = JSON.stringify(res);
                            } catch (e) {
                                r = "undefined";
                                printer.dev.fail("Couldn't stringify the response from the '@server/respond -> " + fn.name + "' function at '/" + socket._URL_ + "'.");
                                printer.dev.error(e);
                            }
                            socket._send(SERVER2CLIENT.SERVER_FUNCTION_RESPONSE + evalId + ":" + r);
                        }// else socket._send(SERVER2CLIENT.SERVER_FUNCTION_RESPONSE + evalId);
                    } else if (data[0] === CLIENT2SERVER.CLIENT_FUNCTION_RESPONSE) { // client-sided function response
                        if (!isJSX) return close("unauthorized");
                        const hasError = data[1] === "1";
                        const spl = data.substring(2).split(":");
                        const id = spl[0];
                        if (!id || !this.#evalResponses[id]) return close("invalid eval");
                        const raw = spl.slice(1).join(":");
                        let res;
                        const got = {
                            "true": true,
                            "false": false,
                            "null": null,
                            "undefined": undefined
                        };
                        try {
                            if (raw in got) res = got[raw];
                            else res = hasError ? new Error(raw) : JSON.parse(raw);
                        } catch (e) {
                            return close("invalid json");
                        }
                        this.#evalResponses[id](res);
                        delete this.#evalResponses[id];
                    } else if (data[0] === CLIENT2SERVER.KEEPALIVE) ka();
                } catch (e) {
                    printer.dev.error(e);
                    close("internal server error");
                }
            });
            socket.on("close", () => close("disconnect", false));
        });
        return server_;
    };

    async #builtJSX(file, code, req, res, files, pk) {
        file = path.join(file).replaceAll("\\", "/");
        if (files[file] || res.headersSent) return;
        if (this.#builtJSXCache[file]) {
            files[file] = this.#builtJSXCache[file];
            pk[file] = files[file].pk;
            return;
        }
        let json;
        if (this.dev) {
            const inits = [];
            json = await this.#pseudoBuildJSX(file, code, null, inits);
            code = json.code;
            delete json.code;
            if (inits.length) {
                printer.dev.fail("A function with the decorator @server/start was found. Please use the main file instead.\n  Note: @server/start decorator can only be used in production mode!");
                res.json({error: "Internal server error"});
                return;
            }
        } else json = this.#jsxFunctions[file];
        if (!json) {
            printer.dev.fail("Couldn't find the JSX file in build: " + file);
            res.json({error: "Internal server error"});
            return;
        }
        const sr = json.serverFunctions;
        const k = Object.keys(sr);
        const nmPath = path.join(this.#dir, "node_modules");
        let pkgL = json.importList;
        if (config.allowAllPackages && fs.existsSync(nmPath)) {
            pkgL = fs.readdirSync(nmPath);
            for (const pkgN of pkgL) this.#getPackageImport(pkgN);
        }
        files[file] = {
            code,
            json,
            pk: {
                code,
                functions: k.filter(i => !sr[i].r),
                respondFunctions: k.filter(i => sr[i].r),
                importList: pkgL.map(i => [i, (this.#importMap[i] || {}).version || ""])
            }
        };
        pk[file] = files[file].pk;
        if (!this.dev) this.#builtJSXCache[file] = files[file];
        let ls = req._Allow;
        const deny = req._Deny;
        if (deny === "*") ls = [];
        else if (ls === "*") {
            if (this.dev) {
                ls = [];
                const d = h => {
                    const p = path.join(this.#dir, config.srcFolder, h).replaceAll("\\", "/");
                    const fl = fs.readdirSync(p);
                    for (const i of fl) {
                        const fl = path.join(p, i).replaceAll("\\", "/");
                        if (!fs.existsSync(fl)) return;
                        if (fs.statSync(fl).isFile()) {
                            const p = (h ? h + "/" : "") + i;
                            if (!deny.includes(p)) ls.push(p);
                        } else d((h ? h + "/" : "") + i)
                    }
                };
                d("");
            } else ls = Object.keys(this.#buildCache).filter(i => !deny.includes(i));
        } else if (ls === "auto") ls = json.fileImportList.map(i => path.join(path.dirname(file), i));
        const ch = async s => {
            if (this.dev) {
                const pt = path.join(this.#dir, config.srcFolder, s);
                if (!fs.existsSync(pt) || !fs.statSync(pt).isFile()) return;
                return this.cacheDevFile(pt);
            } else return await this.cacheBuildFile(s);
        };
        for (let f of ls) {
            let c;
            const pR = path.join(f).replaceAll("\\", "/");
            let p = pR;
            if (!path.extname(pR)) for (const a of ["tsx", "jsx", "ts", "js"]) {
                c = await ch(p);
                if (c === undefined) p = pR + "." + a;
                else {
                    f = p;
                    break;
                }
            } else {
                f = p;
                c = await ch(p);
            }
            if (deny.includes(f) || files[f] || c === undefined) continue;
            if (!c) c = "";
            this.watchFile(f);
            if (f.endsWith(".jsx") || f.endsWith(".tsx")) await this.#builtJSX(f, c, req, res, files, pk);
            else {
                if (c instanceof Buffer) {
                    const ext = path.extname(f).substring(1);
                    if (["js", "html", "css"].includes(ext)) c = c.toString();
                    else {
                        const fH = this.filePacketHandlers[ext];
                        if (fH) c = await fH(f, c);
                        else c = [...c];
                    }
                }
                files[f] = c;
                pk[f] = c;
            }
        }
    };

    async renderJSX(file, code, req, res, fromScript = false) {
        if (res.headersSent) return;
        this.prepLoad(req, res);
        const r = random();
        if (!this.#realtime) return res.json({error: "Expected 'realtime' option in the Hizzy configuration file to be true."});
        if (fromScript && req.__socket) {
            if (
                typeof req.headers["hizzy-payload-id"] !== "string" ||
                req.headers["hizzy-payload-id"].includes("\x00") // no xss allowed 👀
            ) return;
            const cPages = await this.#getPagePacket(file, code, req, res);
            if (res.headersSent) return;
            req.__socket._externalLoad(
                file, this.#clientPages[req._uuid],
                req._RouteJSON + "\x00" + req.headers["hizzy-payload-id"] + "\x00" + cPages,
                req.headers["hizzy-cache"] === "yes"
            );
        }
        if (req.__socket) return res.send("<script>location.reload()</script>"); // in case somehow client sees this.
        this.#hashes[req._uuid] = r;
        const cPages = await this.#getPagePacket(file, code, req, res);
        this.#startPacket[req._uuid] = req._RouteJSON + "\x00\x00" + cPages;
        const confJ = `['${r}','${this.#buildRuntimeId || runtimeId}',` +
            `${config.keepaliveTimeout > 0 ? config.clientKeepalive : -1},${this.dev ? 1 : 0},` +
            `'${experimentalId}',${staticJSON}]`;
        let base;
        if (this.dev) {
            const p = this.findOptimalFile(path.join(this.#dir, config.srcFolder, config.baseHTML));
            if (p) base = this.cacheDevFile(p);
        } else base = await this.cacheBuildFile(path.join(config.baseHTML).replaceAll("\\", "/"));
        await this.sendRawFile(".html",
            `${base || ""}<script type=module data-rm=${r}>(async()=>{const $$CONF$$=${confJ};eval(await (await fetch("/${experimentalId}/__${__PRODUCT__}__injection__jsx__")).text())})()</script>`, req, res
        );
    };

    async #getPagePacket(file, code, req, res) {
        let files = {}, pk = {}, pkJ;
        const l = req.url.split("?")[0].split("#")[0];
        if (this.#builtJSXPage[l]) {
            [files, pkJ] = this.#builtJSXPage[l];
        } else {
            try {
                await this.#builtJSX(file, code, req, res, files, pk);
            } catch (e) {
                printer.dev.error(e);
                res.json({error: "Internal server error"});
                return;
            }
            if (res.headersSent) return;
            pkJ = JSON.stringify(pk);
            this.#builtJSXPage[l] = [files, pkJ];
        }
        this.#clientPages[req._uuid] = [files, path.join(file).replaceAll("\\", "/")];
        this.watchFile(req._Route);
        return pkJ;
    };

    async renderHTML(file, content, req, res) {
        this.prepLoad(req, res);
        const r = random();
        this.watchFile(req._Route);
        const confJ = `['${r}',${config.keepaliveTimeout > 0 ? config.clientKeepalive : -1}]`;
        await this.sendRawFile(".html", content + (this.#realtime ?
            `<script type=module data-rm=${r}>(async()=>{const $$CONF$$=${confJ};eval(await (await fetch("/${experimentalId}/__${__PRODUCT__}__injection__html__")).text())})()</script>`
            : ""), req, res
        );
    };

    watchFile(file) {
        const fN = path.join(file);
        if (!this.dev || this.#watchingFiles[fN] || !this.autoRefresh) return;
        // if (!file.endsWith(".html") && !file.endsWith(".jsx") && !file.endsWith(".tsx")) return; // todo: read bottom
        this.#watchingFiles[fN] = true;
        fs.watchFile(path.join(this.#dir, config.srcFolder, file), {interval: 1}, () => {
            this.#builtJSXPage = {};
            for (const uuid in this.#clients) {
                const client = this.#clients[uuid];
                client._send(SERVER2CLIENT.FILE_REFRESH);
            }
        });
    };

    async sendRawFile(file, content, req, res, force = false) {
        if (res.headersSent) return;
        if (!force) for (const a of this.preRawSend) {
            await a(file, content, req, res);
            if (res.headersSent) return;
        }
        res.setHeader("Content-Type", mime.getType(file));
        res.send(content);
    };

    async sendFile(file, content, req, res, isStatic = false) {
        const fromScript = req.headers["sec-fetch-dest"] === "script" || req.headers["hizzy-dest"] === "script";
        if (fromScript && !req.__socket) return res.json({error: "Unauthorized"});
        if (!isStatic && (file.endsWith(".jsx") || file.endsWith(".tsx"))) return this.renderJSX(file, content, req, res, fromScript);
        if (!isStatic && file.endsWith(".html") && !fromScript) return this.renderHTML(file, content, req, res);
        const pH = this.preFileHandlers[file.split(".").slice(-1)[0]];
        if (fromScript && pH) {
            let cancelled = false;
            pH(file, content, f => file = f, c => content = c, () => cancelled = true);
            if (cancelled) return;
        }
        await this.sendRawFile(file, content, req, res);
    };

    #staticRender(req, res) {
        if (Object.keys(config.static).length === 0) return this.notFound(req, res);
        const l = req.url.substring(1).split("?")[0].split("#")[0];
        for (const folder in config.static) {
            const show = config.static[folder];
            const st = show ? path.join(show).replaceAll("\\", "/") + "/" : "";
            if (st && !l.startsWith(st)) continue;
            const rest = l.substring(st.length);
            const p = path.join(this.#dir, folder, rest);
            if (fs.existsSync(p) && fs.statSync(p).isFile()) {
                if (res.headersSent) return;
                const cache = typeof config.cache.static === "object" ? config.cache.static[folder] * 1 : config.cache.static * 1;
                if (cache && cache > 0) res.setHeader("Cache-Control", "max-age=" + cache);
                return this.sendFile(l, fs.readFileSync(p), req, res, false);
            }
        }
        return this.notFound(req, res);
    };

    #invalidFile(res, l) {
        res.send("Couldn't find the file. " + (this.dev ? "File does not exist: " + xss.filterXSS(l) : "Please report this to the owner of the web site."));
    };

    #devRender(l, req, res) {
        const p = path.join(this.#dir, config.srcFolder, l);
        if (!fs.existsSync(p) || !fs.statSync(p).isFile()) return this.#staticRender(req, res);
        const content = this.cacheDevFile(p);
        if (!content) return this.#invalidFile(res, l);
        this.sendFile(l, content, req, res).then(r => r);
    };

    async #buildRender(l, req, res) {
        l = l.replaceAll("\\", "/");
        const f = await this.cacheBuildFile(l);
        if (!f) return this.#invalidFile(res, l);
        await this.sendFile(l, f, req, res);
    };

    #formatLocalURL(address) {
        const {port} = this.#serverAddress;
        return `http${this.#https ? "s" : ""}://${address}${port === 80 ? "" : ":" + port}/`;
    };

    #sendURLs() {
        const {address, family} = this.#serverAddress;
        printer.raw.log(`  %c➜%c  Local:   %c${this.#formatLocalURL(family === "IPv6" ? "localhost" : address)}`, "color: greenBright", "", "color: cyan");
        if (argv.host) printer.raw.log(`  %c➜%c  Network: %c` + addresses.map(i => this.#formatLocalURL(i)).join(", "), "color: greenBright", "", "color: cyan");
        else printer.raw.log(`  %c➜  Network: use %c--host%c to expose`, "color: gray", "", "color: gray");
    };

    openInBrowser() {
        open("http://localhost:" + this.#port);
    };

    async #hasVSC() {
        return await new Promise(r => exec("where code", err => r(!err)));
    };

    async #hasIdea() {
        return await new Promise(r => exec("where " + ideaCmd, err => r(!err)));
    };

    async #hasPhpStorm() {
        return await new Promise(r => exec("where " + phpStormCmd, err => r(!err)));
    };

    async #hasWebStorm() {
        return await new Promise(r => exec("where " + webStormCmd, err => r(!err)));
    };

    async listen() {
        if (this.#listening) await new Promise(r => this.server.close(r));
        this.#listening = false;
        let port_ = Math.floor((argv.port || config.port) * 1);
        if (port_ < 0) port_ = 0;
        this.#port = port_;
        await new Promise(r => this.server.listen(port_, () => r(true)));
        this.#listening = true;
        if (this.#isInputOn) return;
        this.#isInputOn = true;
        const addons = this.getAddons();
        for (const p in addons) addons[p].module.onEnable();
        if (!this.#addonCache) {
            const addons = this.getAddons();
            const addonPks = [];
            for (const i in addons) {
                const pl = addons[i];
                let m = [
                    pl.module.name,
                    pl.module.onClientSideLoad,
                    pl.module.onClientSideRendered,
                    pl.module.onClientSideError
                ];
                if (m.slice(1).every(i => !i)) continue;
                if (!this.dev) m = m.map((i, j) => {
                    if (j === 0) return i;
                    i = (i || "") + "";
                    const min = require("uglify-js").minify(i, {
                        compress: false // todo: don't disable compression completely, disable the needed options
                        // the problem is that, minify(`(() => console.lg(1); /* or anything else */ )`) -> { "code": "" }
                    });
                    if (i) return min.code;
                    return "";
                });
                else m = m.map((i, j) => j === 0 ? i : (i || "") + "")
                addonPks.push(m);
            }
            this.#addonCache = JSON.stringify(addonPks);
        } // todo: maybe cache in build? but it would require it to cache the config file as well
        this.#initFunctions.forEach(i => i());
        const {port} = this.#serverAddress = this.server.address();
        this.#port = port;
        if (!this.dev) printer.println("");
        printer.raw.log("  %cHIZZY v" + __VERSION__ + "%c  ready in%c " + timeForm(Date.now() - __sT__), "color: yellow", "color: gray", "");
        delete global["__sT__"];
        printer.println("");
        printer.inline.log(`  %c➜%c  Mode:    %c${this.dev ? "Development" : "Production"}`, "color: greenBright", "", "color: " + (this.dev ? "orange" : "green"));
        if (port_ <= 0) printer.inline.log("%c, randomized port", "color: gray");
        if (argv.debug) printer.inline.log("%c, debugging", "color: gray");
        printer.inline.print("\n");
        this.#sendURLs();
        if (!stdin || !stdin.isTTY) return;
        printer.raw.log(`  %c➜%c  press %ch%c to show help\n`, "color: gray", "color: gray", "color: whiteBright", "color: gray");
        stdin.setRawMode(true);
        stdin.resume();
        const shortcuts = {
            h: {
                description: "show this menu", enabled: true, cooldown: 1000,
                run: () => {
                    printer.raw.println("");
                    printer.raw.log("  Shortcuts");
                    for (const key in shortcuts) {
                        const shortcut = shortcuts[key];
                        if (!shortcut.enabled) continue;
                        printer.raw.log("%c  press %c" + key + "%c to " + shortcut.description, "color: gray", "", "color: gray");
                    }
                    printer.raw.println("");
                }
            },
            r: {
                description: "restart the server", enabled: true,
                run: async () => {
                    if (!this.#listening) return;
                    await this.listen();
                    printer.raw.log("%c  ➜  Restarted the server.", "color: green");
                }
            },
            f: {
                description: "re-run the main file", enabled: this.dev,
                run: async () => {
                    await this.processDevMain();
                    printer.raw.log("%c  ➜  Main file has been re-run.", "color: green");
                }
            },
            b: {
                description: "build", enabled: !this.dev,
                run: async () => {
                    await this.build();
                    await this.scanBuild();
                }
            },
            s: {
                description: "re-scan the build", enabled: !this.dev,
                run: async () => await this.scanBuild()
            },
            u: {
                description: "show server url", enabled: true, cooldown: 1000,
                run: () => {
                    printer.raw.println("");
                    this.#sendURLs();
                    printer.raw.println("");
                }
            },
            o: {
                description: "open in browser", enabled: true, cooldown: 1000,
                run: () => this.openInBrowser()
            },
            c: {
                description: "clear the console", enabled: true,
                run: () => printer.clear()
            },
            a: {
                description: "re-enable all addons", enabled: true,
                run: () => {
                    const addons = this.getAddons();
                    for (const i in addons) addons[i].module.disable("shortcut");
                    printer.raw.log("%c  ✓  All addons have been disabled.", "color: green");
                    for (const i in addons) addons[i].module.onEnable();
                    printer.raw.log("%c  ✓  All addons have been enabled.", "color: green");
                }
            },
            e: {enabled: false},
            q: {
                description: "quit", enabled: true,
                run: () => {
                    printer.raw.log("%c  ✕  Stopping the process...", "color: red; font-weight: bold");
                    process.exit();
                }
            },
            ...this.customShortcuts
        };
        Promise.all([this.#hasVSC(), this.#hasIdea(), this.#hasPhpStorm(), this.#hasWebStorm()]).then(r => {
            const editors = [];
            r.forEach((i, j) => i && editors.push({
                name: ["Visual Studio Code", "Intellij Idea", "Php Storm", "Web Storm"][j],
                command: ["code", ideaCmd, phpStormCmd, webStormCmd][j]
            }));
            if (editors.length) shortcuts.e = {
                description: "opens an editor in here", enabled: true, cooldown: 1000,
                run: async () => {
                    printer.raw.print(printer.substitute("%c  ✓  Select an editor: ", "color: gray"));
                    stdin.off("data", handler);
                    const r = await printer.readSelectionListed(["Cancel", ...editors.map(i => i.name)], {
                        betweenText: " / ",
                        normalColor: "yellow",
                        selectedColor: "green",
                        selectedBackgroundColor: "",
                        selectedUnderline: true
                    });
                    stdin.setRawMode(true);
                    stdin.resume();
                    stdin.on("data", handler);
                    if (r === 0) return;
                    const editor = editors[r - 1];
                    printer.raw.log("%c  ✓  Opening " + editor.name + "...", "color: yellow");
                    await new Promise(r => exec(`${editor.command} ${JSON.stringify(this.#dir)}`, r));
                    printer.raw.log("%c  ✓  Opened " + editor.name + "!", "color: green");
                    // printer.raw.log("%c  ✕  Failed to open " + editor.name + ".", "color: red");
                }
            };
        });
        let cmdPromise = null;
        let cmdCooldown = {};
        let handler;
        stdin.on("data", handler = async c => {
            c = c.toString();
            if (c === "\x0c") return printer.clear();
            if (c === "\x03") {
                printer.raw.log("%c  ✕  Stopping the process...", "color: red; font-weight: bold");
                process.exit();
            }
            const shortcut = shortcuts[c];
            if (!shortcut || !shortcut.enabled || (cmdCooldown[c] || 0) + (shortcut.cooldown || 0) > Date.now()) return;
            await cmdPromise;
            cmdPromise = (async () => {
                await shortcut.run();
                cmdCooldown[c] = Date.now();
            })();
        });
        if (argv.open) this.openInBrowser();
    };

    async #buildInternal(to, dat = [0], zip) {
        const srcPath = path.join(this.#dir, config.srcFolder);
        for (const file of fs.readdirSync(path.join(srcPath, ...to))) {
            const p = path.join(srcPath, ...to, file);
            if (!fs.existsSync(p)) continue;
            if (fs.statSync(p).isDirectory()) {
                await this.#buildInternal([...to, file], dat, zip);
                continue;
            }
            const actualContent = fs.readFileSync(p);
            let content = actualContent;
            let e = false;
            let ext = file.split(".");
            ext = ext[ext.length - 1];
            try {
                const handler = this.buildHandlers[ext];
                if (handler && handler.length) for (const h of handler) await h(file, content, v => content = v, zip, ext, to);
            } catch (err) {
                printer.dev.fail("Failed to build: " + path.join(...to, file));
                printer.dev.error(err);
                dat[0]++;
                e = true;
            }
            zip.file("source/" + to.map(i => i + "/").join("") + file, content);
            if (config.includeOriginalInBuild) zip.file("original/" + to.join("/"), actualContent);
            if (!e) printer.dev.debug("Built " + path.join(...to, file));
        }
    };

    async build() {
        if (this.dev && !argv.force) return;
        if (this.#isBuilding) await this.#buildPromise;
        this.#isBuilding = true;
        let onEnd;
        this.#buildPromise = new Promise(r => onEnd = r);
        if (fs.existsSync(path.join(this.#dir, config.srcFolder))) {
            const d = Date.now();
            let dat = [0];
            const zip = new (require("jszip"))();
            await this.#buildInternal(
                [], dat, zip
            );
            /*const modules = zip.folder("node_modules");
            const modulesPath = path.join(this.#dir, "node_modules");
            if (fs.existsSync(modulesPath) && fs.statSync(modulesPath).isDirectory()) for (const f of fs.readdirSync(modulesPath)) {
                const p2 = path.join(modulesPath, f);
                if (!fs.existsSync(p2) || !fs.statSync(p2).isDirectory()) continue;
                const pkgPath = path.join(p2, "package.json");
                if (!fs.existsSync(pkgPath) || !fs.statSync(pkgPath).isFile()) continue;
                let pkg;
                try {
                    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
                } catch (e) {
                    printer.dev.fail("Failed to build: " + p2);
                    printer.dev.error(e);
                    continue;
                }
                if (typeof pkg !== "object" || pkg === null || Array.isArray(pkg)) continue;
                const {main, type} = pkg;
                let built;
                try {
                    const opts = {
                        entryPoints: [path.join(p2, main)],
                        bundle: true,
                        minify: true,
                        outdir: path.join(this.#dir, "_out_")
                    };
                    if (type === "module") opts.format = "esm";
                    built = await build(opts);
                } catch (e) {
                    printer.dev.fail("Failed to build: " + p2);
                    printer.dev.error(e);
                    continue;
                }
                modules.file(f, fs.readFileSync(path.join(this.#dir, "_out_", "index.min.js")));
            }*/
            zip.file("time", Date.now() + "");
            zip.file("runtime", runtimeId + "");
            zip.file("importMap", JSON.stringify(this.#importMap));
            const mainPath = path.join(this.#dir, config.srcFolder, config.main);
            const code = this.jsxToJS(fs.readFileSync(mainPath), path.extname(config.main));
            if (code instanceof Error) return exit("Couldn't build the main file!", code);
            zip.file("main", code);
            if (this.#firstBuild) {
                this.#firstBuild = false;
                const mainPath = path.join(this.#dir, config.srcFolder, config.main);
                const mainExtension = path.extname(mainPath);
                const mainExtensions = [".jsx", ".tsx"];
                if (!mainExtensions.includes(mainExtension)) return exit("Invalid file extension for the main file: " + mainExtension + ", expected: " + mainExtensions.join(" or "));
                if (!fs.statSync(mainPath).isFile()) return exit("Main file not found: " + mainPath);
            }
            fs.writeFileSync(path.join(this.#dir, ".build"), await zip.generateAsync({type: "nodebuffer"}));
            const dt = Date.now() - d;
            if (dat[0] === 0) printer.dev.pass("Built. (%c" + timeForm(dt) + "&t)", "color: orange");
            else printer.dev.fail("Built with %c" + dat[0] + "&t error" + (dat[0] > 1 ? "s" : "") + ". (%c" + timeForm(dt) + "&t)", "color: blue", "color: blue");
        } else printer.dev.warn("Skipping building since there is no %c/" + config.srcFolder + "&t folder...", "color: orange");
        this.#isBuilding = false;
        onEnd();
        if (!this.#buildCache && !argv.build) await this.scanBuild();
    };

    async scanBuild() {
        if (this.dev) {
            if (!this.#listening && config.listen) await this.listen();
            return;
        }
        if (this.#isBuilding) await this.waitBuild();
        if (this.#isScanningBuild) await this.waitBuildScanning();
        if (!fs.existsSync(path.join(this.#dir, ".build"))) await this.build();
        this.#isScanningBuild = true;
        this.#buildCache = {};
        this.#jsxCache = {};
        this.#builtJSXCache = {};
        this.#builtJSXPage = {};
        let onEnd;
        this.#scanPromise = new Promise(r => onEnd = r);
        const d = Date.now();
        const zip = new (require("jszip"))();
        await zip.loadAsync(fs.readFileSync(path.join(this.#dir, ".build")));
        //const tmpdir = path.join(this.#dir, ".hizzy");
        //if (fs.existsSync(tmpdir)) fs.rmSync(tmpdir, {recursive: true});
        //fs.mkdirSync(tmpdir);
        //let tmpDate = Date.now() + "";
        //fs.mkdirSync(path.join(tmpdir, tmpDate));
        //fs.writeFileSync(path.join(tmpdir, tmpDate, "package.json"), `{"type":"module"}`);
        //const isExtracting = config.extractBuild && !fs.existsSync(path.join(this.#dir, config.srcFolder));
        //if (isExtracting) fs.mkdirSync(path.join(this.#dir, config.srcFolder));
        let builtAt;
        let buildRuntimeId;
        let mainCode;
        for (const file in zip.files) {
            const dat = zip.files[file];
            if (dat.dir) {
                //if (isExtracting) fs.mkdirSync(path.join(this.#dir, config.srcFolder, file));
                //fs.mkdirSync(path.join(tmpdir, tmpDate, file), {recursive: true});
                continue;
            }
            let data = await dat.async("nodebuffer");
            if (file === "time") {
                builtAt = data.toString() * 1;
                continue;
            }
            if (file === "runtime") {
                buildRuntimeId = data.toString();
                continue;
            }
            if (file === "main") {
                if (!this.#firstScan) continue;
                this.#firstScan = true;
                mainCode = data;
                continue;
            }
            if (file === "importMap") {
                this.#importMap = JSON.parse(data.toString());
                continue;
            }
            //if (isExtracting) fs.writeFileSync(path.join(this.#dir, config.srcFolder, file), data);
            const folder = file.split("/")[0];
            const handler = this.scanHandlers[folder];
            if (handler) {
                const spl = file.split(".");
                let ext = spl[spl.length - 1];
                if (ext === "__default__") ext = null;
                const fHandler = (ext && handler[ext]) || handler.__default__;
                if (fHandler && fHandler.length)
                    for (const fh of fHandler) await fh(file.substring(folder.length + 1), data, zip.files);
            }
        }
        if (!builtAt) return exit("Invalid build: No timestamp found! Try rebuilding.");
        if (!buildRuntimeId) return exit("Invalid build: No runtime ID found for the build! Try rebuilding.");
        // if (fs.existsSync(tmpdir)) fs.rmSync(tmpdir, {recursive: true});
        const dt = Date.now() - d;
        printer.dev.pass("Scanned the build. (%c" + timeForm(dt) + "&t)", "color: orange");
        this.#isScanningBuild = false;
        this.#builtAt = builtAt;
        this.#buildRuntimeId = buildRuntimeId;
        if (mainCode) await this.processMain(mainCode);
        onEnd();
        if (!this.#listening && config.listen && !argv.build) await this.listen();
    };

    async #pseudoBuildJSX(file, code, json, inits) {
        let data = code;
        if (!json) {
            json = await this.readClientJSX(file, code);
            data = json.code;
        }
        this.#jsxFunctions[file] = json;
        const clientFunctions = json.clientFunctionList;
        inits.push(...await Promise.all(json.serverInit.map(async i => {
            return (await runCodeAtSpecial(
                `${json.serverImportCode};${makeBeginCode(null, clientFunctions, JSON.stringify(path.join(file)))};(${i.code})()`,
                [], path.join(this.#dir, config.srcFolder, file)
            )).result.default || (r => r);
        })));
        if (!this.#buildCache) this.#buildCache = {};
        this.#buildCache[file] = data;
        return json;
    };/*

    #addImport(name, file, d) {
        if (this.#importMap[name]) return file && this.#importMap[name].push(file);
        const p = path.join(this.#dir, "node_modules", name);
        if (!fs.existsSync(p)) return d.push(name);
        const {dependencies, main} = require(path.join(p, "package.json"));
        this.#importMap[name] = {};
        const addFolder = folder => {
            const actual = path.join(this.#dir, "node_modules", name, folder);
            fs.readdirSync(actual).forEach(i => {
                if (fs.statSync(path.join(actual, i)).isFile()) {
                    this.#importMap[name][folder + (folder ? "/" : "") + i] = fs.readFileSync(path.join(actual, i));
                } else addFolder(folder + (folder ? "/" : "") + i);
            });
        };
        addFolder("");
        this.#importMains[name] = path.join(main || "").replaceAll("\\", "/");
        if (typeof dependencies === "object") Object.keys(dependencies).forEach(i => this.#addImport(i, file, d));
    };*/

    async processDevMain() {
        const mainPath = path.join(this.#dir, config.srcFolder, config.main);
        await this.processMain(this.jsxToJS(fs.readFileSync(mainPath), path.extname(mainPath)));
    };

    async processMain(data) {
        if (data instanceof Buffer) data = data.toString();
        if (typeof data === "object") {
            printer.dev.error(data);
            return process.exit();
        }
        // noinspection JSUnresolvedReference
        const React = global["R" + (this.#buildRuntimeId || runtimeId)] = (...a) => require("preact").createElement(...a);
        Hizzy.Routes = global.Routes = () => React("div", null);
        Hizzy.Route = global.Route = () => React("div", null);
        let mainResponse;
        const tPath = path.join(this.#dir, config.srcFolder, config.main) + random() + "." + (config.mainModule ? "m" : "") + "js";
        const rmf = () => {
            if (fs.existsSync(tPath)) fs.rmSync(tPath, {recursive: true});
        };
        try {
            fs.writeFileSync(tPath, data);
            mainResponse = await import(url.pathToFileURL(tPath));
        } catch (e) {
            rmf();
            printer.dev.error(e);
            return;
        }
        try {
            if (typeof this.#mainDoneCb === "function") await this.#mainDoneCb();
        } catch (e) {
            printer.dev.error(e);
        }
        if (mainResponse && mainResponse.onDone) this.#mainDoneCb = mainResponse.onDone;
        rmf();
        if (!mainResponse || !(mainResponse = mainResponse.default))
            return exit("Expected a valid 'export default' from the main file.");
        if (mainResponse.type !== Routes)
            return exit("Expected the 'export default' from the main file to be a Routes component!");
        const routes = {};
        const makeRoute = async (s, u = {location: "", onRequest: [], allow: [], deny: []}) => {
            if (typeof s === "object" && !Array.isArray(s)) {
                if (s.type && s.type !== Route && s.type.isRouteParent) s = s.type(s.props, s.props.children);
                if (s.type !== Route)
                    return exit("Expected every child component of the Routes component to be a Route component!");
                const p = path.join(u.location, s.props.path || "").replaceAll(path.sep, "/");
                if (s.props.children) await makeRoute(s.props.children, {...u, location: p});
                if (!s.props.path) return;
                if (routes[p])
                    return exit("Cannot add multiple routes to the same endpoint: " + p);
                const r = path.join(s.props.route || "");

                let allow = u.allow === "*" ? "*" : s.props.allow;
                if (allow === undefined) allow = "auto";
                if (allow === "*") u.allow = allow;
                if (Array.isArray(allow)) u.allow = [...new Set([...u.allow, ...allow])];

                let deny = u.deny === "*" ? "*" : s.props.deny;
                if (deny === undefined) deny = [];
                if (deny === "*") u.deny = "*";
                if (Array.isArray(deny)) u.deny = [...new Set([...u.deny, ...deny])];

                const msg = "Route '" + r + "'s 'allow' property is invalid, expected \"*\" or an array of strings, got: ";
                if (typeof allow === "string") {
                    if (allow !== "*" && allow !== "auto") return exit(msg, allow);
                } else if (typeof allow !== "object" || !Array.isArray(allow) || allow.some(i => typeof i !== "string")) return exit(msg, allow);
                const msg2 = "Route '" + r + "'s 'deny' property is invalid, expected \"*\" or an array of strings, got: ";
                if (typeof deny === "string") {
                    if (deny !== "*") return exit(msg2, deny);
                } else if (typeof deny !== "object" || !Array.isArray(deny) || deny.some(i => typeof i !== "string")) return exit(msg2, deny);
                routes[p] = {
                    route: r,
                    routeJSON: JSON.stringify(r.replaceAll("\\", "/")),
                    allow,
                    deny,
                    onRequest: s.props.onRequest,
                    method: (s.props.method || "get").toLowerCase()
                };
                return;
            }
            for (const i of s) await makeRoute(i, u);
        };
        if (mainResponse.props.children) await makeRoute(mainResponse.props.children);
        Object.freeze(routes);
        this.routes = routes;
        const METHODS = ["all", "get", "post", "put", "delete", "patch", "options", "head"];
        this.app._router.stack = this.app._router.stack.filter(i => !i.route); // removes all routes, good for re-run of main file
        for (const url in this.routes) {
            const {route, method, routeJSON, allow, deny, onRequest} = this.routes[url];
            if (!METHODS.includes(method)) {
                printer.dev.warn("Invalid method: " + method + ", expected one of these: " + METHODS.join(", "));
                continue;
            }
            this.app[method](url, async (req, res, nx) => {
                req._Route = route;
                req._RouteJSON = routeJSON;
                req._Allow = allow;
                req._Deny = deny;
                let next = async (goActual = false) => {
                    if (goActual) return nx();
                    if (this.dev) this.#devRender(route, req, res);
                    else await this.#buildRender(route, req, res);
                };
                if (typeof onRequest === "function") onRequest(req, res, next);
                else if (typeof onRequest === "object" && Array.isArray(onRequest)) {
                    const r = (i, ...a) => {
                        if (i === onRequest.length) return next();
                        onRequest[r](req, res, (...a) => r(i + 1, ...a), ...a);
                    };
                    await r(0);
                } else await next();
            });
        }
        this.app.get("*", (req, res) => this.#staticRender(req, res));
    };

    // todo: maybe add an ability to set the connection timeout time for requests, like if it's far away increase it etc.
    async readClientJSX(file, jsxCode) {
        const json = {
            // throw "Cannot access the main file from the client side.";
            code: "",
            serverFunctions: {},
            clientFunctionList: [],
            serverInit: [],
            joinEvent: [],
            leaveEvent: [],
            importList: [],
            fileImportList: [],
            serverImportCode: "",
            functionIdentifiers: {}
            // serverFunctionDepths: {}
        };
        if (file === config.main) return json;
        const jsCode = this.jsxToJS(jsxCode, path.extname(file), true);
        if (jsCode instanceof Error) throw jsCode;
        const ast = babelParser.parse(jsCode, {sourceType: "module"});
        const clip = ({start, end}) => jsCode.substring(start, end);
        const getDepth = path => {
            let depth = 0;
            while (path && path.node && path.node.type !== "Program") {
                if (path.node.type === "FunctionDeclaration") depth++;
                path = path.parentPath;
            }
            return depth;
        };
        const getIdentifiers = p => {
            const identifiers = [];
            p.traverse({
                Identifier(p2) {
                    if (!p2.node._isMember && !identifiers.includes(p2.node.name))
                        identifiers.push(p2.node.name);
                },
                MemberExpression(p2) {
                    p2.node.property._isMember = true;
                }
            });
            return identifiers;
        };
        const processFunction = (leadingComments, name, code, p) => {
            const all = [];
            for (const comment of (leadingComments || [])) {
                const lines = comment.value.split("\n");
                for (const line of lines) {
                    const t = line.replaceAll("*", "").trim();
                    if (t === "@client") {
                        all.push(t);
                        continue;
                    }
                    const fH = this.functionDecorators[t];
                    if (fH) {
                        all.push(t);
                        fH({name, leadingComments, code, json, pth: p, getIdentifiers, getDepth});
                    }
                }
            }
            if (all.some(i => i.startsWith("@server"))) {
                // something?
            } else {
                this.functionDecorators["@client"]({
                    name,
                    leadingComments,
                    code,
                    json,
                    pth: p,
                    getIdentifiers,
                    getDepth
                });
            }
        };
        const actualProcessImport = (source, s) => {
            if (source.type !== "StringLiteral") return;
            if (this.#getPackageImport(source.value) !== null) {
                if (!json.importList.includes(source.value)) {
                    json.importList.push(source.value);
                    if (s) json.serverImportCode += s;
                }
            } else if (!json.fileImportList.includes(source.value)) json.fileImportList.push(source.value);
        };
        json.after = [];
        // todo: cache function instances somewhere and don't do Function()() everytime, to allow generator functions to work
        traverse(ast, {
            FunctionDeclaration: p => {
                const {leadingComments, id} = p.node;
                if (!id) return;
                processFunction(leadingComments, id.name, clip(p.node), p);
            },
            VariableDeclaration: p => {
                const {declarations, leadingComments, kind} = p.node;
                if (!declarations) return;
                for (const dec of declarations) {
                    const {init} = dec;
                    if (
                        !init || ![
                            "ArrowFunctionExpression", "FunctionExpression"
                        ].includes(init.type)) continue;
                    processFunction(leadingComments, dec.id.name, kind + " " + clip(dec), p);
                }
            },
            CallExpression(p) {
                const {callee, arguments: args} = p.node;
                if (callee.type === "Identifier" && callee.name === "require" && args.length === 1) {
                    json.after.push(() => p.replaceWith({
                        type: "AwaitExpression",
                        argument: {
                            type: "CallExpression",
                            callee: p.node.callee,
                            arguments: p.node.arguments,
                        }
                    }));
                    actualProcessImport(args[0]);
                }
            }
        });
        json.after.forEach(i => i());
        json.after = [];
        json.clientFunctionList = [...new Set(json.clientFunctionList)];
        const code = babelGenerator.default(ast).code;
        const c = this.dev ? code : require("uglify-js").minify(code, {
            module: true,
            compress: {toplevel: true},
            mangle: true
        });
        if (c.error) throw c.error;
        json.code = typeof c === "string" ? c : c.code;
        return json;
    };

    #getPackageImport(name) {
        name = name.split("?")[0].split("#")[0];
        if (this.#importMap[name]) return this.#importMap[name];
        if (name.includes(".") || ["hizzy", "@hizzyjs/types", "react", "preact"].includes(name) || this.getAddonByName(name)) return null;
        const p = path.join(this.#dir, "node_modules", name);
        if (!fs.existsSync(p) || !fs.statSync(p).isDirectory()) return null;
        const pkgP = path.join(p, "package.json");
        if (!fs.existsSync(pkgP) || !fs.statSync(pkgP).isFile()) return null;
        const pkg = require(pkgP);
        const self = this.#importMap[name] = {
            code: esbuild.buildSync({
                stdin: {
                    contents: `export * as default from ${JSON.stringify(name)}`,
                    resolveDir: this.#dir,
                    sourcefile: ".js",
                    loader: "ts"
                },
                bundle: true,
                minify: true,
                format: "esm",
                write: false
            }).outputFiles[0].text,
            version: pkg.version || "",
            actual: undefined
        };
        self.actual = import(url.pathToFileURL(path.join(p, pkg.main)));
        self.actual.then(i => self.actual = i);
        return self;
    };

    async waitBuild() {
        return await this.#buildPromise;
    };

    async waitBuildScanning() {
        return await this.#scanPromise;
    };

    async sendEvalTo(uuid, code) {
        const client = this.#clients[uuid];
        if (!client) return false;
        const pId = this.#evalId++;
        client._send(SERVER2CLIENT.CLIENT_FUNCTION_REQUEST + pId + ":" + code);
        let cb;
        let pr = new Promise(r => cb = r);
        this.#evalResponses[pId] = cb;
        const res = await pr;
        delete this.#evalResponses[pId];
        return res;
    };

    clientUUIDs() {
        return Object.keys(this.#clients);
    };

    async broadcastEval(code) {
        const obj = {};
        for (const i of this.clientUUIDs()) obj[i] = await this.sendEvalTo(i, code);
        return obj;
    };

    getHash(uuid) {
        return this.#hashes[uuid] || null;
    };

    findClient(uuid) {
        const client = this.#clients[uuid];
        if (!client) return null;
        return new Client(client);
    };

    findSocket(uuid) {
        return this.#clients[uuid] || null;
    };

    get directory() {
        return this.#dir;
    };

    makeClientFunction(file, name, uuid = null, fromFunction = null) {
        return makeClientFunction(file, name, uuid, fromFunction);
    };

    getAddons() {
        return Addon.addons;
    };

    getAddon(name) {
        return Addon.addons[name] || null;
    };

    getAddonByName(name) {
        return Object.keys(Addon.addons).find(i => Addon.addons[i].module.name === name);
    };

    jsxToJS(jsx, extension, moduleConvert = false) {
        try {
            return babel.transformSync(jsx, {
                filename: extension,
                presets: [
                    [require("@babel/preset-react"), {
                        pragma: "R" + runtimeId,
                        pragmaFrag: "F" + runtimeId
                    }],
                    ...(extension === ".tsx" ? [require("@babel/preset-typescript")] : [])
                ], // todo: use real decorators
                plugins: [
                    ...(moduleConvert ? [require("@babel/plugin-transform-export-namespace-from"), require("@babel/plugin-transform-modules-commonjs")] : [])
                ]
            }).code;
        } catch (e) {
            return e;
        }
    };

    tsToJS(jsx) {
        try {
            return babel.transformSync(jsx, {
                filename: "file.ts",
                presets: [require("@babel/preset-typescript")]
            }).code;
        } catch (e) {
            return e;
        }
    };

    getCookie(cookies, cookie) {
        const c = (cookies || "").split(";").map(i => i.trim()).find(i => i.startsWith(cookie + "="));
        return c ? c.substring(cookie.length + 1) : null;
    };

    useGlobalState(key, defaultValue) {
        if (!key) key = "";
        if (!this.#globalStates.has(key)) this.#globalStates.set(key, defaultValue);
        const get = () => this.#globalStates.get(key);
        const set = v => {
            if (typeof v === "function") v = v(get());
            this.#globalStates.set(key, v);
        };
        const delete_ = () => this.#globalStates.delete(key);
        return {get, set, delete: delete_};
    };

    useCooldown(key, ip, {amount, time}) {
        if (!key) key = "";
        if (typeof amount !== "number" || typeof time !== "number") {
            throw new Error(`useCooldown() function requires an object that includes 'amount' and 'time' as numeric properties. It will check if the client has run this part of the code 'amount' times in the last 'time' milliseconds.`);
        }
        if (typeof ip !== "string") ip = ip.ip;
        const {get, set} = Hizzy.useGlobalState(key + "-Cooldown-Hizzy-Internal-" + ip, [0]);
        const f = get().filter(i => Date.now() < i);
        if (f.length > amount) return false;
        f.push(Date.now() + time);
        set(f);
        return true;
    };

    defineConfig(r) {
        return r || {};
    };

    getPkg(name) {
        return (this.#getPackageImport(name) || {}).actual;
    };

    minify = minify;
}

module.exports = API;