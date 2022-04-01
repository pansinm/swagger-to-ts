import ts from "typescript";
import { Printer } from "../Printer";

export function assertCode(nodes: ts.Node[], code: string) {
  expect(Printer.print(nodes).replace(/\s/g, '')).toBe(Printer.format(code).replace(/\s/g, ''));
}
