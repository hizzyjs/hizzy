const fs = require("fs");
const path = require("path");
const {AddonModule} = Hizzy;
module.exports = class LanguageAddon extends AddonModule {
    onEnable() {
        const directory = this.options.directory;
        if (typeof directory !== "string" || !fs.existsSync(path.join(Hizzy.directory, directory)) || !fs.statSync(path.join(Hizzy.directory, directory)).isDirectory()) {
            return this.disable("not having a valid 'directory' property as a directory path in the 'hizzy-language' configuration.");
        }
        const container = {};
        fs.readdirSync(path.join(Hizzy.directory, directory)).forEach(i => {
            if (!i.endsWith(".json")) return;
            const n = i.split(".")[0];
            container[n] = JSON.parse(fs.readFileSync(path.join(Hizzy.directory, directory, i), "utf8"));
        });
        if (!Object.keys(container).length) return;
        this.onClientSideLoad = (() => {
            const [def, container, chr] = $conf;
            const ck = "__hizzy__lang__=";
            let lang = (d.cookie.split(";").find(i => i.trim().startsWith(ck)) || ck + def).trim().substring(ck.length);
            const hooks = [];
            Object.freeze(container);
            const translate = (str, nested = true, args = {}) => {
                let cur = container[lang];
                str = str.trim();
                if (nested) for (const k of str.split(".")) cur = (cur || {})[k] || "";
                else cur = cur[str];
                cur = cur || "";
                if (typeof cur !== "string") return cur;
                return cur.replaceAll(new RegExp(chr + "[a-zA-Z\\d]+", "g"), m => {
                    m = m.substring(1);
                    if (m in args) return args[m];
                    return chr + m;
                });
            };

            function Lang(props = {}) {
                const k = typeof props.children === "string" ? props.children : props.value || props.v || "";
                const args = props.args || {};
                const [g, s] = Hizzy.useState(translate(k, props.nested !== false, args));
                hooks.push([s, k, props.nested !== false, args]);
                return react.createElement(react.Fragment, null, g);
            }

            Object.defineProperties(Lang, {
                language: {
                    get: () => lang,
                    set: s => {
                        if (!container[lang]) throw new Error("@hizzyjs/language: Invalid language: " + lang);
                        lang = s;
                        hooks.forEach(([s, ...k]) => s(translate(...k)));
                        d.cookie = ck + lang;
                    }
                },
                languages: {
                    get: () => Object.keys(container)
                },
                container: {
                    get: () => ({...container})
                },
                next: {
                    get: () => {
                        const L = Object.keys(container);
                        let index = L.indexOf(lang);
                        if (index === -1) throw new Error("@hizzyjs/language: Invalid language!");
                        if (index === L.length - 1) index = -1;
                        return L[index + 1];
                    }
                }
            });
            return {default: Lang, Lang, translate};
        }).toString().replace("$conf", JSON.stringify([
            this.options.default || Object.keys(container)[0],
            container, this.options.character || "%"
        ]));
    };
};