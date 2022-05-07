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
  it('formData', () => {
    const gOperation = new GOperation({
      method: 'post',
      operation: swagger.paths['/pet/{petId}'].post as Operation,
      pathName: "/pet/{petId}",
      spec: swagger as Spec
    })
    expect(printNode(gOperation.exportFunction())).toBe(
      `
/**
 * Updates a pet in the store with form data
 *
 * @param petId ID of pet that needs to be updated
 * @param name Updated name of the pet
 * @param status Updated status of the pet
 * @returns
 */
export const updatePetWithForm = (petId: number, name?: string, status?: string): Promise<void> => { return httpClient.post(\`/v2/pet/\${petId}\`, { formData: { name: name, status: status } }); };
      `.trim()
    )
  })
});
