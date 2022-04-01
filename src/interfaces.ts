import * as ts from 'typescript';

// 类型描述，包含注释及依赖关系
// tslint:disable-next-line: interface-name
export interface NodeDesc {
  dependencies: string[];
  comment?: ts.JSDoc;
  node: ts.Node;
}
