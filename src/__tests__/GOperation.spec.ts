import { Operation, Spec } from "swagger-schema-official";
import GOperation from "../GOperation";
import { printNode } from "../util";
import swagger from "./fixtures/swagger.json";

describe("GOperation", () => {
  it("exportFunction 生成导出方法", () => {
    const gOperation = new GOperation({
      method: "get",
      operation: swagger.paths["/user/login"].get as Operation,
      pathName: "/user/login",
      spec: swagger as Spec,
    });
    expect(printNode(gOperation.exportFunction())).toBe(
      `
/**
 * Logs user into the system
 *
 * @param username The user name for login
 * @param password The password for login in clear text
 * @returns successful operation
 */
export const loginUser = (username: string, password: string): Promise<string> => { return httpClient.get("/v2/user/login" + \`?\${qs.stringify({ username: username, password: password }, { arrayFormat: "repeat" })}\`); };
    `.trim()
    );
  });
});
