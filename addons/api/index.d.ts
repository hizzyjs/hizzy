// @ts-ignore
import Hizzy from "hizzy";
import {Request, Response} from "express";

type Method = "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head";

type APIComponent = (props: {
    path: string,
    method?: Method,
    handle: ((request: Request, response: Response) => any)
}) => any;

declare class APIAddon extends Hizzy.API.AddonModule {
    static API: APIComponent;
}

type pkg = APIAddon;
export = pkg;