import {
  BaseSchema,
  BodyParameter,
  FormDataParameter,
  Parameter,
  QueryParameter,
  Schema,
} from "swagger-schema-official";
import ts, { factory } from "typescript";
import { GSchema } from "./GSchema";
import { escapeVar } from "./util";
class GParameter {
  private parameter: Parameter;
  private tsTypeNode: ts.TypeNode;
  private tsParameterDeclarationNode: ts.ParameterDeclaration;
  constructor(parameter: Parameter) {
    this.parameter = parameter;
    this.tsTypeNode = this.genTsType();
    this.tsParameterDeclarationNode = this.genTsParameterDeclaration();
  }

  /**
   * 参数类型
   * @returns
   */
  tsType() {
    return this.tsTypeNode;
  }

  /**
   * parameter 节点
   * @returns
   */
  tsNode() {
    return this.tsParameterDeclarationNode;
  }

  /**
   * 是否必填
   * @returns
   */
  isRequired() {
    return !!this.parameter.required;
  }

  /**
   * 是否有默认值
   * @returns
   */
  hasDefault() {
    return typeof (this.parameter as QueryParameter).default !== "undefined";
  }

  /**
   * 注释
   */
  jsDocTag() {
    return factory.createJSDocTypeTag(
      factory.createIdentifier("param"),
      factory.createJSDocTypeExpression(this.tsType()),
      this.parameter.description
    );
  }

  private genTsType() {
    const schema = (this.parameter as BodyParameter).schema;
    if (schema) {
      const gSchema = new GSchema(schema);
      return gSchema.tsType();
    }

    if ((this.parameter as FormDataParameter).type === "file") {
      return factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }

    const gSchema = new GSchema(this.parameter as Schema);
    return gSchema.tsType();
  }

  private genTsParameterDeclaration() {
    const defaultVal = (this.parameter as BaseSchema).default;
    const hasDefault = ["string", "number"].includes(typeof defaultVal);
    const questionToken =
      this.isRequired() || this.hasDefault()
        ? undefined
        : factory.createToken(ts.SyntaxKind.QuestionToken);
    let initializer;
    if (typeof defaultVal === "string") {
      initializer = factory.createStringLiteral(defaultVal);
    }
    if (typeof defaultVal === "number") {
      initializer = factory.createNumericLiteral(defaultVal);
    }
    return factory.createParameterDeclaration(
      undefined,
      undefined,
      undefined,
      factory.createIdentifier(escapeVar(this.parameter.name)),
      questionToken,
      this.tsType(),
      initializer
    );
  }
}

export default GParameter;
