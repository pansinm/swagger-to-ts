import {
  Parameter,
  PathParameter,
  QueryParameter,
  SchemaFormatConstraints,
  BaseParameter,
} from "swagger-schema-official";
import ts, { factory } from "typescript";

export function createTypeNode(constraints: SchemaFormatConstraints) {
  let type = constraints.type;
  let typeNode: ts.KeywordTypeNode<any> = factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
  if (constraints.type === "boolean") {
    typeNode = factory.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
  } else if (constraints.type === "string") {
    typeNode = factory.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
  } else if (["integer", "number"].includes(type as string)) {
    typeNode = factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
  } else {
    console.error(
      `包含不支持的type <${type}>，类型降级为any，请将当前swagger同步给swagger-go开发，以便及时优化`,
      constraints
    );
  }
  return typeNode;
}

export function createQuestionToken(parameter: BaseParameter) {
  return parameter.required
    ? undefined
    : ts.createToken(ts.SyntaxKind.QuestionToken);
}

export function createPathParameterAst(parameter: PathParameter) {
  return ts.createParameter(
    undefined,
    undefined,
    undefined,
    ts.createIdentifier(parameter.name),
    undefined,
    createTypeNode(parameter)
  );
}
