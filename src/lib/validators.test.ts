import { describe, expect, it } from 'vitest'
import { isValidCnpj, isValidCpf, maskCnpj, maskCpf, maskPhoneBr, passwordStrength } from './validators'

describe('CPF', () => {
  it('aceita CPF válido com e sem máscara', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })
  it('recusa dígito errado e sequências repetidas', () => {
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })
  it('mascara', () => expect(maskCpf('52998224725')).toBe('529.982.247-25'))
})

describe('CNPJ', () => {
  it('aceita CNPJ válido', () => {
    expect(isValidCnpj('11.222.333/0001-81')).toBe(true)
  })
  it('recusa inválido', () => {
    expect(isValidCnpj('11.222.333/0001-00')).toBe(false)
    expect(isValidCnpj('00000000000000')).toBe(false)
  })
  it('mascara', () => expect(maskCnpj('11222333000181')).toBe('11.222.333/0001-81'))
})

describe('máscaras e senha', () => {
  it('celular BR', () => expect(maskPhoneBr('11987654321')).toBe('(11) 98765-4321'))
  it('força da senha', () => {
    expect(passwordStrength('abc')).toBe(0)
    expect(passwordStrength('Abcdefgh1!xyz')).toBe(4)
  })
})
