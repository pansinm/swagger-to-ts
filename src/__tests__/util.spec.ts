import ts, { factory } from "typescript";
import {
  chineseToPinyin,
  escapeVar,
  createModelFileName,
  createApiFileName,
  getRefTypeName,
  trimQuery,
  normalizeTagFilter,
  normalizePathNameFilter,
  addJSDocComment,
} from "../util";

describe("util", () => {
  it("chineseToPinyin", () => {
    expect(chineseToPinyin("拼音")).toBe("PinYin");
    expect(chineseToPinyin("a拼音123")).toBe("APinYin123");
  });

  it("escapeVar", () => {
    expect(escapeVar("0123")).toBe("n0123");
    expect(escapeVar("a<<")).toBe("a__");
    expect(escapeVar("0 123")).toBe("n0_123");
  });

  it("createModelFileName", () => {
    expect(
      createModelFileName("#/definitions/ResultResponseDTO«物流运单信息»")
    ).toBe("definitions/ResultResponseDTO_WuLiuYunDanXinXi_.ts");
  });

  it("createApiFileName", () => {
    expect(createApiFileName("test")).toBe("api/test.ts");
  });

  it("getModelName", () => {
    expect(
      getRefTypeName("#/definitions/ResultResponseDTO«物流运单信息»")
    ).toBe("ResultResponseDTO_WuLiuYunDanXinXi_");
  });
});

describe("trimQuery", () => {
  it("/branchcompanies/{branchCompanyId}/company", () => {
    const key = "/branchcompanies/{branchCompanyId}/company";
    expect(trimQuery(key)).toBe(key);
  });

  it("/branchcompanies/{branchCompanyId}/availability{?enabled}", () => {
    const key = "/branchcompanies/{branchCompanyId}/availability{?enabled}";
    expect(trimQuery(key)).toBe(
      "/branchcompanies/{branchCompanyId}/availability"
    );
  });

  it("/avlcompanyconfig/companyids{?garageCompanyId,supplierCompanyIds,configCode}", () => {
    const key =
      "/avlcompanyconfig/companyids{?garageCompanyId,supplierCompanyIds,configCode}";
    expect(trimQuery(key)).toBe("/avlcompanyconfig/companyids");
  });
});

describe("normalizeTagFilter", () => {
  const fixtures = [
    // filter, tags, isMatch
    ["tag", ["tag"], true],
    ["tag", ["tag", "tag2"], true],
    ["tag", ["tag1", "tag2"], false],
    ["tag1,tag2", ["tag1", "tag2"], true],
    ["tag1,tag2", ["tag2", "tag3"], true],
    ["tag1,tag2", ["tag3", "tag4"], false],
    [/tag/, ["tag3", "tag4"], true],
    [/tag1/, ["tag3", "tag4"], false],
    [() => false, ["tag3", "tag4"], false],
  ] as const;

  fixtures.forEach(([filter, tags, isMatch]) => {
    it(`当 filter 为 ${filter} pathName为${JSON.stringify(tags)} 时，${
      isMatch ? "" : "不"
    }能够匹配`, () => {
      expect(normalizeTagFilter(filter)("", { tags: tags } as any)).toBe(
        isMatch
      );
    });
  });
});

describe("normalizePathNameFilter", () => {
  const fixtures = [
    // filter, pathName, isMatch
    ["tag", "/tag", true],
    ["tag", "/a/tag", true],
    ["tag1,tag2", "/tag2/", true],
    ["tag1,tag2", "/tag3", false],
    [/tag/, "/a/tag", true],
    [/tag1/, "/tag4/", false],
    [() => false, "/tag", false],
    [undefined, "/tag", true],
  ] as const;

  fixtures.forEach(([filter, pathName, isMatch]) => {
    it(`当 filter 为 ${filter} pathName为${pathName} 时，${
      isMatch ? "" : "不"
    }能够匹配`, () => {
      expect(normalizePathNameFilter(filter)(pathName, {} as any)).toBe(
        isMatch
      );
    });
  });
});

describe("addJSDocComment", () => {
  it("能够正确添加js注释", () => {
    const node = factory.createVariableStatement(
      undefined,
      factory.createVariableDeclarationList(
        [
          factory.createVariableDeclaration(
            "a",
            undefined,
            undefined,
            factory.createNumericLiteral("1")
          ),
        ],
        ts.NodeFlags.Const
      )
    );
    addJSDocComment(
      node,
      factory.createJSDocComment("测试", [
        factory.createJSDocTypeTag(
          undefined,
          factory.createJSDocTypeExpression(factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)),
          "数值"
        ),
      ])
    );
    const printer = ts.createPrinter();
    const output = printer.printNode(
      ts.EmitHint.Unspecified,
      node,
      ts.createSourceFile("", "", ts.ScriptTarget.ESNext)
    );
    expect(output).toBe([
      '/**',
      ' * 测试',
      ' * @type {number} 数值',
      ' */',
      'const a = 1;',
    ].join('\n'));
  });
});
