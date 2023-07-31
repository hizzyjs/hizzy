import a from "./App2";

const chalk = await import("chalk");

console.log(a)
console.log(chalk.default.red("Hey!"));

export default <div>Hello, world! {a}</div>