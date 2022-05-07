import _ from "lodash";
import { posix as path } from "path";
import {
  Parameter as SwaggerParameter,
  Operation as SwaggerOperation,
  Spec,
  BodyParameter,
  PathParameter,
  FormDataParameter,
  QueryParameter,
  Response,
  Parameter,
} from "swagger-schema-official";
import ts, { factory } from "typescript";
import GParameter from "./GParameter";
import { GSchema } from "./GSchema";
import {
  addJSDocComment,
  escapeVar,
  getRefedSchema,
  parseSwaggerPathTemplate,
  trimQuery,
} from "./util";

interface Options {
  method: string;
  pathName: string;
  overrideOperationId?: string;
  operation: SwaggerOperation;
  spec: Spec;
  rewritePath?: {
    [match: string]: string;
  };
}

class GOperation {
  private pathName: string;
  private operation: SwaggerOperation;
  private method: string;
  private spec: Spec;
  private body: BodyParameter[] = [];
  private path: PathParameter[] = [];
  private formData: FormDataParameter[] = [];
  private query: QueryParameter[] = [];
  private overrideOperationId?: string;

  private gParameters: GParameter[] = [];

  parameterDeclarations: ts.ParameterDeclaration[];
  block: ts.Block;
  returnType: ts.TypeNode;
  rewritePath: NonNullable<Options["rewritePath"]>;

  constructor({
    method,
    pathName,
    operation,
    spec,
    overrideOperationId,
    rewritePath,
  }: Options) {
    this.pathName = pathName;
    this.operation = operation;
    this.spec = spec;
    this.method = method;
    this.overrideOperationId = overrideOperationId;
    this.rewritePath = rewritePath || {};
    this.gParameters =
      this.operation.parameters?.map(
        (parameter) => new GParameter(parameter as Parameter)
      ) || [];
    this.groupParameters();
    this.parameterDeclarations = this.generateParameterDeclarations();
    this.block = this.generateBlock();
    this.returnType = this.generateReturnType();
  }

  /**
   * 依赖的类型
   * @returns 
   */
  dependencyTypes() {
    const typeNames = new Set<string>([]);

    const exactTypeNames = (root: ts.Node) => {
      ts.forEachChild(root, (node) => {
        if (!node) {
          return;
        }
        if (ts.isTypeReferenceNode(node)) {
          typeNames.add(
            (node.typeName as ts.Identifier).escapedText.toString()
          );
        } else {
          exactTypeNames(node);
        }
      });
    };
    this.parameterDeclarations.forEach((declaration) => {
      exactTypeNames(declaration);
    });
    exactTypeNames(this.returnType);
    return typeNames;
  }

  /**
   * 标识名称
   * @returns
   */
  identifierName() {
    return escapeVar(this.overrideOperationId || this.operation.operationId as string);
  }

  /**
   * 返回函数签名
   * @returns
   */
  getParameterDeclarations() {
    return this.parameterDeclarations;
  }

  /**
   * 返回函数块
   * @returns
   */
  getBlock() {
    return this.block;
  }

  /**
   * 返回返回值类型
   * @returns
   */
  getReturnType() {
    return this.returnType;
  }

  exportFunction() {
    const statement = factory.createVariableStatement(
      [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            factory.createIdentifier(this.identifierName()!),
            undefined,
            undefined,
            factory.createArrowFunction(
              undefined,
              undefined,
              this.getParameterDeclarations(),
              this.getReturnType(),
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              this.getBlock()
            )
          ),
        ],
        ts.NodeFlags.Const
      )
    );
    addJSDocComment(statement, this.generateJsDoc());
    return statement;
  }

  private filterValidBody(parameters: BodyParameter[]) {
    let body = parameters;
    if (body.length > 1) {
      console.error(
        `接口 ${this.method} ${this.pathName} body 参数数量超过1个，请检查swagger文档，将使用其中一个参数生成签名`
      );
      // 纠错，使用有效的definitions;
      const filterBody = body.filter((item) => {
        const schema = (item as BodyParameter).schema;
        if (schema?.$ref && !getRefedSchema(this.spec, schema.$ref)) {
          return false;
        }
        return true;
      });
      if (!filterBody.length) {
        body = body.slice(0, 1);
      } else {
        body = filterBody.slice(0, 1);
      }
    }
    return body;
  }

  private groupParameters() {
    const parameters = this.operation.parameters || [];
    const grouped = _.groupBy(parameters, "in");
    // path, body, formData, query 顺序生成签名
    const path = (grouped["path"] as PathParameter[]) || [];
    const body = this.filterValidBody(
      (grouped["body"] as BodyParameter[]) || []
    );
    const formData = (grouped["formData"] as FormDataParameter[]) || [];
    const query = (grouped["query"] as QueryParameter[]) || [];
    this.path = path;
    this.body = body;
    this.formData = formData;
    this.query = query;
  }

  /**
   * 获取函数参数列表
   * @returns
   */
  private generateParameterDeclarations(): ts.ParameterDeclaration[] {
    return [
      ...this.path.map((param) =>
        new GParameter(param as SwaggerParameter).tsNode()
      ),
      ...this.body.map((param) =>
        new GParameter(param as SwaggerParameter).tsNode()
      ),
      ...this.formData.map((param) =>
        new GParameter(param as SwaggerParameter).tsNode()
      ),
      ...this.query.map((param) =>
        new GParameter(param as SwaggerParameter).tsNode()
      ),
    ].sort((a, b) => {
      const aWeight = +!!a.initializer + (!!a.questionToken ? 2 : 0);
      const bWeight = +!!b.initializer + (!!b.questionToken ? 2 : 0);
      return aWeight - bWeight;
    });
  }

  private rewritePathName(pathName: string) {
    for (let [matcher, replacer] of Object.entries(this.rewritePath)) {
      const reg = new RegExp(matcher);
      if (reg.test(pathName)) {
        return pathName.replace(reg, replacer);
      }
    }
    return pathName;
  }

  /**
   * 拼接url
   * @returns
   */
  private createUrlNode() {
    let pathName = path.join(
      this.spec.basePath || "",
      trimQuery(this.pathName)
    );
    pathName = this.rewritePathName(pathName);
    let pathNameNode: ts.StringLiteral | ts.TemplateExpression =
      factory.createStringLiteral(pathName);
    if (this.path.length) {
      pathNameNode = parseSwaggerPathTemplate(pathName);
    }

    if (this.query.length) {
      const queryProperties = this.query.map((item, index) => {
        let value: ts.Expression = factory.createIdentifier(
          escapeVar(item.name)
        );

        // https://swagger.io/docs/specification/2-0/describing-parameters/#array-and-multi-value-parameters
        if (item.collectionFormat && item.collectionFormat !== "multi") {
          const sep: any = {
            scv: ",",
            ssv: " ",
            tsv: "\t",
            pipes: "|",
          };

          value = factory.createCallChain(
            factory.createPropertyAccessChain(
              factory.createIdentifier(escapeVar(item.name)),
              factory.createToken(ts.SyntaxKind.QuestionDotToken),
              factory.createIdentifier("join")
            ),
            undefined,
            undefined,
            [factory.createStringLiteral(sep[item.collectionFormat])]
          );
        }

        const paramName = escapeVar(item.name);
        const key =
          item.name === paramName
            ? factory.createIdentifier(item.name)
            : factory.createStringLiteral(item.name);
        return factory.createPropertyAssignment(key, value);
      });

      const stringifyArgs = [
        factory.createObjectLiteralExpression(queryProperties),
        factory.createObjectLiteralExpression([
          factory.createPropertyAssignment(
            factory.createIdentifier("arrayFormat"),
            factory.createStringLiteral("repeat")
          ),
        ]),
      ];

      const span = factory.createTemplateSpan(
        factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("qs"),
            factory.createIdentifier("stringify")
          ),
          undefined,
          stringifyArgs
        ),
        factory.createTemplateTail("", "")
      );

      const template = factory.createTemplateExpression(
        factory.createTemplateHead("?", "?"),
        [span]
      );

      return factory.createBinaryExpression(
        pathNameNode,
        factory.createToken(ts.SyntaxKind.PlusToken),
        template
      );
    }
    return pathNameNode;
  }

  private createBodyOrFormData() {
    if (this.body.length) {
      const body = this.body[0];
      return factory.createObjectLiteralExpression([
        factory.createPropertyAssignment(
          factory.createIdentifier("body"),
          factory.createIdentifier(body.name)
        ),
      ]);
    }
    if (this.formData.length) {
      return factory.createObjectLiteralExpression([
        factory.createPropertyAssignment(
          factory.createIdentifier("formData"),
          this.createFormData(),
        ),
      ]);
    }
    return null;
  }

  private createFormData() {
    return factory.createObjectLiteralExpression(
      this.formData.map(item => factory.createPropertyAssignment(
        factory.createIdentifier(item.name),
        factory.createIdentifier(item.name)
      ))
    )
  }


  /**
   * 返回类型
   */
  private generateReturnType() {
    let returnType: ts.TypeNode = factory.createKeywordTypeNode(
      ts.SyntaxKind.VoidKeyword
    );
    const success = this.getSuccessResponse();
    if (success?.schema) {
      const schema = new GSchema(success.schema);
      returnType = schema.tsType();
    }

    return factory.createTypeReferenceNode(
      factory.createIdentifier("Promise"),
      [returnType]
    );
  }

  private getSuccessResponse() {
    const responses = this.operation.responses;
    return (responses["200"] || responses["default"]) as Response;
  }

  /**
   * 函数块
   * @returns
   */
  private generateBlock(useThisHttp = false): ts.Block {
    const urlNode = this.createUrlNode();
    const httpInvokeArgs: ts.Expression[] = [urlNode];
    const data = this.createBodyOrFormData();
    if (data) {
      httpInvokeArgs.push(data);
    }

    let propertyAccess = factory.createPropertyAccessExpression(
      factory.createIdentifier("httpClient"),
      factory.createIdentifier(this.method.toLocaleLowerCase())
    );

    if (useThisHttp) {
      propertyAccess = factory.createPropertyAccessExpression(
        factory.createPropertyAccessExpression(
          factory.createThis(),
          factory.createIdentifier("httpClient")
        ),
        factory.createIdentifier(this.method.toLocaleLowerCase())
      );
    }
    const returnStatement = factory.createReturnStatement(
      factory.createCallExpression(propertyAccess, undefined, httpInvokeArgs)
    );
    return factory.createBlock([returnStatement]);
  }

  private generateJsDoc() {
    const parmDeclarations = this.getParameterDeclarations();

    const tags: ts.JSDocTag[] = parmDeclarations.map((declare) => {
      const name = (declare.name as ts.Identifier).escapedText.toString();
      const param = this.operation.parameters?.find(
        (p) =>
          (p as SwaggerParameter).name === name ||
          escapeVar((p as SwaggerParameter).name) === name
      ) as SwaggerParameter;
      return factory.createJSDocParameterTag(
        undefined,
        factory.createIdentifier(name),
        false,
        undefined,
        undefined,
        param?.description
      );
    });
    if (this.operation.deprecated) {
      tags.unshift(
        factory.createJSDocDeprecatedTag(
          factory.createIdentifier("deprecated"),
          undefined
        )
      );
    }
    const successResponse = this.getSuccessResponse();
    tags.push(
      factory.createJSDocReturnTag(
        undefined,
        undefined,
        successResponse ? successResponse.description : ""
      )
    );
    return factory.createJSDocComment(
      `${this.operation.summary || ""}\n${this.operation.description || ""}`,
      tags
    );
  }
}

export default GOperation;
