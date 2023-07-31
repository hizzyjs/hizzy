const {AddonModule, preFileHandlers, buildHandlers, filePacketHandlers} = Hizzy;
const MARK = "/*TS\x00CLIENT\x00HIZZY*/";

const filePacketCallback = (file, content) => {
    return Hizzy.tsToJS(content);
};
const preFileCallback = (file, content, f, c, cn) => {
    if (content.startsWith(MARK)) {
        f(".js");
        preFileHandlers.js(".js", c(content.substring(MARK.length)), f, c, cn);
    } else if (Hizzy.dev && file.endsWith(".ts")) {
        f(".js");
        preFileHandlers.js(".js", c(Hizzy.tsToJS(content)), f, c, cn);
    }
};
const buildCallback = (file, content, set) => set(MARK + Hizzy.minify.js(Hizzy.tsToJS(content)));

module.exports = class TSClientAddon extends AddonModule {
    onLoad() {
        this.onClientSideLoad = () => {
            fileHandlers.build.ts = fileHandlers.build.js;
        };
    };

    onEnable() {
        preFileHandlers.ts = preFileCallback;
        if (!buildHandlers.ts) buildHandlers.ts = [];
        buildHandlers.ts.push(buildCallback);
        filePacketHandlers.ts = filePacketCallback;
    };

    onDisable(reason) {
        if (preFileHandlers.ts === preFileCallback) delete preFileHandlers.ts;
        buildHandlers.ts.splice(buildHandlers.ts.indexOf(buildCallback), 1);
        if (filePacketHandlers.ts === filePacketCallback) delete filePacketHandlers.ts;
    };
};