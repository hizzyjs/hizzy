// @ts-ignore
import Hizzy from "hizzy";

declare class LanguageAddon extends Hizzy.API.AddonModule {
}

type pkg = LanguageAddon & {
    get language(): string
    set language(lang: string)
    get languages(): string[],
    get container(): { readonly [language: string]: Record<string, string> }
    get next(): string
};
export const Lang = (props?: {
    children?: string,
    value?: string,
    v?: string,
    args?: Record<string, string> | string[],
    nested?: boolean
}) => any;

export function translate(key: string, nested?: boolean, args?: Record<string, string>): string;

export default pkg;
export type Config = {

};