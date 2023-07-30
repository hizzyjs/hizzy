const {AddonModule} = Hizzy;
module.exports = class HTML2ReactAddon extends AddonModule {
    onClientSideLoad = (() => {
        const json = $json;
        const events = $events;
        const upperHelper = (text, helper) => {
            if (typeof helper === "number") helper = [helper];
            return text.split("").map((i, j) => helper.includes(j) ? i.toUpperCase() : i).join("");
        };
        customExports["@hizzyjs/html2react?spread"] = async () => {
            spread();
            return await import_("@hizzyjs/html2react");
        };
        const spread = () => {
            fileHandlers.build.html = (name, content) => {
                exports[name] = {default: convert(html(content))};
                hasExported.push(name);
                return exports[name];
            };
            fileHandlers.external.html = (name, content) => ({default: convert(html(content))});
        };
        const html = text => new DOMParser().parseFromString(text, "text/html");
        /*** @param el {HTMLElement | ChildNode | Document} */
        const convert = el => {
            if (el instanceof Text) return el.textContent;
            const props = {};
            const attrList = el.attributes || [];
            for (let i = 0; i < attrList.length; i++) {
                const attr = attrList[i];
                let nm = attr.name.toLowerCase();
                let vl = attr.value;
                if (nm === "style") {
                    const d = document.createElement("div");
                    d.style.cssText = vl;
                    vl = {};
                    for (let i = 0; i < d.style.length; i++)
                        vl[d.style[i]] = d.style.getPropertyValue(d.style[i]);
                    props[nm] = vl;
                    continue;
                }
                if (nm.includes("-")) {
                    nm = nm.split("-").map((i, j) => j === 0 ? i : i[0].toUpperCase() + i.substring(1));
                    props[nm] = vl;
                    continue;
                }
                if (nm.startsWith("on")) {
                    nm = "on" + upperHelper(nm.substring(2), [...(events[nm.substring(2)] || []), 0]);
                    vl = Function("event", vl);
                }
                if (json[nm]) nm = upperHelper(nm, json[nm]);
                props[nm] = vl;
            }
            return react.createElement(el.tagName ? el.tagName.toLowerCase() : react.Fragment, props, ...[...el.childNodes].map(convert));
        };
        return {html, convert, spread};
    }).toString()
        .replace("$json", JSON.stringify(require("./attr.json")))
        .replace("$events", JSON.stringify(require("./events.json")));
};