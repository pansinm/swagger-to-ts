import { Schema } from "swagger-schema-official";
import { factory } from "typescript";
import { Generator } from "./Generator";


export class SchemaJsDocGenerator implements Generator {
  schema: Schema;
  constructor(schema: Schema) {
    this.schema = schema;
  }
  generate() {
    if (!this.schema.description) {
      return [];
    }
    return [factory.createJSDocComment(this.schema.description)]
  }
}
