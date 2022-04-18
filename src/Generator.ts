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
  trimQuery,
} from "./util";

export type GeneratorOptions = {
  includeTags?: Filter;
  includePath?: Filter;
  excludeTags?: Filter;
  excludePath?: Filter;
  httpClientPath: string;
  rename?: {
    [pathName: string]: {
      [method: string]: string;
    };
  };
  rewritePath?: {
    [match: string]: string;
  };
};

class Generator {
  options: GeneratorOptions;
  spec: Spec;

  validPaths: { [pathName: string]: Path } = {};

  depRefs = new Set<string>();

  httpClientPath: string;

  /**
   * 过滤后的paths
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

  private traversedRef = new Set<string>();
  rename: GeneratorOptions["rename"];
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
      if (this.traversedRef.has(object.$ref)) {
        return;
      }
      this.traversedRef.add(object.$ref);
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
    this.rename = options.rename;
  }

  generate(): ts.SourceFile[] {
    return [this.generateOperations(), this.generateDefinitions()];
  }

  generateInfoComment() {
    return factory.createJSDocComment(
      [
        `title: ${this.spec.info.title || ""}`,
        `description: ${this.spec.info.description || ""}`,
        `version: ${this.spec.info.version}`,
        `contact:`,
        Object.entries(this.spec.info.contact || {})
          .map(([key, val]) => `\t${key}: ${val}`)
          .join("\n"),
      ].join("\n")
    );
  }

  generateOperations(): ts.SourceFile {
    const statements: ts.Statement[] = [];
    const usedTypeNames = new Set<string>([]);
    Object.entries(this.validPaths).forEach(([pathName, path]) => {
      Object.entries(path).forEach(([method, operation]) => {
        const fullPath = trimQuery((this.spec.basePath || "") + pathName);
        const overrideOperationId = this.rename?.[fullPath]?.[method];
        const gOperation = new GOperation({
          pathName,
          method,
          overrideOperationId,
          operation,
          spec: this.spec,
          rewritePath: this.options.rewritePath,
        });
        gOperation.usedTypeNames().forEach((name) => usedTypeNames.add(name));
        const statement = factory.createVariableStatement(
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createVariableDeclarationList(
            [
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
            ],
            ts.NodeFlags.Const
          )
        );
        addJSDocComment(statement, gOperation.getJsDoc());
        statements.push(statement);
      });
    });

    // import httpClient from './httpClient';
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

    // import {...} from './definitions';
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

    // import qs from 'qs';
    const qsImport = factory.createImportDeclaration(
      undefined,
      undefined,
      factory.createImportClause(
        false,
        factory.createIdentifier("qs"),
        undefined
      ),
      factory.createStringLiteral("qs")
    );

    statements.unshift(qsImport);

    // 文件开头注释
    addJSDocComment(qsImport, this.generateInfoComment());

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
      const typeNode = schema.getTsType();
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
