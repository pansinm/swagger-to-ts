import { Schema, Spec } from "swagger-schema-official";
import _ from 'lodash';
import GDefinition from "../GDefinition";
import { printNode } from "../util";
import swagger from "./fixtures/swagger.json";

describe("GDefinition", () => {
  it("能够将definitions转换成类型定义，并标注注释", () => {
    const spec = _.cloneDeep(swagger);
    (spec.definitions.Tag as Schema).description = '测试'
    const gDef = new GDefinition({ ref: "#/definitions/Tag", spec: spec as Spec });
    expect(printNode(gDef.tsNode())).toBe(`
/**
 * 测试 */
export type Tag = {
    id?: number;
    name?: string;
};
`.trim())
  });
});
