// @ts-ignore
import Hizzy from "hizzy";
import {NextFunction, Request, Response} from "express";
import {EventEmitter} from "events";

type CookieAuthOptions = {
    cookie?: string
};
type AuthRequest = Request | typeof Hizzy.API.Client;

declare class CookieAuth extends EventEmitter {
    tokens: Record<string, any>;

    constructor(options?: CookieAuthOptions, defCookie?: string);

    get cookie(): string;

    __login(request: AuthRequest, user: any, pk?: boolean): Promise<string | false>;

    logout(request: AuthRequest, pk?: boolean): Promise<boolean>;

    __required(val: 0 | 1, request: Request, response: Response, next: NextFunction, url: string): void;

    required(...args): (request: Request, res: Response, next: NextFunction) => void;

    unrequired(...args): (request: Request, res: Response, next: NextFunction) => void;

    hasAuthenticated(request: AuthRequest): boolean;

    getData(request: AuthRequest): any | undefined;

    on(eventName: "tokens.update", listener: () => void): this;
    on(eventName: "tokens.add", listener: (token: string, user: any) => void): this;
    on(eventName: "tokens.remove", listener: (token: string) => void): this;

    once(eventName: "tokens.update", listener: () => void): this;
    once(eventName: "tokens.add", listener: (token: string, user: any) => void): this;
    once(eventName: "tokens.remove", listener: (token: string) => void): this;

    off(eventName: "tokens.update", listener: () => void): this;
    off(eventName: "tokens.add", listener: (token: string, user: any) => void): this;
    off(eventName: "tokens.remove", listener: (token: string) => void): this;
}

declare class LocalAuthentication extends CookieAuth {
    constructor(options?: CookieAuthOptions);

    login(request: AuthRequest, user: Object, pk?: boolean): Promise<boolean>;
}

declare class DiscordAuthentication extends CookieAuth {
    constructor(options?: CookieAuthOptions & {
        clientId: string,
        clientSecret: string,
        callbackURL: string,
        scopes: string[]
    });

    get authenticationURL(): string;

    createCallback(redirectURL: string): (request: Request, response: Response, next: NextFunction) => Promise<void>;
}

declare class AuthenticationAddon extends Hizzy.API.AddonModule {
    static LocalAuthentication: typeof LocalAuthentication;
    static DiscordAuthentication: typeof DiscordAuthentication;
    static _CookieAuth: typeof CookieAuth;
}

export default AuthenticationAddon;
export {LocalAuthentication, DiscordAuthentication, CookieAuth as _CookieAuth};