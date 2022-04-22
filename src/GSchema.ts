import { Schema as SwaggerSchema } from "swagger-schema-official";
import ts, {
  factory,
  SourceFile,
  SyntaxKind,
  TypeElement,
  TypeNode,
} from "typescript";
import { getRefTypeName, addJSDocComment } from "./util";

export class GSchema {
  private schema?: SwaggerSchema;
  private tsTypeNode: ts.TypeNode;
  constructor(swaggerSchema?: SwaggerSchema) {
    this.schema = swaggerSchema;
    this.tsTypeNode = this.genTsType();
  }

  static createComment(swaggerSchema?: SwaggerSchema) {
    if (!swaggerSchema) {
      return null;
    }
    if (swaggerSchema.title || swaggerSchema.description) {
      const comments = [];
      if (swaggerSchema.title) {
        comments.push(swaggerSchema.title);
      }
      if (swaggerSchema.description) {
        comments.push(swaggerSchema.description);
      }
      const jsDoc = factory.createJSDocComment(comments.join("\n"));
      return jsDoc;
    }
    return null;
  }

  private genRefType() {
    const ref = this.schema?.$ref as string;
    const typeName = getRefTypeName(ref);
    return factory.createTypeReferenceNode(typeName, []);
  }

  private genEnumType() {
    const enumTypes = this.schema?.enum as string[];
    const unionNodes = enumTypes.map((literal) => {
      let literalNode;
      if (typeof literal === "object") {
        return factory.createTypeLiteralNode([]);
      }

      if (typeof literal === "number") {
        literalNode = factory.createNumericLiteral(`${literal}`);
      } else if (typeof literal === "string") {
        literalNode = factory.createStringLiteral(literal);
      } else {
        // boolean
        literalNode = literal ? factory.createTrue() : factory.createFalse();
      }
      return factory.createLiteralTypeNode(literalNode);
    });
    return factory.createUnionTypeNode(unionNodes);
  }

  private genStringType() {
    if (this.schema?.enum && this.schema.enum.length) {
      return this.genEnumType();
    }

    return factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  }

  private genNumberType() {
    if (this.schema?.enum && this.schema.enum.length) {
      return this.genEnumType();
    }
    return factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
  }

  private genUnknownType() {
    return factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
  }

  private genAnyType() {
    return factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
  }

  private genBooleanType() {
    return factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
  }

  private genObjectType(): ts.TypeNode {
    const schema = this.schema;
    const additionalProperties = schema?.additionalProperties;
    // https://swagger.io/docs/specification/data-models/data-types/#additionalProperties
    if (
      additionalProperties &&
      Object.keys(additionalProperties).length > 0 &&
      typeof additionalProperties !== "boolean"
    ) {
      return factory.createTypeReferenceNode(
        factory.createIdentifier("Record"),
        [
          factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          new GSchema(additionalProperties).tsType(),
        ]
      );
    }

    if (!schema?.properties) {
      return factory.createTypeReferenceNode(
        factory.createIdentifier("Record"),
        [
          factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
        ]
      );
    }

    const required = schema.required || [];
    const nodes: TypeElement[] = [];
    const properties = schema.properties || {};

    Object.keys(properties).forEach((key) => {
      const subSwaggerSchema = properties[key];
      const subSchema = new GSchema(subSwaggerSchema);
      const subTypeNode = subSchema.tsType();

      const isRequired = required.includes(key);
      const questionToken = isRequired
        ? undefined
        : factory.createToken(SyntaxKind.QuestionToken);

      const propertyNode = factory.createPropertySignature(
        undefined,
        key,
        questionToken,
        subTypeNode as TypeNode
      );

      const comment = GSchema.createComment(subSwaggerSchema);
      if (comment) {
        addJSDocComment(propertyNode, comment);
      }

      nodes.push(propertyNode);
    });

    return factory.createTypeLiteralNode(nodes);
  }

  private genArrayType() {
    if (this.schema?.items) {
      const item = this.schema.items as SwaggerSchema;
      const schema = new GSchema(item);
      return factory.createArrayTypeNode(schema.tsType());
    }
    return factory.createArrayTypeNode(
      factory.createKeywordTypeNode(SyntaxKind.AnyKeyword)
    );
  }

  tsType(): ts.TypeNode {
    return this.tsTypeNode;
  }

  private genTsType(): ts.TypeNode {
    if (!this.schema) {
      return this.genUnknownType();
    }

    if (this.schema.$ref) {
      return this.genRefType();
    }

    if (this.schema.type === "boolean") {
      return this.genBooleanType();
    }

    if (this.schema.type === "string") {
      return this.genStringType();
    }

    if (["number", "integer"].includes(this.schema.type as string)) {
      return this.genNumberType();
    }

    if (this.schema.type === "object") {
      return this.genObjectType();
    }

    if (this.schema.type === "array") {
      return this.genArrayType();
    }

    return this.genAnyType();
  }
}
