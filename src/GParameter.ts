import {
  BaseSchema,
  BodyParameter,
  Parameter as SwaggerParameter,
  Schema as SwaggerSchema,
} from "swagger-schema-official";
import ts, { factory } from "typescript";
import { GSchema } from "./GSchema";
import { escapeVar } from "./util";
class GParameter {
  parameter: SwaggerParameter;
  constructor(parameter: SwaggerParameter) {
    this.parameter = parameter;
  }

  private getBodyType() {
    const parameter = this.parameter as BodyParameter;
    const parameterSchema = new GSchema(parameter.schema);
    return parameterSchema.toTsType();
  }

  toTsType() {
    if (this.parameter.in === "body") {
      return this.getBodyType();
    }

    if (this.parameter.type === "file") {
      return factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
    }

    const schema = new GSchema(this.parameter as SwaggerSchema);
    return schema.toTsType();
  }

  getParameterDeclaration() {
    const defaultVal = (this.parameter as BaseSchema).default;
    const hasDefault = ['string', 'number'].includes(typeof defaultVal);
    const questionToken = (this.parameter.required || hasDefault)
      ? undefined
      : factory.createToken(ts.SyntaxKind.QuestionToken);
    let initializer;
    if (typeof defaultVal === 'string') {
      initializer = factory.createStringLiteral(defaultVal);
    }
    if (typeof defaultVal === 'number') {
      initializer = factory.createNumericLiteral(defaultVal);
    }
    return factory.createParameterDeclaration(
      undefined,
      undefined,
      undefined,
      factory.createIdentifier(escapeVar(this.parameter.name)),
      questionToken,
      this.toTsType(),
      initializer
    );
  }
}

export default GParameter;
