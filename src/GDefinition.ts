import { Schema, Spec } from "swagger-schema-official";
import ts, { factory } from "typescript";
import { GSchema } from "./GSchema";
import { addJSDocComment, getRefedSchema, getRefTypeName } from "./util";

type GDefinitionOptions = {
  ref: string;
  spec: Spec;
};

class GDefinition {
  private ref: string;
  private spec: Spec;
  private schema?: Schema;

  constructor(options: GDefinitionOptions) {
    this.ref = options.ref;
    this.spec = options.spec;
    this.schema = getRefedSchema(this.spec, this.ref);
  }

  private genTypeAlias() {
    const schema = new GSchema(this.schema);
    const typeNode = schema.tsType();
    /**
     * 生成类型,如：
     * type A = {
     *    a: string;
     * }
     */
    const typeAliasDeclaration = factory.createTypeAliasDeclaration(
      undefined,
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(this.identifierName()),
      undefined,
      typeNode
    );

    const comment = schema.jsDoc();
    if (comment) {
      addJSDocComment(typeAliasDeclaration, comment);
    }
    return typeAliasDeclaration;
  }

  identifierName() {
    return getRefTypeName(this.ref);
  }

  tsNode() {
    return this.genTypeAlias();
  }
}

export default GDefinition;
