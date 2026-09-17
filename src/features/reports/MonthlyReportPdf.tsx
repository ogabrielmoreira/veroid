import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { DashData } from '@/features/dashboard/useDashboard'
import { resolveBrand, type BrandKit } from '@/lib/brand'

export interface ReportInput {
  orgName: string
  niche: string
  brandKit: BrandKit | null | undefined
  periodLabel: string
  generatedAt: Date
  data: DashData
  lang: string
}

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: 'Helvetica', color: '#1A1D2E' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  logo: { width: 28, height: 28, marginRight: 8, borderRadius: 4 },
  orgName: { fontSize: 16, fontWeight: 700 },
  muted: { color: '#5B6178', fontSize: 9 },
  h1: { fontSize: 18, fontWeight: 700, marginTop: 18, marginBottom: 2 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 16, marginBottom: 8 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#E3E5F0', marginVertical: 10 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpiCard: { width: '31%', backgroundColor: '#F5F6FA', borderRadius: 6, padding: 10, marginBottom: 8 },
  kpiLabel: { fontSize: 8, color: '#5B6178', textTransform: 'uppercase', letterSpacing: 0.4 },
  kpiValue: { fontSize: 16, fontWeight: 700, marginTop: 4 },
  table: { borderWidth: 1, borderColor: '#E3E5F0', borderRadius: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E3E5F0' },
  trLast: { flexDirection: 'row' },
  th: { flex: 1, padding: 6, fontWeight: 700, backgroundColor: '#F5F6FA', fontSize: 9 },
  td: { flex: 1, padding: 6, fontSize: 9 },
  bullet: { flexDirection: 'row', marginBottom: 5, gap: 6 },
  bulletMark: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#4756C9', marginTop: 4 },
  footer: { position: 'absolute', bottom: 24, left: 36, right: 36, fontSize: 8, color: '#8A8FA3', textAlign: 'center', borderTopWidth: 1, borderTopColor: '#E3E5F0', paddingTop: 8 },
})

const fmtInt = (n: number | null | undefined, lang: string) => (n === null || n === undefined ? '—' : new Intl.NumberFormat(lang).format(n))
const fmtPct = (n: number | null | undefined, lang: string) => (n === null || n === undefined ? '—' : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(n)}%`)
const fmtBrl = (n: number | null | undefined, lang: string) => (n === null || n === undefined ? '—' : new Intl.NumberFormat(lang, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n))
const fmtDuration = (s: number | null | undefined) => (s === null || s === undefined ? '—' : s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`)

const FRAUD_LABELS_PT: Record<string, string> = {
  screen: 'Tela/replay', printed: 'Foto impressa', no_face: 'Sem rosto, animal ou objeto',
  face_mismatch: 'Rosto divergente', device: 'Dispositivo repetido', data: 'Dados inconsistentes', liveness: 'Prova de vida falhou', other: 'Outros',
}
const FRAUD_LABELS_EN: Record<string, string> = {
  screen: 'Screen/replay', printed: 'Printed photo', no_face: 'No face, animal or object',
  face_mismatch: 'Face mismatch', device: 'Repeated device', data: 'Inconsistent data', liveness: 'Liveness failed', other: 'Other',
}

/** Recomendações derivadas heuristicamente dos números do período — nunca texto fixo genérico (§5.8). */
function buildRecommendations(d: DashData, lang: string): string[] {
  const isPt = lang !== 'en'
  const out: string[] = []
  const auto = d.kpis.auto_approval_rate ?? 0
  const approval = d.kpis.approval_rate ?? 0
  const completion = d.kpis.avg_completion_seconds ?? 0
  const funnelSent = d.funnel[0]?.n ?? 0
  const funnelCamera = d.funnel.find((f) => f.step === 'camera')
  const funnelSubmitted = d.funnel.find((f) => f.step === 'submitted')?.n ?? 0
  const highBucketShare = d.histogram.length ? (d.histogram.slice(7).reduce((s, h) => s + h.n, 0) / Math.max(1, d.histogram.reduce((s, h) => s + h.n, 0))) * 100 : 0

  if (funnelSent > 0 && funnelCamera?.denied && funnelCamera.denied / funnelSent > 0.03) {
    out.push(isPt
      ? `${fmtPct((100 * funnelCamera.denied) / funnelSent, lang)} dos links negaram a permissão de câmera. Revise o texto do tutorial antes da permissão — costuma reduzir a negativa.`
      : `${fmtPct((100 * funnelCamera.denied) / funnelSent, lang)} of links denied camera permission. Review the pre-permission tutorial copy — it usually reduces denials.`)
  }
  if (funnelSent > 0 && funnelSubmitted / funnelSent < 0.7) {
    out.push(isPt
      ? `Só ${fmtPct((100 * funnelSubmitted) / funnelSent, lang)} dos links enviados terminaram em envio. Considere lembrar o titular por outro canal antes do link expirar.`
      : `Only ${fmtPct((100 * funnelSubmitted) / funnelSent, lang)} of sent links ended in a submission. Consider a reminder on another channel before the link expires.`)
  }
  if (auto < 50) {
    out.push(isPt
      ? `Aprovação automática em ${fmtPct(auto, lang)}. Se a taxa de fraude confirmada estiver baixa, considere afrouxar o limiar de risco em Configurações → Regras (com a prévia de impacto).`
      : `Auto-approval at ${fmtPct(auto, lang)}. If confirmed fraud is low, consider relaxing the risk threshold in Settings → Rules (using the impact preview).`)
  }
  if (highBucketShare > 25) {
    out.push(isPt
      ? `${fmtPct(highBucketShare, lang)} das sessões pontuadas ficaram nas faixas mais altas de risco. Vale revisar se algum sinal está pesando mais do que deveria para o seu nicho.`
      : `${fmtPct(highBucketShare, lang)} of scored sessions landed in the highest risk buckets. Worth checking whether a signal is weighted more than it should for your niche.`)
  }
  if (completion > 240) {
    out.push(isPt
      ? `Tempo médio de conclusão de ${fmtDuration(completion)}. Etapas com muita hesitação podem indicar formulário longo ou captura difícil em conexões fracas.`
      : `Average completion time of ${fmtDuration(completion)}. Steps with a lot of hesitation may indicate a long form or hard capture on weak connections.`)
  }
  if (approval > 0 && d.kpis.qualified === 0) {
    out.push(isPt
      ? 'Nenhum titular qualificado no período. Confirme se o opt-in de marketing está sendo pedido claramente na tela de consentimento.'
      : 'No qualified subjects this period. Check that the marketing opt-in is being asked clearly on the consent screen.')
  }
  if (out.length === 0) {
    out.push(isPt ? 'Nenhum ponto fora do esperado neste período — os indicadores estão dentro da faixa saudável.' : 'Nothing out of the ordinary this period — indicators are within a healthy range.')
  }
  return out
}

export function MonthlyReportPdf({ orgName, niche, brandKit, periodLabel, generatedAt, data: d, lang }: ReportInput) {
  const brand = resolveBrand(brandKit)
  const isPt = lang !== 'en'
  const fraudLabels = isPt ? FRAUD_LABELS_PT : FRAUD_LABELS_EN
  const fraudTotals = new Map<string, number>()
  for (const row of d.fraud_types) fraudTotals.set(row.type, (fraudTotals.get(row.type) ?? 0) + row.n)
  const fraudRows = [...fraudTotals.entries()].sort((a, b) => b[1] - a[1])
  const recommendations = buildRecommendations(d, lang)
  const t = {
    reportTitle: isPt ? 'Relatório mensal' : 'Monthly report',
    generatedAt: isPt ? 'Gerado em' : 'Generated on',
    kpis: isPt ? 'Indicadores do período' : 'Period indicators',
    funnel: isPt ? 'Funil de verificação' : 'Verification funnel',
    fraud: isPt ? 'Tentativas de fraude por tipo' : 'Fraud attempts by type',
    recs: isPt ? 'Recomendações' : 'Recommendations',
    step: isPt ? 'Etapa' : 'Step',
    count: isPt ? 'Sessões' : 'Sessions',
    type: isPt ? 'Tipo' : 'Type',
    verifications: isPt ? 'Verificações' : 'Verifications',
    autoApproval: isPt ? 'Aprovação automática' : 'Auto-approval',
    blocked: isPt ? 'Fraudes bloqueadas' : 'Fraud blocked',
    losses: isPt ? 'Perdas evitadas (est.)' : 'Losses prevented (est.)',
    time: isPt ? 'Tempo médio' : 'Avg. time',
    qualified: isPt ? 'Clientes qualificados' : 'Qualified customers',
    honesty: isPt
      ? 'Protótipo de demonstração. A detecção usa visão computacional e IA generativa e não substitui prova de vida certificada (ISO/IEC 30107-3).'
      : 'Demonstration prototype. Detection uses computer vision and generative AI and does not replace certified liveness detection (ISO/IEC 30107-3).',
  }
  const funnelSteps: Record<string, string> = isPt
    ? { sent: 'Link enviado', opened: 'Link aberto', camera: 'Permitiu a câmera', captured: 'Capturou', submitted: 'Enviou', approved: 'Aprovado' }
    : { sent: 'Link sent', opened: 'Link opened', camera: 'Camera allowed', captured: 'Captured', submitted: 'Submitted', approved: 'Approved' }

  return (
    <Document title={`${t.reportTitle} — ${orgName}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {brand.logo_light_url ? <Image src={brand.logo_light_url} style={styles.logo} /> : null}
            <Text style={[styles.orgName, { color: brand.primary }]}>{orgName}</Text>
          </View>
          <Text style={styles.muted}>{t.generatedAt} {generatedAt.toLocaleDateString(lang)}</Text>
        </View>
        <Text style={styles.muted}>{isPt ? `Nicho: ${niche}` : `Niche: ${niche}`}</Text>

        <Text style={styles.h1}>{t.reportTitle}</Text>
        <Text style={styles.muted}>{periodLabel}</Text>

        <Text style={styles.h2}>{t.kpis}</Text>
        <View style={styles.kpiGrid}>
          {[
            [t.verifications, fmtInt(d.kpis.verifications, lang)],
            [t.autoApproval, fmtPct(d.kpis.auto_approval_rate, lang)],
            [t.blocked, fmtInt(d.kpis.fraud_blocked, lang)],
            [t.losses, fmtBrl(d.kpis.losses_prevented, lang)],
            [t.time, fmtDuration(d.kpis.avg_completion_seconds)],
            [t.qualified, fmtInt(d.kpis.qualified, lang)],
          ].map(([label, value]) => (
            <View key={label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{label}</Text>
              <Text style={[styles.kpiValue, { color: brand.primary }]}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>{t.funnel}</Text>
        <View style={styles.table}>
          <View style={styles.tr}><Text style={styles.th}>{t.step}</Text><Text style={styles.th}>{t.count}</Text></View>
          {d.funnel.map((f, i) => (
            <View key={f.step} style={i === d.funnel.length - 1 ? styles.trLast : styles.tr}>
              <Text style={styles.td}>{funnelSteps[f.step] ?? f.step}</Text>
              <Text style={styles.td}>{fmtInt(f.n, lang)}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>{t.fraud}</Text>
        {fraudRows.length === 0 ? (
          <Text style={styles.muted}>{isPt ? 'Nenhum sinal de fraude registrado no período.' : 'No fraud signal recorded this period.'}</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tr}><Text style={styles.th}>{t.type}</Text><Text style={styles.th}>{t.count}</Text></View>
            {fraudRows.map(([type, n], i) => (
              <View key={type} style={i === fraudRows.length - 1 ? styles.trLast : styles.tr}>
                <Text style={styles.td}>{fraudLabels[type] ?? type}</Text>
                <Text style={styles.td}>{fmtInt(n, lang)}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.h2}>{t.recs}</Text>
        {recommendations.map((r, i) => (
          <View key={i} style={styles.bullet}>
            <View style={styles.bulletMark} />
            <Text style={{ flex: 1 }}>{r}</Text>
          </View>
        ))}

        <Text style={styles.footer}>{t.honesty} · Vero ID</Text>
      </Page>
    </Document>
  )
}
