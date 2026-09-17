import Papa from 'papaparse'
import { onlyDigits } from '@/lib/validators'
import type { Channel } from './linkUtils'

export interface BatchRow { name: string; phone: string; email: string; reference: string }
export interface ParsedRow extends BatchRow { index: number; errors: string[] }

const ALIASES: Record<keyof BatchRow, string[]> = {
  name: ['nome', 'name', 'titular', 'nome completo'],
  phone: ['celular', 'telefone', 'phone', 'whatsapp', 'fone'],
  email: ['email', 'e-mail', 'mail'],
  reference: ['referencia', 'referência', 'reference', 'pedido', 'contrato', 'placa'],
}

const norm = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function parseCsv(text: string): { rows: BatchRow[]; missingName: boolean } {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => norm(h) })
  const headers = res.meta.fields ?? []
  const pick = (key: keyof BatchRow) => headers.find((h) => ALIASES[key].map(norm).includes(h))
  const cols = { name: pick('name'), phone: pick('phone'), email: pick('email'), reference: pick('reference') }
  const rows = res.data.map((r) => ({
    name: (cols.name ? r[cols.name] : '')?.trim() ?? '',
    phone: (cols.phone ? r[cols.phone] : '')?.trim() ?? '',
    email: (cols.email ? r[cols.email] : '')?.trim() ?? '',
    reference: (cols.reference ? r[cols.reference] : '')?.trim() ?? '',
  }))
  return { rows, missingName: !cols.name }
}

/** Validação linha a linha; as mensagens são chaves i18n. */
export function validateRows(rows: BatchRow[], channel: Channel): ParsedRow[] {
  return rows.map((r, index) => {
    const errors: string[] = []
    const d = onlyDigits(r.phone)
    if (r.name.length < 2) errors.push('links.batchErrors.name')
    if ((channel === 'whatsapp' || channel === 'sms') && d.length === 0) errors.push('links.batchErrors.phoneRequired')
    if (d.length > 0 && (d.length < 10 || d.length > 11)) errors.push('links.batchErrors.phone')
    if (channel === 'email' && !r.email) errors.push('links.batchErrors.emailRequired')
    if (r.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) errors.push('links.batchErrors.email')
    if (r.reference.length > 80) errors.push('links.batchErrors.reference')
    return { ...r, index, errors }
  })
}

export function toCsv(rows: Array<Record<string, string>>) {
  return Papa.unparse(rows, { quotes: true })
}

export const CSV_TEMPLATE = 'nome,celular,email,referencia\nMaria da Silva,11987654321,maria@exemplo.com,PED-1042\nJoão Pereira,21998765432,,PED-1043\n'
