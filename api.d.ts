// noinspection JSUnusedGlobalSymbols

import {Express, Request, Response} from "express";

type Socket = Record<any, any>;
type Method = "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head";
type SocketTraveler = string | number | boolean | null | SocketTraveler[] | {
    [key: any]: SocketTraveler
};
type onRequestFunction<T> = (request: Request, response: Response, next: ((...args: any[]) => T), ...args: any[]) => any;
type RoutesComponent = (props: { children?: RouteComponent | RouteComponent[] | any }) => any;
type RouteComponent = (props: {
    path: string | Location,
    route?: string,
    method?: Method,
    allow?: string[] | "*" | "auto",
    deny?: string[] | "*",
    // todo: a request event class, maybe a combination of request and response
    onRequest?: onRequestFunction<void | Promise<void>>[] | onRequestFunction<void | Promise<void>>,
    children?: null | RouteComponent | RouteComponent[]
}) => any;

type Shortcut = {
    description: string,
    enabled: boolean,
    cooldown?: number,
    run: () => void
};

type AddonConfig<T extends string> = import(T).Config;
type AddonConf<T extends string> = Record<T, AddonConfig<T>> | T[] | [T, AddonConfig<T>][];

type HizzyConfiguration = {
    dev?: boolean,
    port?: number,
    fileRefresh?: boolean,
    autoBuild?: boolean,
    listen?: boolean,
    main?: string,
    mainModule?: boolean,
    baseHTML?: string,
    allowAllPackages?: boolean,
    checkConfig?: boolean,
    realtime?: boolean,
    https?: boolean,
    srcFolder?: string,
    connectionTimeout?: number,
    keepaliveTimeout?: number,
    clientKeepalive?: number,
    minClientKeepalive?: number,
    includeOriginalInBuild?: boolean,
    addons?: AddonConf,
    static?: Record<string, string> | string[],
    cache?: {
        "addons"?: number,
        "npm"?: number,
        "preact"?: number,
        "preact-hooks"?: number,
        "html-injection"?: number,
        "jsx-injection"?: number,
        "static"?: Record<string, number> | number
    },
    warnAboutTypes?: boolean,
    serverClientVariables?: boolean
};

declare class AddonModule {
    constructor(pkg: Object, options: Object);

    get name(): string;

    get description(): string;

    get version(): string;

    get options(): Object;

    onLoad(): void;

    onEnable(): void;

    onDisable(reason: string): void;

    onClientSideLoad: string | Function;

    onClientSideRendered: string | Function;

    onClientSideError: string | ((error: Error) => void);

    disable(reason: string): void;

    log(...s: any[]): void;
}

declare class Client {
    static clients: Record<string, Client>;
    private __socket: Socket;
    class: typeof Client;
    attributes: Record<string | number | symbol, any>;

    constructor(socket: Socket);

    get uuid(): string;

    get ip(): string;

    get request(): Request;

    get actualRequest(): Request;

    eval(code: string): Promise<SocketTraveler>;

    remove(reason?: string): void;

    run(file: string, name: string, ...args: SocketTraveler[]): Promise<SocketTraveler>;
}

declare class Addon_ {
    static addons: Record<string, Addon_>;

    static create(name: string | AddonModule, options: Object): Promise<Addon_>;

    constructor(name: string | AddonModule, options: Object);

    get options(): Object;

    get name(): string;

    get module(): AddonModule;
}

declare class APIClass {
    static API: APIClass;
    Addon: typeof Addon_;
    AddonModule: typeof AddonModule;
    Client: typeof Client;
    Route: RouteComponent;
    Routes: RoutesComponent;
    socketServer;
    server;
    app: Express;
    autoRefresh: boolean;
    dev: boolean;
    routes: Record<string, string>;
    customShortcuts: Record<string, Shortcut>;
    preRequests: Function[];
    preRawSend: Function[];
    buildHandlers: Record<string, (
        (file: string, content: string, setContent: (content: string) => void, zip: any, extension: string, location: string[]) => any
        )[]>;
    scanHandlers: Record<string, Record<string, ((location: string, data: string, files: Record<string, string>) => any)[]>>;
    functionDecorators: Record<string, ((data: {
        start: number,
        end: number,
        name: string,
        leadingComments: { value: string }[],
        code: string,
        json: Object,
        replaceText: (position: { start: number, end: number }, text: string) => void
    }) => any)[]>;
    preFileHandlers: Record<string, (file: string, content: string, setFile: (file: string) => void, setContent: (content: string) => void, cancel: () => void) => any>;
    filePacketHandlers: Record<string, (file: string, content: Buffer) => string>;

    constructor(dir: string);

    init(): Promise<void>;

    findOptimalFile(file: string): string | null;

    sendErrorMessage(html: string, request: Request, response: Response, span: string | null): void;

    cacheDevFile(file: string): string | Buffer;

    cacheBuildFile(file: string, request: Request, response: Response): Promise<string | Object>;

    notFound(request: Request, response: Response): Promise<void>;

    getClientData(request: Request, response: Response): Object;

    prepLoad(request: Request, response: Response): void;

    renderHTML(content: string, request: Request, response: Response): void;

    sendRawFile(file: string, content: string, request: Request, response: Response, force?: boolean): void;

    sendFile(file: string, content: string, request: Request, response: Response): void;

    enableRealtime(): void;

    listen(): Promise<void>;

    build(): Promise<void>;

    buildMainFile(): Promise<void>;

    scanBuild(): Promise<void>; // todo: make this file richer(fix 'any's and potential 'void's)

    renderJSX(file, code, req, res): Promise<any>;

    waitBuild(): Promise<void>;

    waitBuildScanning(): Promise<void>;

    sendEvalTo(uuid: string, code: string): Promise<SocketTraveler>;

    clientUUIDs(): string[];

    random(): string;

    broadcastEval(code: string): Promise<Record<string, SocketTraveler>>;

    getHash(uuid: string): string | null;

    findClient(uuid: string): Client | Record<string, SocketTraveler> | null;

    findSocket(uuid: string): Socket | null;

    get directory(): string;

    makeClientFunction(file: string, name: string, uuid?: string | null): Function;

    getAddon(name: string): Addon_ | null;

    getAddons(): Record<string, Addon_>;

    jsxToJS(code: string | Buffer, extension: string): string;

    tsToJS(code: string | Buffer): string;

    processMain(code: string | Buffer): Promise<void>;

    processDevMain(): Promise<void>;

    getCookie(cookies: string, cookie: string): string | null;

    useGlobalState<T>(key?: any, default_?: T): {
        get: () => T,
        set: (value: T | ((current: T) => T)) => T,
        delete: () => void
    };

    useCooldown<T>(key?: any, clientOrIp: any, options: { amount: number, time: number }): boolean;

    watchFile(file: string): void;

    defineConfig(configuration: HizzyConfiguration): HizzyConfiguration;
    defineConfig(configurationFunction: (options: {
        argv: Record<string, string>,
        isDev: boolean
    }) => HizzyConfiguration): HizzyConfiguration;

    minify: {
        js: (code: string) => string,
        css: (code: string) => string,
        html: (code: string) => string
    };
}

declare global {
    let Hizzy: APIClass;
    /*** @description # This variable only works in server-side! */
    const currentUUID: string;
    /*** @description # This variable only works in server-side! */
    const currentClient: Client;
    /*** @description # This variable only works in client-side! */
    const currentWebSocket: WebSocket;
    let Routes: RoutesComponent;
    let Route: RouteComponent;

    interface Function {
        everyone: (...args: SocketTraveler[]) => Promise<Record<string, SocketTraveler>>;
        toClients: (clients: (Client | {uuid: string} | string)[]) => (...args: SocketTraveler[]) => Promise<Record<string, SocketTraveler>>;
    }
}/* ### TYPES ### */
export {HizzyConfiguration};
export default APIClass;

export type {
    Socket,
    SocketTraveler,
    Addon_,
    AddonConfig,
    AddonModule,
    AddonConf,
    Client,
    APIClass,
    onRequestFunction,
    Shortcut,
    RouteComponent,
    RoutesComponent,
    Method
};