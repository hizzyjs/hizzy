const {AddonModule} = Hizzy;
module.exports = class HelmetAddon extends AddonModule {
    onLoad() {
        this.onClientSideLoad = () => {
            function Helmet(props) {
                Hizzy.render(Hizzy.createElement(Hizzy.Fragment, null, ...(Array.isArray(props.children) ? props.children : [props.children])), document.head);
                return Hizzy.createElement(Hizzy.Fragment, null);
            }

            return {Helmet, default: Helmet};
        };
    };
};