/**
 * qualibact.ts
 *
 * Fetches QC thresholds from per-species summary.csv files in the qualibact project.
 * Uses lower_bound / upper_bound columns derived from genome distributions.
 *
 * Only metrics computable from the FASTA assembly are checked:
 *   N50, number of contigs, genome size, GC content
 */

import type { AssemblyStats } from './assemblyStats'

const QUALIBACT_BASE = 'https://happykhan.github.io/qualibact'

export type QCStatus = 'pass' | 'warn' | 'fail' | 'unknown'

export interface QCCheck {
  field: string
  value: number
  threshold: string
  status: QCStatus
}

export interface QCResult {
  filename: string
  species: string | null
  overall: QCStatus
  checks: QCCheck[]
}

/** Map MLST scheme name → species display name */
const SCHEME_TO_SPECIES: Record<string, string> = {
  abaumannii: 'Acinetobacter baumannii',
  abaumannii_2: 'Acinetobacter baumannii',
  ccoli: 'Campylobacter coli',
  cjejuni: 'Campylobacter jejuni',
  cjejuni_2: 'Campylobacter jejuni',
  ecoli: 'Escherichia coli',
  ecoli_achtman_4: 'Escherichia coli',
  efaecalis: 'Enterococcus faecalis',
  efaecium: 'Enterococcus faecium',
  hinfluenzae: 'Haemophilus influenzae',
  hpylori: 'Helicobacter pylori',
  koxytoca: 'Klebsiella oxytoca',
  kpneumoniae: 'Klebsiella pneumoniae',
  kpneumoniae_2: 'Klebsiella pneumoniae',
  nmeningitidis: 'Neisseria meningitidis',
  ngonorrhoeae: 'Neisseria gonorrhoeae',
  paeruginosa: 'Pseudomonas aeruginosa',
  salmonella: 'Salmonella enterica',
  senterica: 'Salmonella enterica',
  sflexneri: 'Shigella flexneri',
  ssonnei: 'Shigella sonnei',
  saureus: 'Staphylococcus aureus',
  sagalactiae: 'Streptococcus agalactiae',
  spneumoniae: 'Streptococcus pneumoniae',
  spyogenes: 'Streptococcus pyogenes',
}

/** Which {Species}_metrics.csv metric names map to AssemblyStats fields.
 *  GC_Content in metrics.csv is already in % (50.0–52.0), same as gcPercent. */
const METRIC_MAP: Record<string, { key: keyof AssemblyStats; label: string }> = {
  N50:           { key: 'n50',         label: 'N50' },
  no_of_contigs: { key: 'contigCount', label: '# contigs' },
  Genome_Size:   { key: 'totalLength', label: 'Genome size (bp)' },
  GC_Content:    { key: 'gcPercent',   label: 'GC (%)' },
}

/** Parsed threshold row (species-level, reusable across samples) */
interface ThresholdRow {
  field: string
  lower: number | null
  upper: number | null
}

/** Cache raw thresholds per species (null = fetch failed) */
const thresholdCache = new Map<string, ThresholdRow[] | null>()

/** Convert "Genus species" → URL "Genus/Genus_species/Genus_species_metrics.csv" */
function metricsUrl(species: string): string {
  const parts = species.trim().split(/\s+/)
  const genus = parts[0]
  const epithet = parts[1] ?? ''
  const slug = `${genus}_${epithet}`
  return `${QUALIBACT_BASE}/${genus}/${slug}/${slug}_metrics.csv`
}

async function fetchThresholds(species: string): Promise<ThresholdRow[]> {
  const url = metricsUrl(species)
  const res = await fetch(url)
  if (!res.ok) return []

  const text = await res.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',')
  const metricIdx = header.indexOf('metric')
  const lowerIdx = header.indexOf('lower_bounds')
  const upperIdx = header.indexOf('upper_bounds')
  if (metricIdx < 0 || lowerIdx < 0 || upperIdx < 0) return []

  const rows: ThresholdRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const metric = cols[metricIdx]?.trim()
    const mapping = METRIC_MAP[metric]
    if (!mapping) continue
    const rawLower = cols[lowerIdx]?.trim()
    const rawUpper = cols[upperIdx]?.trim()
    rows.push({
      field: mapping.label,
      lower: rawLower && !isNaN(Number(rawLower)) ? Number(rawLower) : null,
      upper: rawUpper && !isNaN(Number(rawUpper)) ? Number(rawUpper) : null,
    })
  }
  return rows
}

function applyThresholds(stats: AssemblyStats, rows: ThresholdRow[]): QCCheck[] {
  const checks: QCCheck[] = []
  // Build a reverse map: label → AssemblyStats key
  const labelToKey = Object.fromEntries(
    Object.values(METRIC_MAP).map(({ key, label }) => [label, key])
  )
  for (const row of rows) {
    const statKey = labelToKey[row.field] as keyof AssemblyStats | undefined
    if (!statKey) continue
    const value = stats[statKey] as number
    if (row.lower !== null) {
      checks.push({
        field: row.field,
        value,
        threshold: `>= ${row.lower.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        status: value >= row.lower ? 'pass' : 'fail',
      })
    }
    if (row.upper !== null) {
      checks.push({
        field: row.field,
        value,
        threshold: `<= ${row.upper.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        status: value <= row.upper ? 'pass' : 'fail',
      })
    }
  }
  return checks
}

export async function runQC(
  stats: AssemblyStats,
  scheme: string,
): Promise<QCResult> {
  const species = SCHEME_TO_SPECIES[scheme] ?? null

  if (!species) {
    return { filename: stats.filename, species: null, overall: 'unknown', checks: [] }
  }

  let rows: ThresholdRow[]
  if (thresholdCache.has(species)) {
    const cached = thresholdCache.get(species)
    if (!cached) {
      return { filename: stats.filename, species, overall: 'unknown', checks: [] }
    }
    rows = cached
  } else {
    try {
      rows = await fetchThresholds(species)
      thresholdCache.set(species, rows)
    } catch {
      thresholdCache.set(species, null)
      return { filename: stats.filename, species, overall: 'unknown', checks: [] }
    }
  }

  const checks = applyThresholds(stats, rows)
  const overall: QCStatus =
    checks.length === 0
      ? 'unknown'
      : checks.some((c) => c.status === 'fail')
      ? 'fail'
      : 'pass'

  return { filename: stats.filename, species, overall, checks }
}
