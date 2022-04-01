#!/usr/bin/env node
import { program } from "commander";
import nodeFetch from "node-fetch";
import { Generator } from "./Generator";
import fse from "fs-extra";
import ts from "typescript";
import path from "path";
import { Path, Operation, Spec } from "swagger-schema-official";
import prettier from "prettier";

const printer = ts.createPrinter({
  newLine: ts.NewLineKind.CarriageReturnLineFeed,
});

program
  .option("-i, --input [input]", "输入url")
  .option("-o, --output [output]", "输入目录")
  .option("-t, --tag [tag]", "只生成特定tag的接口")
  .parse(process.argv);

const options = program.opts();

const prettierConfig: prettier.Options = {
  printWidth: 100, // https://github.com/airbnb/javascript#19.13
  tabWidth: 2, // https://github.com/airbnb/javascript#19.1
  useTabs: false, // https://github.com/airbnb/javascript#19.1
  semi: true, // https://github.com/airbnb/javascript#21.1
  singleQuote: true, // https://github.com/airbnb/javascript#6.1
  quoteProps: "as-needed", // https://github.com/airbnb/javascript#3.6
  jsxSingleQuote: false, // https://github.com/airbnb/javascript/tree/master/react#quotes
  trailingComma: "all", // https://github.com/airbnb/javascript#20.2
  bracketSpacing: true, // https://github.com/airbnb/javascript#19.12
  arrowParens: "always", // https://github.com/airbnb/javascript#8.4
  parser: "typescript",
};
async function run() {
  try {
    const url = options.input;
    const dir = options.output;
    const res = await nodeFetch(url, {
      headers: { Accept:	'application/json, text/plain'},
    });
    const spec = await res.json() as Spec;
    const tag = options.tag;
    let filter: any = () => true;
    if (tag) {
      filter = (url: string, operation: Operation) => {
        return operation && operation.tags && operation.tags.includes(tag);
      };
    }
    const gen = new Generator(spec, filter);
    gen.generate();
    Object.entries(gen.sources).forEach(([fileName, sourceFile]) => {
      let pathName = fileName;
      if (dir) {
        pathName = path.posix.join(dir, pathName);
      }
      fse.ensureFileSync(pathName);
      const result = prettier.format(
        printer.printFile(sourceFile),
        prettierConfig
      );

      fse.writeFileSync(pathName, result);
    });

    const configDir = path.join(__dirname, "../config");
    const distDir = path.join(dir || "", "config");
    if (!fse.existsSync(distDir)) {
      fse.ensureDirSync(distDir);
      fse.copySync(configDir, distDir);
    }
  } catch (err) {
    // tslint:disable-next-line: no-console
    console.error(err);
  }
}

run();
