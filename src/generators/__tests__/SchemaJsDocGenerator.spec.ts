import { SchemaJsDocGenerator } from "../SchemaJsDocGenerator";
import { assertCode } from "./utils";

describe("test SchemaJsDocGenerator", () => {
  it("当schema含有description字段时，生成jsDoc节点", () => {
    /**
     * { description: '注释'} => /** 注释 *\/
     */
    const docGen = new SchemaJsDocGenerator({ description: "注释" });
    assertCode(
      docGen.generate(),
      `
    /**
     * 注释
     */
     `
    );
  });
});
