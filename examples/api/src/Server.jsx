import ApiAddon from "@hizzyjs/api";

const {API} = ApiAddon;

export default <Routes>
    <Route path="/" route="./App.jsx"/>
    <API path="/a" handle={{a: "b"}}/>
    <API path="/b" handle={req => req.headers.referer ? "good" : "bad!"}/>
</Routes>;