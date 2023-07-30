const {AddonModule} = Hizzy;
const React = require("preact");

function API(props = {}, ...a) {
    // noinspection JSCheckFunctionSignatures
    return React.createElement(Route, {
        path: props.path,
        method: props.method,
        onRequest: async (req, res, next) => {
            let r = props.handle;
            if (typeof r === "function") {
                let cn = false;
                r = await r(req, res, () => cn = true);
                if (cn) return next();
            }
            if (res.headersSent) return;
            if (typeof r === "object") return res.json(r);
            return res.send(r.toString());
        }
    }, ...a);
}

module.exports = class APIAddon extends AddonModule {
};

API.isRouteParent = true;
module.exports.API = API;