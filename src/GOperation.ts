import _ from "lodash";
import {
  Parameter as SwaggerParameter,
  Operation as SwaggerOperation,
  Spec,
  BodyParameter,
  PathParameter,
  FormDataParameter,
  QueryParameter,
  Response,
} from "swagger-schema-official";
import ts, { factory } from "typescript";
import GParameter from "./GParameter";
import { GSchema } from "./GSchema";
import {
  escapeVar,
  getRefedSchema,
  parseSwaggerPathTemplate,
  trimQuery,
} from "./util";

interface Options {
  method: string;
  pathName: string;
  operation: SwaggerOperation;
  spec: Spec;
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

  parameterDeclarations: ts.ParameterDeclaration[];
  jsDoc: ts.JSDoc;
  block: ts.Block;
  returnType: ts.TypeNode;

  constructor({ method, pathName, operation, spec }: Options) {
    this.pathName = pathName;
    this.operation = operation;
    this.spec = spec;
    this.method = method;
    this.groupParameters();
    this.parameterDeclarations = this.generateParameterDeclarations();
    this.jsDoc = this.generateJsDoc();
    this.block = this.generateBlock();
    this.returnType = this.generateReturnType();
  }

  usedTypeNames() {
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
   * 返回id
   * @returns
   */
  getId() {
    return this.operation.operationId;
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
   * 返回jsdoc
   * @returns
   */
  getJsDoc() {
    return this.jsDoc;
  }

  /**
   * 返回返回值类型
   * @returns
   */
  getReturnType() {
    return this.returnType;
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
        new GParameter(param as SwaggerParameter).getParameterDeclaration()
      ),
      ...this.body.map((param) =>
        new GParameter(param as SwaggerParameter).getParameterDeclaration()
      ),
      ...this.formData.map((param) =>
        new GParameter(param as SwaggerParameter).getParameterDeclaration()
      ),
      ...this.query.map((param) =>
        new GParameter(param as SwaggerParameter).getParameterDeclaration()
      ),
    ].sort((a, b) => {
      const aWeight = +!!a.initializer + (!!a.questionToken ? 2 : 0);
      const bWeight = +!!b.initializer + (!!b.questionToken ? 2 : 0);
      return aWeight - bWeight;
    });
  }

  /**
   * 拼接url
   * @returns
   */
  private createUrlNode() {
    const pathName = trimQuery(this.pathName);
    let pathNameNode: ts.StringLiteral | ts.TemplateExpression =
      factory.createStringLiteral(pathName);
    if (this.path.length) {
      pathNameNode = parseSwaggerPathTemplate(pathName);
    }

    if (this.query.length) {
      const queryProperties = this.query.map((item, index) => {
        let stringifyVal: ts.Expression = factory.createIdentifier(
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
          stringifyVal = factory.createCallExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier(escapeVar(item.name)),
              factory.createIdentifier("join")
            ),
            undefined,
            [factory.createStringLiteral(sep[item.collectionFormat])]
          );
        }
        return factory.createPropertyAssignment(
          factory.createIdentifier(escapeVar(item.name)),
          stringifyVal
        );
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
      const formData = this.body[0];
      return factory.createObjectLiteralExpression([
        factory.createPropertyAssignment(
          factory.createIdentifier("formData"),
          factory.createIdentifier(formData.name)
        ),
      ]);
    }
    return null;
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
      returnType = schema.toTsType();
    }

    return factory.createTypeReferenceNode(
      factory.createIdentifier("Promise"),
      [returnType]
    );
  }

  private getSuccessResponse() {
    return this.operation.responses["200"] as Response;
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
        (p) => (p as SwaggerParameter).name === name
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
    tags.push(
      factory.createJSDocReturnTag(
        undefined,
        undefined,
        this.getSuccessResponse().description
      )
    );
    return factory.createJSDocComment(
      `${this.operation.summary || ""}\n${this.operation.description || ""}`,
      tags
    );
  }
}

export default GOperation;
