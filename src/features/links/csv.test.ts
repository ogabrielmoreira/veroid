import { describe, expect, it } from 'vitest'
import { parseCsv, validateRows } from './csv'

describe('CSV em lote', () => {
  it('reconhece cabeçalhos em PT com acento e BOM', () => {
    const { rows, missingName } = parseCsv('﻿Nome;Celular;E-mail;Referência\nAna Lima;(11) 98765-4321;ana@x.com;A1\n'.replace(/;/g, ','))
    expect(missingName).toBe(false)
    expect(rows[0]).toEqual({ name: 'Ana Lima', phone: '(11) 98765-4321', email: 'ana@x.com', reference: 'A1' })
  })
  it('valida por canal', () => {
    const rows = [{ name: 'Ana', phone: '', email: '', reference: '' }, { name: 'B', phone: '123', email: 'x', reference: '' }]
    const w = validateRows(rows, 'whatsapp')
    expect(w[0].errors).toContain('links.batchErrors.phoneRequired')
    expect(w[1].errors).toEqual(expect.arrayContaining(['links.batchErrors.name', 'links.batchErrors.phone', 'links.batchErrors.email']))
    expect(validateRows([{ name: 'Ana', phone: '', email: 'a@b.co', reference: '' }], 'email')[0].errors).toEqual([])
  })
  it('sinaliza coluna de nome ausente', () => expect(parseCsv('celular\n11999999999').missingName).toBe(true))
})
