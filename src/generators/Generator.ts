import ts from 'typescript'

export interface Generator {
  generate: () => ts.Node[];
}
