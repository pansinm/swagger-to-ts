import {
  Parameter,
  Operation,
  Spec,
  Path,
  PathParameter,
  QueryParameter,
  BodyParameter,
  Schema,
  Response,
  Reference,
} from "swagger-schema-official";
import ts, { factory } from "typescript";
import path from "path";

import _ from "lodash";
import {
  createApiFileName,
  createHttpInvokeDeclaration,
  parseSwaggerPathTemplate,
  trimQuery,
  createModelFileName,
  getModelName,
} from "./util";
import { Template } from "./Template";
import {
  createPathParameterAst,
  createQuestionToken,
  createTypeNode,
} from "./parameter";
import { SchemaGenerator } from "./SchemaGenerator";
type Method = "get" | "put" | "post" | "delete" | "options" | "head" | "patch";

type Filter = (url: string, path: Operation) => boolean;

export class Generator {
  sources: { [fileName: string]: ts.SourceFile } = {};
  spec: Spec;

  filter: Filter = () => true;

  importTmp = new Template<{ namedImports: string[]; moduleSpecifier: string }>(
    `import {<%= namedImports.join(',') %>} from '<%=moduleSpecifier%>'`
  );

  constructor(spec: Spec, filter: Filter) {
    this.spec = spec;
    this.spec = spec;
    if (filter) {
      this.filter = filter;
    }
  }

  generateApiAst(swaggerUrl: string, method: string, operation: Operation) {
    const { operationId } = operation;
    if (!operationId) {
      console.error(
        "有不包含operationId的接口，请上报swagger文档，以便尽快完善swagger-go"
      );
      return;
    }

    const fileName = createApiFileName(operationId);
    const statements: ts.Statement[] = [];

    const jsDocTags: ts.Node[] = [];
    const jsDoc = factory.createJSDocComment(operation.description || "");

    const importStatements = [
      this.importTmp.generate({
        namedImports: ["httpClient"],
        moduleSpecifier: "../config",
      }),
    ];
    let urlNode = parseSwaggerPathTemplate(trimQuery(swaggerUrl));
    const parameters = operation.parameters;
    const parametersAst: ts.ParameterDeclaration[] = [];

    const optionsProperties: ts.Node[] = [];
    if (parameters && parameters.length) {
      const group = _.groupBy(parameters, "in");
      if (group.path) {
        const pathParameters = group.path as PathParameter[];
        pathParameters.forEach((param) => {
          parametersAst.push(createPathParameterAst(param));
          jsDocTags.push(
            factory.createJSDocParameterTag(
              undefined,
              ts.createIdentifier(param.name),
              false,
              undefined,
              true,
              param.description
            )
          );
        });
      }

      if (group.query) {
        const queryParameters = group.query as QueryParameter[];
        const queryInterfaceName = _.upperFirst(operationId + "Query");
        const queryInterfaceNode = ts.createInterfaceDeclaration(
          undefined,
          [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
          ts.createIdentifier(queryInterfaceName),
          undefined,
          undefined,
          queryParameters.map((parameter) => {
            return ts.createPropertySignature(
              undefined,
              ts.createStringLiteral(parameter.name),
              createQuestionToken(parameter),
              createTypeNode(parameter),
              undefined
            );
          })
        );
        jsDocTags.push(
          factory.createJSDocParameterTag(
            undefined,
            ts.createIdentifier("query"),
            false,
            factory.createJSDocTypeExpression(
              ts.createTypeReferenceNode(queryInterfaceName, [])
            ),
          )
        );
        statements.unshift(queryInterfaceNode);
        parametersAst.push(
          ts.createParameter(
            undefined,
            undefined,
            undefined,
            "query",
            undefined,
            ts.createTypeReferenceNode(queryInterfaceName, [])
          )
        );
        optionsProperties.push(
          ts.createShorthandPropertyAssignment(
            ts.createIdentifier("query"),
            undefined
          )
        );
      }

      if (group.body) {
        const bodyParameter = group.body[0] as BodyParameter;
        let typeNode: ts.TypeNode = ts.createKeywordTypeNode(
          ts.SyntaxKind.AnyKeyword
        );
        if (bodyParameter.schema) {
          const info = this.createSchemaTypeInfo(
            fileName,
            bodyParameter.schema
          );
          typeNode = info.typeNode;
          importStatements.unshift(...info.depImports);
        }

        jsDocTags.push(
          factory.createJSDocParameterTag(
            undefined,
            ts.createIdentifier(bodyParameter.name),
            false,
            factory.createJSDocTypeExpression(typeNode),
            true,
          )
        );

        parametersAst.push(
          ts.createParameter(
            undefined,
            undefined,
            undefined,
            bodyParameter.name,
            createQuestionToken(bodyParameter),
            typeNode
          )
        );

        optionsProperties.push(
          ts.createPropertyAssignment(
            ts.createIdentifier('body'),
            ts.createIdentifier(bodyParameter.name)
          )
        );
      }

      let returnTypeNode: ts.TypeNode = ts.createKeywordTypeNode(
        ts.SyntaxKind.AnyKeyword
      );
      const successResponse = operation.responses["200"];
      if (successResponse) {
        let resSchema = (successResponse as Response).schema;
        if (!resSchema) {
          resSchema = {
            $ref: (successResponse as Reference).$ref,
          };
        }
        const info = this.createSchemaTypeInfo(fileName, resSchema);
        returnTypeNode = info.typeNode;
        importStatements.unshift(...info.depImports);
      }

      const args: ts.Expression[] = [urlNode];
      if (optionsProperties.length) {
        args.push(ts.createObjectLiteral(optionsProperties as ts.PropertyAssignment[]));
      }
      statements.unshift(
        ...importStatements,
      );
      statements.push(
        factory.createJSDocComment(
          operation.summary,
          ts.createNodeArray(jsDocTags as any)
        ) as any,
        createHttpInvokeDeclaration(
          operationId,
          parametersAst,
          returnTypeNode,
          method,
          args
        )
      );
      let file = ts.createSourceFile(fileName, "", ts.ScriptTarget.Latest);
      file = ts.updateSourceFileNode(file, statements);
      this.sources[fileName] = file;
    }
  }

  createSchemaTypeInfo(fileName: string, schema: Schema) {
    const schemaGenerator = new SchemaGenerator(this.sources, this.spec);
    const { node, dependencies } = schemaGenerator.createSchemaTypeDesc(schema);
    this.sources = Object.assign(this.sources, schemaGenerator.sources);
    const typeNode = node as ts.TypeNode;
    const depImports = dependencies.map((defFileName) => {
      const relativeFile = path.posix.relative(path.posix.dirname(fileName), defFileName);
      const name = path.posix.basename(defFileName, ".ts");
      return this.importTmp.generate({
        namedImports: [name],
        moduleSpecifier: relativeFile.replace(/\.ts$/g, ""),
      });
    });
    return {
      typeNode,
      depImports,
    };
  }

  generate() {
    Object.entries(this.spec.paths)
      .forEach(([url, swaggerPath]) => {
        this.generatePathAst(url, swaggerPath);
      });
  }

  generatePathAst(swaggerApiUrl: string, swaggerPath: Path) {
    Object.keys(swaggerPath).forEach((method) => {
      if (["$ref", "parameters"].includes(method)) {
        return;
      }

      const operation = swaggerPath[method as Method] as Operation;
      if (this.filter(swaggerApiUrl, operation)) {
        this.generateApiAst(swaggerApiUrl, method, operation);
      }
    });
  }
}
