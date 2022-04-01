import { Generator } from "./Generator";
import { ParameterType } from "swagger-schema-official";
import ts from "typescript";

export interface PrimitiveTypeSchema {
  type: ParameterType;
  enum?: any[];
}
export class PrimitiveTypeGenerator implements Generator {
  schema: PrimitiveTypeSchema;
  constructor(schema: PrimitiveTypeSchema) {
    this.schema = schema;
  }
  generate(): [ts.TypeNode] {
    if (this.schema.type === "number" || this.schema.type === "integer") {
      return [ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)];
    }
    if (this.schema.type === "boolean") {
      return [ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword)];
    }
    if (this.schema.type === "string") {
      if (this.schema.enum) {
        return [
          ts.createUnionTypeNode(
            this.schema.enum.map((str) =>
              ts.createLiteralTypeNode(ts.createStringLiteral(str))
            )
          ),
        ];
      }
      return [ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword)];
    }

    if (this.schema.type === "file") {
      return [ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)];
    }

    if (this.schema.type === "array") {
      console.error("array 类型请不要使用 PrimitiveGenerator");
      return [
        ts.createArrayTypeNode(
          ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
        ),
      ];
    }
    console.error(`PrimitiveTypeGenerator 不支持 ${this.schema.type}`);
    return [ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)];
  }
}
