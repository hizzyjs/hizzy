import {API} from "@hizzyjs/api";

export default <Routes>
    <API path="/" handle={"hello, world!"}/>
    <API path="/a" handle={{a: "b"}}/>
    <API path="/b" handle={req => req.headers.referer ? "good" : "bad!"}/>
</Routes>;