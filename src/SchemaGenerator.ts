import { Schema, Spec } from "swagger-schema-official";
import ts, { factory, JSDoc, ScriptTarget, SourceFile, SyntaxKind, TypeElement, TypeNode } from "typescript";
import { NodeDesc } from "./interfaces";
import { getModelName, createModelFileName, createNodeDesc } from "./util";
import { getRefedValue } from "./json-refs";
import path from "path";

type SourceFileMap = {
  [fileName: string]: SourceFile;
};

export class SchemaGenerator {
  sources: SourceFileMap;
  sourceState: { [fileName: string]: "CREATING" | "CREATED" | undefined } = {};
  spec: Spec;
  constructor(parentSources: SourceFileMap, spec: Spec) {
    this.sources = parentSources;
    this.spec = spec;
  }

  createRefTypeDesc(refSchema: Schema) {
    const ref = refSchema.$ref as string;
    const { typeName, fileName } = this.createSourceFile(ref);

    return createNodeDesc(
      factory.createTypeReferenceNode(typeName, []),
      [fileName],
      this.createCommentNode(refSchema.description)
    );
  }

  private createSourceFile(ref: string) {
    const typeName = getModelName(ref);
    const fileName = createModelFileName(ref);
    if (this.sourceState[fileName]) {
      return {
        typeName,
        fileName,
      };
    }
    this.sourceState[fileName] = "CREATING";
    // ref指向的definition
    const subSchema = getRefedValue(this.spec, ref);
    if (!subSchema) {
      console.error('文档未定义: ' + ref);

    }
    const desc = this.createSchemaTypeDesc(subSchema);

    const statements: ts.Node[] = desc.dependencies
      .filter((dependency) => dependency !== fileName)
      .map((dependency) => {
        let relativeFileName = path.relative(
          path.posix.dirname(fileName),
          dependency
        );
        if (!relativeFileName.startsWith(".")) {
          relativeFileName = "./" + relativeFileName.replace(/\.ts/g, "");
        }
        return factory.createImportDeclaration(
          undefined,
          undefined,
          factory.createImportClause(
            false,
            undefined,
            factory.createNamedImports([
              factory.createImportSpecifier(
                false,
                undefined,
                factory.createIdentifier(
                  path.posix.basename(relativeFileName, ".ts")
                )
              ),
            ])
          ),
          factory.createStringLiteral(relativeFileName)
        );
      });

    let sourceFileNode = ts.createSourceFile(
      fileName,
      "",
      ScriptTarget.Latest
    );
    if (desc.comment) {
      statements.push(desc.comment);
    }
    const node = factory.createTypeAliasDeclaration(
      undefined,
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createIdentifier(typeName),
      undefined,
      desc.node as ts.TypeNode
    );
    statements.push(node);
    sourceFileNode = ts.updateSourceFileNode(
      sourceFileNode,
      statements as ts.Statement[]
    );
    this.sources[fileName] = sourceFileNode;
    this.sourceState[fileName] = "CREATED";
    return {
      typeName,
      fileName,
    };
  }

  createEnumTypeDesc(schema: Schema) {
    const enumTypes = schema.enum as string[];
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
    return createNodeDesc(
      factory.createUnionTypeNode(unionNodes),
      [],
      this.createCommentNode(schema.description)
    );
  }

  createStringTypeDesc(stringSchema: Schema) {
    if (stringSchema.enum && stringSchema.enum.length) {
      return this.createEnumTypeDesc(stringSchema);
    }

    return createNodeDesc(
      factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
      [],
      this.createCommentNode(stringSchema.description)
    );
  }

  createNumberTypeDesc(schema: Schema) {
    if (schema.enum && schema.enum.length) {
      return this.createEnumTypeDesc(schema);
    }
    return createNodeDesc(
      factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword),
      [],
      this.createCommentNode(schema.description)
    );
  }

  createUnkownType() {
    return createNodeDesc(
      factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
      [],
    )
  }

  createAnyType(schema: Schema) {
    return createNodeDesc(
      factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
      [],
      this.createCommentNode(schema.description)
    );
  }

  createBooleanTypeDesc(schema: Schema) {
    return createNodeDesc(
      factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword),
      [],
      this.createCommentNode(schema.description)
    );
  }

  createSchemaTypeDesc(schema: Schema): NodeDesc {
    if (!schema) {
      return this.createUnkownType();
    }
    if (schema.$ref) {
      return this.createRefTypeDesc(schema);
    }

    if (schema.type === "boolean") {
      return this.createBooleanTypeDesc(schema);
    }

    if (schema.type === "string") {
      return this.createStringTypeDesc(schema);
    }

    if (["number", "integer"].includes(schema.type || "")) {
      return this.createNumberTypeDesc(schema);
    }

    if (schema.type === "object") {
      return this.createObjectTypeDesc(schema);
    }

    if (schema.type === "array") {
      return this.createArrayTypeDesc(schema);
    }

    return this.createAnyType(schema);
  }

  createObjectTypeDesc(
    schema: Schema,
    isRoot: boolean = false,
    moduleName?: string
  ) {
    if (!schema.properties) {
      return createNodeDesc(
        factory.createTypeLiteralNode([]),
        [],
        this.createCommentNode(schema.description)
      );
    }

    const dependencies: string[] = [];
    const required = schema.required || [];
    const nodes: TypeElement[] = [];
    const properties = schema.properties || {};
    Object.keys(schema.properties).forEach((key) => {
      const subSchema = properties[key];
      const isRequired = required.includes(key);
      const questionToken = isRequired
        ? undefined
        : factory.createToken(SyntaxKind.QuestionToken);
      const subSpec = this.createSchemaTypeDesc(subSchema);
      dependencies.push(...subSpec.dependencies);
      if (subSpec.comment) {
        nodes.push(subSpec.comment as any);
      }
      const propertyNode = factory.createPropertySignature(
        undefined,
        key,
        questionToken,
        subSpec.node as TypeNode,
      );
      nodes.push(propertyNode);
    });

    return createNodeDesc(
      factory.createTypeLiteralNode(nodes),
      dependencies,
      this.createCommentNode(schema.description)
    );
  }

  createArrayTypeDesc(schema: Schema) {
    if (schema.items) {
      const item = schema.items as Schema;
      const nodeDesc = this.createSchemaTypeDesc(item);
      return createNodeDesc(
        factory.createArrayTypeNode(nodeDesc.node as TypeNode),
        nodeDesc.dependencies,
        this.createCommentNode(schema.description)
      );
    }
    return createNodeDesc(
      factory.createArrayTypeNode(
        factory.createKeywordTypeNode(SyntaxKind.AnyKeyword)
      ),
      [],
      this.createCommentNode(schema.description)
    );
  }
  /*
   * 创建注释节点
   * @param comment
   */
  createCommentNode(comment?: string) {
    let commentNode: JSDoc | undefined;
    if (comment) {
      commentNode = factory.createJSDocComment(comment, factory.createNodeArray([]));
    }
    return commentNode;
  }
}
