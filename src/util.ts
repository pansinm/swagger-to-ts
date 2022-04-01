import pinyin from "pinyin";
import _ from "lodash";
import ts from "typescript";
import { NodeDesc } from "./interfaces";

// 我们针对的是ts interface，所以首字母大写
export const chineseToPinyin = (str: string) => {
  const arr: string[][] = pinyin(str, { style: pinyin.STYLE_NORMAL });
  return arr.map((a) => _.upperFirst(a.join(""))).join("");
};

export function createNodeDesc(
  node: ts.Node,
  dependencies: string[],
  comment?: ts.JSDoc
): NodeDesc {
  const uniqueDependencies = Array.from(new Set(dependencies));
  return {
    node,
    comment,
    dependencies: uniqueDependencies,
  };
}

export const escapeVar = (varName: string) => {
  let name = varName.replace(/\s|[^0-9a-zA-Z]/g, "_");
  name = _.upperFirst(name);
  if (/[0-9]/.test(name[0])) {
    name = "N" + name;
  }
  return name;
};

export const createModelFileName = (ref: string) => {
  const fileName = ref.replace(/^#\//g, "");
  const paths = fileName.split("/");
  paths.pop();
  paths.push(getModelName(ref));
  return paths.join("/") + ".ts";
};

export const createApiFileName = (operationId: string) => {
  return `api/${operationId}.ts`;
};

export const getModelName = (ref: string) => {
  const paths = ref.split("/");
  const modelName = paths.pop() as string;
  return escapeVar(chineseToPinyin(modelName));
};

/**
 *
 * @param pathKey swagger文档中，有些key包含query，
 * 如 /branchcompanies/{branchCompanyId}/availability{?enabled}
 * query在parameters字段中有体现，需要把{?enabled}移除掉
 */
export function trimQuery(url: string) {
  return url.replace(/\{\?.*\}/g, "");
}

export const createHttpInvokeDeclaration = (
  functionName: string,
  parameters: ts.ParameterDeclaration[],
  returnType: ts.TypeNode,
  httpMethod: string,
  args: ts.Expression[]
) => {
  return ts.createFunctionDeclaration(
    undefined,
    [ts.createModifier(ts.SyntaxKind.ExportKeyword)],
    undefined,
    ts.createIdentifier(functionName),
    undefined,
    parameters,
    ts.createTypeReferenceNode(ts.createIdentifier("Promise"), [returnType]),
    ts.createBlock(
      [
        ts.createReturn(
          ts.createCall(
            ts.createPropertyAccess(
              ts.createIdentifier("httpClient"),
              ts.createIdentifier(httpMethod)
            ),
            undefined,
            args
          )
        ),
      ],
      true
    )
  );
};

export function matchAll(reg: RegExp, str: string) {
  const matches: RegExpExecArray[] = [];
  let result = reg.exec(str);
  while (result) {
    matches.push(result);
    result = reg.exec(str);
  }
  return matches;
}


/**
 * 将swagger路径模板解析成字符串AST
 * @param pathTemplate swagger里面路径模板，类似于 /abc/{param}
 */
export function parseSwaggerPathTemplate(pathTemplate: string) {
  const reg = /{(.+?)}/g;
  const matches = matchAll(reg, pathTemplate);
  if (!matches.length) {
    return ts.createStringLiteral(pathTemplate);
  }

  const templateHead = ts.createTemplateHead(
    pathTemplate.slice(0, matches[0].index)
  );
  const spans = matches.map((match, index) => {
    const nextMatch = matches[index + 1];
    const identifier = ts.createIdentifier(match[1]);
    const begin = match.index + match[0].length;
    const start = nextMatch ? nextMatch.index : pathTemplate.length;
    const str = pathTemplate.slice(begin, start);
    const literal = nextMatch
      ? ts.createTemplateMiddle(str)
      : ts.createTemplateTail(str);
    return ts.createTemplateSpan(identifier, literal);
  });

  return ts.createTemplateExpression(templateHead, spans);
}
