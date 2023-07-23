const {AddonModule} = Hizzy;
const React = require("preact");

const self = module.exports = class APIAddon extends AddonModule {
    static API = function (props = {}, ...a) {
        return React.createElement(Route, {
            path: props.path,
            method: props.method,
            onRequest: async (req, res) => {
                let r = props.handle;
                if (typeof r === "function") r = await r(req, res);
                if (res.headersSent) return;
                if (typeof r === "object") return res.json(r);
                return res.send(r.toString());
            }
        }, ...a);
    }
};

self.API.isRouteParent = true;