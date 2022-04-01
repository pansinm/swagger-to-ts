import ejs from "ejs";
import ts from "typescript";

export class Template<T> {
  template: string;
  constructor(template: string) {
    this.template = template;
  }

  generate(context: T) {
    const code = ejs.render(this.template, context);
    const sourceFile = ts.createSourceFile(
      "_.ts",
      code,
      ts.ScriptTarget.Latest
    );
    return sourceFile.statements[0];
  }
}
