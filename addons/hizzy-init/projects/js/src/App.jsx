import {resolvePath, useState} from "hizzy";
import "./App.css";

function Main() {
    const [count, setCount] = useState(0);
    const setC = v => setCount(v);

    // @server/respond
    async function getClicks() {
        return Hizzy.useGlobalState(null, 0).get();
    }
    getClicks().then(setCount);

    // @server
    async function onClick() {
        const {get, set} = Hizzy.useGlobalState(null, 0);
        set(v => v + 1);
        await setC.everyone(get());
    }

    return <div className="container">
        <a href="https://hizzyjs.github.io/" target="_blank"><img src={resolvePath("../assets/hizzy.svg")}
                                                                  className="logo"
                                                                  alt="Hizzy Logo" draggable={false}/></a>
        <h1>Hizzy</h1>
        <button onClick={onClick} onContextMenu={onClick}>count is {count}</button>
        <p>Edit <code>src/App.jsx</code> and save to test HMR</p>
        <p className="gray">Click on the Hizzy logo to learn more</p>
    </div>;
}

export default Main;