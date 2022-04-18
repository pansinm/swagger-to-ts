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
    expect(printNode(gParameter.getTsType())).toBe("User[]");
    expect(printNode(gParameter.getTsParameterDeclaration())).toBe(
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
    expect(printNode(gParameter.getTsType())).toBe("string");
    expect(printNode(gParameter.getTsParameterDeclaration())).toBe(
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
    expect(printNode(gParameter.getTsType())).toBe("string");
    expect(printNode(gParameter.getTsParameterDeclaration())).toBe(
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
    expect(printNode(gParameter.getTsType())).toBe("number");
    expect(printNode(gParameter.getTsParameterDeclaration())).toBe(
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
    expect(printNode(gParameter.getTsType())).toBe("any");
    expect(printNode(gParameter.getTsParameterDeclaration())).toBe(
      "file?: any"
    );
  });
});
