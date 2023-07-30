// @ts-ignore
import Hizzy from "hizzy";

declare class HTML2ReactAddon extends Hizzy.API.AddonModule {
}

export default HTML2ReactAddon;

export function convert(element: Element): any;

export function html(text: string): Element;

export function spread(): void;