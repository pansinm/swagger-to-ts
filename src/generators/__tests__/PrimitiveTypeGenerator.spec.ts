import { PrimitiveTypeGenerator} from '../PrimitiveTypeGenerator'
import { assertCode } from './utils'
import ts from 'typescript'
describe('test' + PrimitiveTypeGenerator.name, () => {
  it('boolean', () => {
    assertCode(new PrimitiveTypeGenerator({ type: 'boolean'}).generate(), 'boolean')
  })
  it ('string', () => {
    assertCode(new PrimitiveTypeGenerator({ type: 'string'}).generate(), 'string')
  })
  it('integer', () => {
    assertCode(new PrimitiveTypeGenerator({ type: 'integer'}).generate(), 'number')
  })
  it('number', () => {
    assertCode(new PrimitiveTypeGenerator({ type: 'number'}).generate(), 'number')
  })
  it('file', () => {
    assertCode(new PrimitiveTypeGenerator({ type: 'file'}).generate(), 'any')
  })
  it('object', () => {
    assertCode(new PrimitiveTypeGenerator({ type: 'object'}).generate(), 'any')
  })
  it('array', () => {
    expect(new PrimitiveTypeGenerator({ type: 'array'}).generate()[0].kind === ts.SyntaxKind.ArrayType)
  })
})
