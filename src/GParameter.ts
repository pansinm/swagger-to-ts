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
    this.tsTypeNode = this.toTsType();
    this.tsParameterDeclarationNode = this.toTsParameterDeclaration();
  }

  getTsType() {
    return this.tsTypeNode;
  }

  getTsParameterDeclaration() {
    return this.tsParameterDeclarationNode;
  }

  private toTsType() {
    const schema = (this.parameter as BodyParameter).schema;
    if (schema) {
      const gSchema = new GSchema(schema);
      return gSchema.getTsType();
    }

    if ((this.parameter as FormDataParameter).type === "file") {
      return factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }

    const gSchema = new GSchema(this.parameter as Schema);
    return gSchema.getTsType();
  }

  private toTsParameterDeclaration() {
    const defaultVal = (this.parameter as BaseSchema).default;
    const hasDefault = ["string", "number"].includes(typeof defaultVal);
    const questionToken =
      this.parameter.required || hasDefault
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
      this.getTsType(),
      initializer
    );
  }
}

export default GParameter;
