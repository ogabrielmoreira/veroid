import { pdf } from '@react-pdf/renderer'
import { createElement } from 'react'
import type { DashData } from '@/features/dashboard/useDashboard'
import type { BrandKit } from '@/lib/brand'
import { MonthlyReportPdf, type ReportInput } from './MonthlyReportPdf'

/** Gera o PDF no navegador (sem servidor) e dispara o download — §5.8. */
export async function downloadMonthlyReport(input: {
  orgName: string
  niche: string
  brandKit: BrandKit | null | undefined
  periodLabel: string
  data: DashData
  lang: string
}) {
  const props: ReportInput = { ...input, generatedAt: new Date() }
  // MonthlyReportPdf renders a <Document> at its root, but TS only sees the wrapper
  // component's own prop type here — safe to hand straight to @react-pdf/renderer's pdf().
  const element = createElement(MonthlyReportPdf, props) as unknown as Parameters<typeof pdf>[0]
  const blob = await pdf(element).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `relatorio-${input.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}.pdf`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
