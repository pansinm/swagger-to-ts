import { Spec } from "swagger-schema-official";
import Generator from "../Generator";
import { printNode } from "../util";
import { definitionsOutput } from "./fixtures/output";
import swagger from "./fixtures/swagger.json";

describe("Generator", () => {
  it("能够将spec生成definitions", () => {
    const generator = new Generator(swagger as Spec, {
      httpClientPath: "./httpClient",
    });
    const [_, definitionFile] = generator.generate();
    const trim = (str: string) => str.replace(/\s|\'|\"/g, "");
    expect(trim(printNode(definitionFile))).toBe(trim(definitionsOutput));
  });
});
