import { Schema } from "swagger-schema-official";
import { GSchema } from "../GSchema";
import { printNode } from "../util";
import swagger from "./fixtures/swagger.json";
describe("GSchema", () => {
  it("正确生成枚举类型", () => {
    const schema = new GSchema(
      swagger.definitions.Pet.properties.status as Schema
    );
    expect(printNode(schema.toTsType())).toBe(
      '"available" | "pending" | "sold"'
    );
  });
  it("number和integer都会生成number类型", () => {
    const schemaN = new GSchema({ type: "number" });
    const schemaI = new GSchema({ type: "integer" });
    expect(printNode(schemaN.toTsType())).toBe("number");
    expect(printNode(schemaI.toTsType())).toBe("number");
  });
  it("能够正确生成array类型", () => {
    const schema = new GSchema(
      swagger.definitions.Pet.properties.tags as Schema
    );
    expect(printNode(schema.toTsType())).toBe("Tag[]");
  });
  it("正确生成ref类型，不合法字符转换成下划线", () => {
    const schema = new GSchema({ $ref: "#/definitions/Test." });
    expect(printNode(schema.toTsType())).toBe("Test_");
  });
  it("正确生成object，并为字段添加注释", () => {
    const schema = new GSchema(swagger.definitions.Order as Schema);
    expect(printNode(schema.toTsType())).toBe(`{
    id?: number;
    petId?: number;
    quantity?: number;
    shipDate?: string;
    /**
     * Order Status */
    status?: "placed" | "approved" | "delivered";
    complete?: boolean;
}`);
  });
  it("createJSComment能够将schema中title和description生成注释", () => {
    const jsdoc = GSchema.createComment(
      swagger.definitions.Pet.properties.status as Schema
    );
    expect(printNode(jsdoc!)).toMatch("pet status in the store");
  });

  it("如果schema不存在，返回unknown类型", () => {
    const schema = new GSchema(undefined);
    expect(printNode(schema.toTsType())).toBe("unknown");
  });

  it("如果类型是file，返回any类型", () => {
    const schema = new GSchema({ type: "file" });
    expect(printNode(schema.toTsType())).toBe("any");
  });
});
