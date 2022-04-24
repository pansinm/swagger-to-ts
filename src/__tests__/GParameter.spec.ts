import { Parameter } from "swagger-schema-official";
import GParameter from "../GParameter";
import { printNode } from "../util";
import swagger from "./fixtures/swagger.json";

describe("GParameter", () => {
  it("能够正确转换body类型", () => {
    const gParameter = new GParameter(
      swagger.paths["/user/createWithArray"]["post"][
        "parameters"
      ][0] as Parameter
    );
    expect(printNode(gParameter.tsType())).toBe("User[]");
    expect(printNode(gParameter.tsNode())).toBe(
      "body: User[]"
    );
  });
  it("能够正确转换query类型", () => {
    const gParameter = new GParameter({
      name: "username",
      in: "query",
      description: "The user name for login",
      required: true,
      type: "string",
      default: "joy",
    });
    expect(printNode(gParameter.tsType())).toBe("string");
    expect(printNode(gParameter.tsNode())).toBe(
      'username: string = "joy"'
    );
  });
  it("能够正确转换可选参数", () => {
    const gParameter = new GParameter({
      name: "username",
      in: "query",
      description: "The user name for login",
      required: false,
      type: "string",
    });
    expect(printNode(gParameter.tsType())).toBe("string");
    expect(printNode(gParameter.tsNode())).toBe(
      "username?: string"
    );
  });
  it("能够设置默认值", () => {
    const gParameter = new GParameter({
      name: "count",
      in: "query",
      type: "number",
      default: 1,
    });
    expect(printNode(gParameter.tsType())).toBe("number");
    expect(printNode(gParameter.tsNode())).toBe(
      "count: number = 1"
    );
  });
  it("如果类型是file，类型为any", () => {
    const gParameter = new GParameter({
      name: "file",
      in: "formData",
      description: "file to upload",
      required: false,
      type: "file",
    });
    expect(printNode(gParameter.tsType())).toBe("any");
    expect(printNode(gParameter.tsNode())).toBe(
      "file?: any"
    );
  });

  it('jsDocTag 返回该参数注释', () => {
    const gParameter = new GParameter({
      name: "count",
      in: "query",
      type: "number",
      default: 1,
      description: '注释'
    });
    expect(printNode(gParameter.jsDocTag())).toBe(
      "@param {number} count 注释"
    );
  })
});
