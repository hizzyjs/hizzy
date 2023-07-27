import App2 from "./App2";
import chalk from "chalk";

// @server
function serverFunction() {
    console.log(chalk.red("in server side"));
}

serverFunction();
console.log(chalk.red("in client side"));
export default <div>Hello, world! <App2/></div>;