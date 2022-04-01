import {
  chineseToPinyin,
  escapeVar,
  createModelFileName,
  createApiFileName,
  getModelName,
  trimQuery
} from "../util";

describe("util", () => {
  it("chineseToPinyin", () => {
    expect(chineseToPinyin("拼音")).toBe("PinYin");
    expect(chineseToPinyin("a拼音123")).toBe("APinYin123");
  });

  it("escapeVar", () => {
    expect(escapeVar("0123")).toBe("N0123");
    expect(escapeVar("a<<")).toBe("A__");
    expect(escapeVar("0 123")).toBe("N0_123");
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
    expect(getModelName("#/definitions/ResultResponseDTO«物流运单信息»")).toBe(
      "ResultResponseDTO_WuLiuYunDanXinXi_"
    );
  });
});


describe('trimQuery', () => {
  it('/branchcompanies/{branchCompanyId}/company', () => {
    const key = '/branchcompanies/{branchCompanyId}/company';
    expect(trimQuery(key)).toBe(key);
  });

  it('/branchcompanies/{branchCompanyId}/availability{?enabled}', () => {
    const key = '/branchcompanies/{branchCompanyId}/availability{?enabled}';
    expect(trimQuery(key)).toBe('/branchcompanies/{branchCompanyId}/availability');
  });

  it('/avlcompanyconfig/companyids{?garageCompanyId,supplierCompanyIds,configCode}', () => {
    const key = '/avlcompanyconfig/companyids{?garageCompanyId,supplierCompanyIds,configCode}';
    expect(trimQuery(key)).toBe('/avlcompanyconfig/companyids');
  });
})
