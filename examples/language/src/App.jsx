import {Lang} from "@hizzyjs/language";

export default <div>
    <Lang value="hey" args={{key: "this was replaced!"}}/><br/>
    <Lang v="hey" args={{key: "this was replaced!"}}/><br/>
    <button onClick={() => Lang.language = Lang.next}>Change language</button>
</div>;