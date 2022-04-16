import pinyin from "pinyin";
import _ from "lodash";
import ts, { createPrinter, factory } from "typescript";
import { Operation, Schema, Spec } from "swagger-schema-official";

// 我们针对的是ts interface，所以首字母大写
export const chineseToPinyin = (str: string) => {
  const arr: string[][] = pinyin(str, { style: pinyin.STYLE_NORMAL });
  return arr.map((a) => _.upperFirst(a.join(""))).join("");
};

export const escapeVar = (varName: string) => {
  let name = varName.replace(/\s|[^0-9a-zA-Z]/g, "_");
  if (/[0-9]/.test(name[0])) {
    name = "n" + name;
  }
  return name;
};

export const createModelFileName = (ref: string) => {
  const fileName = ref.replace(/^#\//g, "");
  const paths = fileName.split("/");
  paths.pop();
  paths.push(getRefTypeName(ref));
  return paths.join("/") + ".ts";
};

export const createApiFileName = (operationId: string) => {
  return `api/${operationId}.ts`;
};

export const getRefTypeName = (ref: string) => {
  const paths = ref.split("/");
  let modelName = paths.pop() as string;
  if (/[^0-9a-zA-Z]/.test(modelName)) {
    return escapeVar(chineseToPinyin(modelName));
  }
  return escapeVar(modelName);
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

export function matchAll(reg: RegExp, str: string) {
  const matches: RegExpExecArray[] = [];
  let result = reg.exec(str);
  while (result) {
    matches.push(result);
    result = reg.exec(str);
  }
  return matches;
}

export function printNode(node: ts.Node) {
  const printer = ts.createPrinter();
  const output = printer
    .printNode(
      ts.EmitHint.Unspecified,
      node,
      ts.createSourceFile("", "", ts.ScriptTarget.ESNext)
    )
    .trim();
  return output;
}

/**
 * 将swagger路径模板解析成字符串AST
 * @param pathTemplate swagger里面路径模板，类似于 /abc/{param}
 */
export function parseSwaggerPathTemplate(pathTemplate: string) {
  const reg = /{(.+?)}/g;
  const matches = matchAll(reg, pathTemplate);
  if (!matches.length) {
    return factory.createStringLiteral(pathTemplate);
  }

  const templateHead = factory.createTemplateHead(
    pathTemplate.slice(0, matches[0].index)
  );
  const spans = matches.map((match, index) => {
    const nextMatch = matches[index + 1];
    const identifier = factory.createIdentifier(match[1]);
    const begin = match.index + match[0].length;
    const start = nextMatch ? nextMatch.index : pathTemplate.length;
    const str = pathTemplate.slice(begin, start);
    const literal = nextMatch
      ? factory.createTemplateMiddle(str)
      : factory.createTemplateTail(str);
    return factory.createTemplateSpan(identifier, literal);
  });

  return factory.createTemplateExpression(templateHead, spans);
}

export type FunctionFilter = (
  pathName: string,
  operation: Operation
) => boolean | Promise<boolean>;

export type Filter = string | RegExp | FunctionFilter;

export function normalizeTagFilter(filter?: Filter): FunctionFilter {
  if (!filter) {
    return () => true;
  }
  if (typeof filter === "string") {
    const validTags = filter.split(",");
    return (pathName: string, operation: Operation) => {
      return !!operation.tags?.some((tag) => validTags.includes(tag));
    };
  }

  if (filter instanceof RegExp) {
    return (pathName: string, operation: Operation) => {
      return !!operation.tags?.some((tag) => filter.test(tag));
    };
  }

  return filter;
}

export function normalizePathNameFilter(filter?: Filter): FunctionFilter {
  if (!filter) {
    return () => true;
  }
  if (typeof filter === "string") {
    const validPaths = filter.split(",");
    return (pathName: string, operation: Operation) => {
      return validPaths.some((path) => pathName.includes(path));
    };
  }

  if (filter instanceof RegExp) {
    return (pathName: string, operation: Operation) => {
      return filter.test(pathName);
    };
  }

  return filter;
}

/**
 * 给节点添加js注释
 * @param node
 * @param jsDoc
 * @returns
 */
export function addJSDocComment<T extends ts.Node>(node: T, jsDoc: ts.JSDoc) {
  const output = printNode(jsDoc).slice(2, -2);
  return ts.addSyntheticLeadingComment<T>(
    node,
    ts.SyntaxKind.MultiLineCommentTrivia,
    output,
    true
  );
}

export function getRefedSchema(spec: Spec, ref: string): Schema | undefined {
  // 去除'#/'，按'/'分割
  const paths = ref.slice(2).split("/");
  return _.get(spec, paths);
}
