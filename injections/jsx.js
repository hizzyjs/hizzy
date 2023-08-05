// noinspection TypeScriptUMDGlobal

const [R, R2, TIMEOUT, DEV, EXP, STATIC] = $$CONF$$;
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
const w = window;
const d = document;
const o = Object;
const WK = o.keys(w); // todo: make it so window is refreshed when a navigation happens
delete w["cookieStore"];
d.querySelector("script[data-rm='" + R + "']").remove();
const key = (document.cookie.split(';').map(i => i.trim()).find(i => i.startsWith("__hizzy__=")) || "").substring("__hizzy__=".length);
if (!key) location.reload();
const isSecure = location.protocol === "https:";
const worker = new Worker(URL.createObjectURL(new Blob(["(" + (() => {
    let socket = new WebSocket("$R");
    const TIMEOUT = $T;
    const KA = $P;
    socket.addEventListener("open", () => {
        if (TIMEOUT > 0) setInterval(() => {
            console.debug("> " + KA);
            socket.send(KA.toString());
        }, TIMEOUT);
    });
    socket.addEventListener("close", () => {
        console.debug("closed");
        postMessage(JSON.stringify({event: "close"}));
    });
    socket.addEventListener("error", e => {
        console.debug("error", e);
        postMessage(JSON.stringify({event: "error"}));
    });
    socket.addEventListener("message", e => {
        console.debug("<", e.data);
        postMessage(JSON.stringify({event: "message", data: e.data}));
    });
    addEventListener("message", e => {
        console.debug("> " + e.data);
        socket.send(e.data);
    });
}).toString()
    .replace("$R", "ws" + (isSecure ? "s" : "") + "://" + location.host)
    .replace("$P", CLIENT2SERVER.KEEPALIVE)
    .replace("$T", TIMEOUT)
+ ")()"])));
const sendToSocket = content => worker.postMessage(content);
let onRender;
let renderPromise = new Promise(r => onRender = r);
let firstRender = true;
const expecting = {};
const expectPayload = async (id, p, push) => {
    expecting[id] = [null, p, push];
    return await new Promise(r => expecting[id][0] = r);
};
const messageHandler = {
    [SERVER2CLIENT.FILE_REFRESH]: async () => {
        pageCache = {};
        await reloadPage();
    },
    [SERVER2CLIENT.HANDSHAKE_REQUESTED]: async () => onHandshook(),
    [SERVER2CLIENT.CLIENT_FUNCTION_REQUEST]: async m => {
        await renderPromise;
        const spl = m.split(":");
        const id = spl[0];
        const code = spl.slice(1).join(":");
        try {
            const res = runCode(code, [
                [`__hizzy_run${R}__2`, serverEvaluators],
                [`__hizzy_run${R}__`, clientFunctions]
            ]);
            sendToSocket(CLIENT2SERVER.CLIENT_FUNCTION_RESPONSE + "0" + id + ":" + JSON.stringify(res));
        } catch (e) {
            console.error(e);
            sendToSocket(CLIENT2SERVER.CLIENT_FUNCTION_RESPONSE + "1" + id + ":" + e.message);
        }
    },
    [SERVER2CLIENT.SERVER_FUNCTION_RESPONSE]: async m => {
        const spl = m.split(":");
        const evalId = spl[0];
        const res = spl.slice(1).join(":");
        evalResponses[evalId](res === "undefined" ? undefined : JSON.parse(res));
    },
    //[SERVER2CLIENT.SURE_HANDSHAKE]: async () => onHandshookSure(),
    [SERVER2CLIENT.PAGE_PAYLOAD]: async m => {
        const spl = m.split("\x00");
        if (spl.length === 1) {
            try {
                const j = JSON.parse(spl[0]);
                console.error(j.error || j);
            } catch (e) {
                console.error("Couldn't parse invalid JSON.");
                console.error(e);
            }
            return;
        }
        mainFile = JSON.parse(spl[0]);
        files = JSON.parse(spl.slice(2).join("\x00"));
        const cb = expecting[spl[1]];
        if (Array.isArray(cb) && typeof cb[0] === "function") cb[0]();
        if (!spl[1]) onHandshookSure();
    }
};
worker.addEventListener("message", async event => {
    const E = JSON.parse(event.data);
    switch (E.event) {
        case "close":
        case "error":
            location.reload();
            break;
        case "message":
            const m = E.data.toString();
            const fn = messageHandler[m[0]];
            if (!fn) return;
            fn(m.substring(1));
            break;
    }
});
let onHandshook;
let onHandshookSure;
const handshookPromise = new Promise(r => onHandshook = r);
const handshookSurePromise = new Promise(r => onHandshookSure = r);
let loadPromise = new Promise(r => addEventListener("load", r));
let _evalId = 0;
const evalResponses = {};
const runCode = (code, args = [], async = false) => {
    return Function(...args.map(i => i[0]), (async ? "return (async()=>{" : "") + code + (async ? "})()" : ""))(...args.map(i => i[1]));
};
const runModuleCode = code => import(URL.createObjectURL(new Blob([code], {type: "application/javascript"})));
await handshookPromise;
if (document.readyState !== "complete") await loadPromise;
sendToSocket(CLIENT2SERVER.HANDSHAKE_RESPONSE);

// thrown away idea: using iframe and postMessage(`${R} ${packet}`)

///
let mainFile = null;
let files = null;
let exports = {};
let hasExported = [];
let fetchCache = {};
let clientFunctions = {};
let serverEvaluators = {};
///

await handshookSurePromise;
const Hizzy = {};
const __hooks = await import("http" + (isSecure ? "s" : "") + "://" + location.host + "/" + EXP + "/__hizzy__preact__hooks__");
const __react = __hooks["React"];
if (!__react) location.reload();
const react = {};
o.assign(Hizzy, __react, __hooks);
o.assign(react, __react, __hooks);
const ADDONS = await (await fetch("/" + R2 + "/__hizzy__addons__")).json();
const rst = () => d.cookie = "__hizzy__=; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
const stb = () => d.cookie = "__hizzy__=" + key;
rst();
const pathJoin = (f, cd = mainFile.split("/").slice(0, -1)) => {
    const p = [...cd];
    for (const i of f.split("/")) {
        if (i === "." || !i) continue;
        if (i === "..") {
            p.pop();
            continue;
        }
        p.push(i);
    }
    return p.join("/");
};
const fileHandlers = {
    build: {
        html: (name, content) => ({default: new DOMParser().parseFromString(content, "text/html")}),
        css: (name, content) => {
            const style = document.createElement("style");
            style.innerHTML = content;
            document.head.appendChild(style);
            return {default: style};
        },
        js: async (name, content) => ({default: await runModuleCode(content)})
    },
    assets: {},
    external: {
        html: (name, content) => ({default: new DOMParser().parseFromString(content, "text/html")}),
        css: (name, content) => {
            let st = document.createElement("style");
            st.innerHTML = content;
            document.head.appendChild(st);
            return {default: st};
        },
        js: (name, content) => runModuleCode(content),
        json: (name, content) => ({default: JSON.parse(content)})
    }
};
Hizzy.sendNavigationMessage = true;
Hizzy.resolvePath = p => {
    p = pathJoin(p);
    for (const folder in STATIC) {
        const show = STATIC[folder];
        const st = pathJoin(folder, []).replaceAll("\\", "/") + "/";
        if (!p.startsWith(st)) continue;
        return show + "/" + p.substring(st.length);
    }
    return p;
};
const urlExport = f => "/" + Hizzy.resolvePath(f);
const customExports = {
    hizzy: () => Hizzy,
    "@hizzyjs/types": () => Hizzy,
    react: () => react,
    preact: () => react
};
const import_ = async (f, _from, extra = []) => {
    const query = new URLSearchParams(f.includes("?") ? f.split("?").slice(1).join("?") : "");
    const isURL = query.get("url") === "";
    const isRaw = query.get("raw") === "";
    if (isURL && isRaw) throw new Error("An import can't have both '?url' and '?raw'!");
    const customExp = (customExports[f] && await customExports[f]()) || addonExports[f];
    if (customExp) {
        if (isURL || isRaw) throw new Error("Cannot use the '?url' or the '?raw' on the import '" + f + "'!");
        return customExp;
    }
    if (isURL) return urlExport(f);
    const relativeP = f.startsWith(".");
    const path = pathJoin(f.split("?")[0].split("#")[0]);

    let fName = path;
    for (const a of ["tsx", "jsx", "ts", "js"]) if (!files[fName]) fName = path + "." + a;
    const file = files[fName];

    const _fExtSpl = fName.split(".");
    const fExt = _fExtSpl.length <= 1 ? "" : _fExtSpl[_fExtSpl.length - 1];
    const _fExtSplAct = path.split(".");
    const fExtAct = _fExtSplAct.length <= 1 ? "" : _fExtSplAct[_fExtSplAct.length - 1];
    if (hasExported.includes(fName)) return exports[fName];
    if (fExt !== "jsx" && fExt !== "tsx" && file) {
        if (isRaw) return {default: file, content: file};
        const fH = fileHandlers.build[fExtAct];
        if (fH) {
            hasExported.push(fName);
            return exports[fName] = await fH(fName, file);
        }
        return urlExport(f);
    }
    if (typeof file === "undefined") {
        if (f.startsWith("https://") || f.startsWith("http://")) {
            const fH = fileHandlers.external[fExtAct];
            const content = fetchCache[f] = fetchCache[f] ?? (await (await fetch(f)).text());
            if (fH) {
                hasExported.push(fName);
                return exports[fName] = isRaw ? {default: content, content} : await fH(fName, content);
            }
            if (isRaw) return {default: content, content};
            return urlExport(f);
        } else {
            const npmV = (files[_from].importList.find(i => i[0] === path.split("/")[0]) || [])[1];
            if (!relativeP && !npmV) throw new Error("Module not found: " + path);
            const url = "http" + (isSecure ? "s" : "") + "://" + location.host + "/" + (relativeP ? path : "__hizzy__npm__/" + npmV + "/" + path);
            let a;
            let res;
            let content;
            try {
                stb();
                res = await fetch(url, {headers: {"sec-fetch-dest": "script"}});
                rst();
                content = fetchCache[f] = fetchCache[f] ?? await res.text();
                const type = res.headers.get("Content-Type").split(";")[0].trim();
                if (type !== "application/javascript") {
                    const fH = fileHandlers.assets[fExtAct];
                    if (fH) {
                        hasExported.push(fName);
                        return exports[fName] = isRaw ? {default: content, content} : await fH(fName, content);
                    }
                    if (isRaw) return {default: content, content};
                    return urlExport(f);
                }
                if (isRaw) a = {default: content, content};
                else {
                    a = await runModuleCode(content);
                    if (!relativeP) a = a.default;
                }
            } catch (e) {
                throw e;
            } finally {
                rst();
            }
            return a;
        }
    }
    if (isRaw) throw new Error("Cannot use the '?raw' on JSX/TSX files!");
    const getting = {normal: {}, load: {}, navigate: {}};
    await runCode(
        file.code, [
            ["exports", exports[fName]],
            ["require", pkg => import_(pkg, fName)],
            ["R" + R2, (...a) => react.createElement(...a)],
            ["F" + R2, (...a) => react.Fragment(...a)],
            ["H" + R2, Hizzy],
            ["currentWebSocket", WebSocket],
            ["CFN" + R2, getting], // client function
            ["SRH" + R2, (name, fn) => serverEvaluators[name] = fn], // server evaluation handlers
            ["FN" + R2, (s, args, identifiers) => {
                /*if (identifiers) {
                    identifiers = identifiers.map(i => {
                        if (typeof i !== "function") return null;
                        const temp = crypto.randomUUID();
                        clientFunctionMap.set(temp, i);
                        return temp;
                    }); todo
                }*/
                const id = ++_evalId;
                sendToSocket(CLIENT2SERVER.SERVER_FUNCTION_REQUEST + "" + id + ":" + fName + ":" + s + ":" + JSON.stringify([args, identifiers || []]));
                if (files[fName].respondFunctions.includes(s)) return new Promise(r => evalResponses[id] = r);
            }],
            ...extra
        ], true);
    clientFunctions[fName] = getting;
    hasExported.push(fName);
    return exports[fName];
};
for (const f in files) exports[f] = {};
// todo: client can create workers, they should be terminated before a navigation, also assignments to `window` or any other global variable stay
const addonExports = {};
const doAddon = async (index, ...a) => {
    for (let i = 0; i < ADDONS.length; i++) {
        const addon = ADDONS[i];
        const f = addon[index];
        if (!f) continue;
        const fn = await eval(f);
        const v = fn(...a);
        if (index === 1) addonExports[addon[0]] = v;
    }
};
Hizzy.useAddon = s => addonExports[s] || {};
await doAddon(1); // on client side load
const _setInterval = window.setInterval;
const _setTimeout = window.setTimeout;
let timeouts = [];
window.setTimeout = (f, t) => {
    const id = _setTimeout(f, t);
    timeouts.push(id);
    return id;
};
window.setInterval = (f, t) => {
    const id = _setInterval(f, t);
    timeouts.push(id);
    return id;
};
let pageCache = {
    [location.pathname]: {mainFile, files}
};
const completePage = async (p, push) => {
    const actual = p.split("?")[0].split("#")[0];
    pageCache[actual] = {mainFile, files};
    if (push) {
        history.pushState({
            ["__hizzy" + R + "__"]: p
        }, null, "/" + p);
        if (Hizzy.sendNavigationMessage) console.log("%c[Hizzy] %cNavigated to " + location.href, "color: orange", "color: #4c88ff");
    }
    await loadPage(mainFile);
};
const fetchPage = async (p, push = true) => {
    p = pathJoin(p, location.pathname.split("/").slice(1, -1));
    const actual = p.split("?")[0].split("#")[0];
    try {
        if (!DEV && pageCache[actual]) {
            const page = pageCache[actual];
            mainFile = page.mainFile;
            files = page.files;
            stb();
            await fetch("/" + p, {
                headers: {
                    "hizzy-dest": "script",
                    "hizzy-cache": "yes",
                    "hizzy-payload-id": ""
                }
            });
            rst();
        } else {
            const pUuid = crypto.randomUUID();
            const wait = expectPayload(pUuid, p, push);
            stb();
            await fetch("/" + p, {
                headers: {
                    "hizzy-dest": "script",
                    "hizzy-payload-id": pUuid
                }
            }); // todo: send a packet instead? but it should also trigger GET route, if client wants to protect that url
            rst();
            await wait;
        }
    } catch (e) {
        throw e;
    } finally {
        rst();
    }
    await completePage(p, push);
};
const reloadPage = () => fetchPage(location.pathname);
Hizzy.fetch = async (url, options = {}) => await (await fetch(url, options))[options.json ? "json" : "text"]();
Hizzy.openPage = p => fetchPage(p);
Hizzy.reloadPage = () => reloadPage();
Hizzy.LinkComponent = props => {
    if (!props) props = {};
    const url = props.path || "";
    delete props.path;
    return react.createElement("span", {
        onClick: () => fetchPage(url),
        className: "Link",
        ...props
    }, props.children);
};
addEventListener("popstate", async e => {
    await fetchPage(e.state["__hizzy" + R + "__"], false);
});
let oldEnds = {};
const baseHTML = d.documentElement.innerHTML;
const loadPage = async file => {
    if (!firstRender) renderPromise = new Promise(r => onRender = r);
    o.values(oldEnds).forEach(i => i());
    oldEnds = {};
    firstRender = false;
    d.documentElement.innerHTML = baseHTML;
    for (const t of timeouts) clearTimeout(t);
    timeouts = [];

    exports = {};
    hasExported = [];
    fetchCache = {};
    serverEvaluators = {};
    clientFunctions = {};
    for (const f in files) exports[f] = {};

    try {
        const exp = await import_(file.split("/").slice(-1)[0], null);
        if (exp && exp.default) {
            let def = exp.default;
            if (typeof def === "function") def = react.h(def, null);
            const mainDocument = d.querySelector("main") || d.body;
            if (def.__v) {
                react.render(def, mainDocument);
                const l = clientFunctions[file].load;
                oldEnds = clientFunctions[file].navigate;
                for (const i in l) l[i]();
            }
        }
    } catch (e) {
        console.error("An error occurred while rendering the file: " + file);
        console.error(e);
        await doAddon(3, e); // on client side error
    }
    await doAddon(2); // on client side rendered
    onRender();
};
// LOADING THE ACTUAL PAGE:
// await fetchPage(location.pathname, false);
await completePage("", false);