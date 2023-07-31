const {AddonModule, preFileHandlers, buildHandlers, filePacketHandlers} = Hizzy;
const sass = require("sass");
const MARK = "/*SASS\x00HIZZY*/";

const filePacketCallback = (file, content) => {
    return sass.compileString(content).css;
};
const preFileCallback = (file, content, f, c, cn) => {
    if (content.startsWith(MARK)) {
        f(".css");
        preFileHandlers.css(".css", c(content.substring(MARK.length)), f, c, cn);
    } else if (Hizzy.dev && file.endsWith(".sass")) {
        f(".css");
        preFileHandlers.css(".css", c(sass.compileString(content).css), f, c, cn);
    }
};
const buildCallback = (file, content, set) => set(MARK + Hizzy.minify.css(sass.compileString(content).css));

module.exports = class SASSAddon extends AddonModule {
    onLoad() {
        this.onClientSideLoad = () => {
            fileHandlers.build.sass = fileHandlers.build.css;
        };
    };

    onEnable() {
        preFileHandlers.sass = preFileCallback;
        if (!buildHandlers.sass) buildHandlers.sass = [];
        buildHandlers.sass.push(buildCallback);
        filePacketHandlers.sass = filePacketCallback;
    };

    onDisable(reason) {
        if (preFileHandlers.sass === preFileCallback) delete preFileHandlers.sass;
        buildHandlers.sass.splice(buildHandlers.sass.indexOf(buildCallback), 1);
        if (filePacketHandlers.sass === filePacketCallback) delete filePacketHandlers.sass;
    };
};