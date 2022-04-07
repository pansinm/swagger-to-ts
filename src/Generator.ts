import { Operation, Path, Spec } from "swagger-schema-official";
import ts, { factory } from "typescript";
import GOperation from "./GOperation";
import { GSchema } from "./GSchema";
import {
  addJSDocComment,
  Filter,
  getRefedSchema,
  getRefTypeName,
  normalizePathNameFilter,
  normalizeTagFilter,
} from "./util";

export type GeneratorOptions = {
  includeTags?: Filter;
  includePath?: Filter;
  excludeTags?: Filter;
  excludePath?: Filter;
  httpClientPath: string;
};

class Generator {
  options: GeneratorOptions;
  spec: Spec;

  validPaths: { [pathName: string]: Path } = {};

  depRefs = new Set<string>();

  httpClientPath: string;

  /**
   * 过滤后的paths１‵４
   * @returns
   */
  private getValidPaths(): { [pathName: string]: Path } {
    const results: { [pathName: string]: Path } = {};
    const includeTagFilter = normalizeTagFilter(this.options.includeTags);
    const includePathFilter = normalizePathNameFilter(this.options.includePath);
    const excludeTagFilter = normalizeTagFilter(
      this.options.excludeTags || (() => false)
    );
    const excludePathFilter = normalizePathNameFilter(
      this.options.excludePath || (() => false)
    );
    Object.entries(this.spec.paths).forEach(([pathName, path]) => {
      Object.entries(path).forEach(([method, operation]) => {
        const isMatch =
          (includePathFilter(pathName, operation) ||
            includeTagFilter(pathName, operation)) &&
          !(
            excludePathFilter(pathName, operation) ||
            excludeTagFilter(pathName, operation)
          );
        if (isMatch) {
          if (!results[pathName]) {
            results[pathName] = {};
          }
          Object.assign(results[pathName], {
            [method]: operation,
          });
        }
      });
    });
    return results;
  }

  /**
   * 遍历过滤依赖的ref
   * @param object
   * @returns
   */
  private parseDepsRef(object: any) {
    if (typeof object !== "object") {
      return;
    }
    if (object.$ref) {
      this.depRefs.add(object.$ref);
      const refSchema = getRefedSchema(this.spec, object.$ref);
      this.parseDepsRef(refSchema);
      return;
    }
    Object.values(object).forEach((subVal) => {
      this.parseDepsRef(subVal);
    });
  }

  constructor(spec: Spec, options: GeneratorOptions) {
    this.spec = spec;
    this.options = options;
    this.validPaths = this.getValidPaths();
    this.parseDepsRef(this.validPaths);
    this.httpClientPath = options.httpClientPath;
  }

  generate(): ts.SourceFile[] {
    return [this.generateOperations(), this.generateDefinitions()];
  }

  generateOperations(): ts.SourceFile {
    const statements: ts.Statement[] = [];
    const usedTypeNames = new Set<string>([]);
    Object.entries(this.validPaths).forEach(([pathName, path]) => {
      Object.entries(path).forEach(([method, operation]) => {
        const gOperation = new GOperation({
          pathName,
          method,
          operation,
          spec: this.spec,
        });
        gOperation.usedTypeNames().forEach((name) => usedTypeNames.add(name));
        const statement = factory.createVariableStatement(
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createVariableDeclarationList([
            factory.createVariableDeclaration(
              factory.createIdentifier(gOperation.getId()!),
              undefined,
              undefined,
              factory.createArrowFunction(
                undefined,
                undefined,
                gOperation.getParameterDeclarations(),
                gOperation.getReturnType(),
                factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
                gOperation.getBlock()
              )
            ),
          ])
        );
        addJSDocComment(statement, gOperation.getJsDoc());
        statements.push(statement);
      });
    });

    statements.unshift(
      factory.createImportDeclaration(
        undefined,
        undefined,
        factory.createImportClause(
          false,
          factory.createIdentifier("httpClient"),
          undefined
        ),
        factory.createStringLiteral(this.httpClientPath)
      )
    );

    if (usedTypeNames.size > 0) {
      statements.unshift(
        factory.createImportDeclaration(
          undefined,
          undefined,
          factory.createImportClause(
            false,
            undefined,
            factory.createNamedImports(
              [...this.depRefs]
                .map((ref) => getRefTypeName(ref))
                .filter((typeName) => usedTypeNames.has(typeName))
                .map((typeName) =>
                  factory.createImportSpecifier(
                    false,
                    undefined,
                    factory.createIdentifier(typeName)
                  )
                )
            )
          ),
          factory.createStringLiteral("./definitions")
        )
      );
    }
    const sourceFile = factory.createSourceFile(
      statements,
      factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None
    );
    sourceFile.fileName = "api.ts";
    return sourceFile;
  }

  /**
   * 将swagger中类型定义生成文件
   * @returns
   */
  generateDefinitions(): ts.SourceFile {
    const statements: ts.Statement[] = [];
    this.depRefs.forEach((ref) => {
      const typeAliasName = getRefTypeName(ref);
      const swaggerSchema = getRefedSchema(this.spec, ref);
      const schema = new GSchema(swaggerSchema);
      const typeNode = schema.toTsType();
      if (typeAliasName === "OrderPayLogDTO") {
        console.log(ref, typeAliasName);
      }
      /**
       * 生成类型,如：
       * type A = {
       *    a: string;
       * }
       */
      const typeAliasDeclaration = factory.createTypeAliasDeclaration(
        undefined,
        [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
        factory.createIdentifier(typeAliasName),
        undefined,
        typeNode
      );

      const comment = GSchema.createComment(swaggerSchema);
      if (comment) {
        addJSDocComment(typeAliasDeclaration, comment);
      }
      statements.push(typeAliasDeclaration);
    });
    const sourceFile = factory.createSourceFile(
      statements,
      factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.None
    );
    sourceFile.fileName = "definitions.ts";
    return sourceFile;
  }
}

export default Generator;
