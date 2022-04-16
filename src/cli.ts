#!/usr/bin/env node
import { program } from "commander";
import nodeFetch from "node-fetch";
import Generator, { GeneratorOptions } from "./Generator";
import fse from "fs-extra";
import ts from "typescript";
import path from "path";
import { Path, Operation, Spec } from "swagger-schema-official";
import prettier from "prettier";

const printer = ts.createPrinter({
  newLine: ts.NewLineKind.CarriageReturnLineFeed,
});

program
  .option("-s, --swagger [swagger]", "swagger路径或url")
  .option("-o, --output [output]", "输入目录")
  .option("--exclude-tags [excludeTags]", "排除指定tag，逗号分割")
  .option("--include-tags [includeTags]", "只生成特定tag的接口,逗号分割")
  .option("--exclude-path [excludePath]", "排除特定路径，支持正则")
  .option("--include-path [includePath]", "只生存特定路径接口，支持正则")
  .option("--http-client-output [path]", "httpClient输出路径，默认存于输出目录")
  .option("--config [config]", "使用配置文件")
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

interface GenerateOptions extends Partial<GeneratorOptions> {
  pathOrUrl: string;
  outputDir: string;
  httpClientOutputDir: string;
  /**
   * 处理前修正swagger
   */
  fixSpec?: (spec: Spec) => Spec | Promise<Spec>;
}

async function getSwagger(pathOrUrl: string) {
  if (/https?:/.test(pathOrUrl)) {
    const res = await nodeFetch(pathOrUrl, {
      headers: { Accept: "application/json, text/plain" },
    });
    const spec = (await res.json()) as Spec;
    return spec;
  }
  const json = fse.readFileSync(pathOrUrl, "utf-8");
  return JSON.parse(json);
}

async function generate({
  pathOrUrl,
  outputDir,
  httpClientOutputDir,
  ...rest
}: GenerateOptions) {
  let spec = await getSwagger(pathOrUrl);
  if (rest.fixSpec) {
    await rest.fixSpec(spec);
  }
  let httpClientPath = path
    .relative(
      path.resolve(outputDir),
      path.resolve(httpClientOutputDir, "httpClient")
    )
    .replace(/\\/g, "/");
  httpClientPath = httpClientPath.startsWith(".")
    ? httpClientPath
    : "./" + httpClientPath;
  const gen = new Generator(spec, { ...rest, httpClientPath });
  const sourceFiles = gen.generate();
  sourceFiles.forEach((sourceFile) => {
    const filename = outputDir + "/" + sourceFile.fileName;
    fse.ensureFileSync(filename);
    const result = prettier.format(
      printer.printFile(sourceFile),
      prettierConfig
    );
    fse.writeFileSync(filename, result);
  });

  const configDir = path.join(__dirname, "../config");
  fse.copySync(configDir, httpClientOutputDir);
}

async function run() {
  try {
    if (options.config) {
      const config = require(path.resolve(options.config));
      for (let swagger of config.swaggers) {
        await generate({
          ...swagger,
          pathOrUrl: swagger.swagger,
          outputDir: swagger.output,
          httpClientOutputDir:
            swagger.httpClientOutput ||
            config.httpClientOutput ||
            swagger.output,
        });
      }
    } else {
      const pathOrUrl = options.swagger;
      const outputDir = options.output;
      const httpClientOutput = options.httpClientOutput || outputDir;
      const excludePath = options.excludePath;
      const includePath = options.includePath;
      const excludeTags = options.excludeTags;
      const includeTags = options.includeTags;
      await generate({
        pathOrUrl,
        outputDir,
        httpClientOutputDir: httpClientOutput,
        excludePath,
        excludeTags,
        includePath,
        includeTags,
      });
    }
  } catch (err) {
    // tslint:disable-next-line: no-console
    console.error(err);
  }
}

run();
