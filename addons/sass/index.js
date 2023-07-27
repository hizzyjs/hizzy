const {AddonModule, preFileHandlers, buildHandlers} = Hizzy;
const sass = require("sass");
const csso = require("csso");

const preFileCallback = (file, content, f, c, cn) => {
    if (content.startsWith("/*SASS\x00HIZZY*/")) {
        f(".css");
        preFileHandlers.css(".css", content, f, c, cn);
    }
};
const buildCallback = (file, get, set) => set("/*SASS\x00HIZZY*/" + csso.minify(sass.compileString(get)));

module.exports = class MyAddon extends AddonModule {
    onEnable() {
        preFileHandlers.sass = preFileCallback;
        if (!buildHandlers.sass) buildHandlers.sass = [];
        buildHandlers.sass.push(buildCallback);
    };

    onDisable(reason) {
        if (preFileHandlers.sass === preFileCallback) delete preFileHandlers.sass;
        buildHandlers.sass.splice(buildHandlers.sass.indexOf(buildCallback), 1);
    };
};