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

const QUALIBACT_BASE =
  'https://raw.githubusercontent.com/happykhan/qualibact/main/docs'

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

/** Which summary.csv metrics map to AssemblyStats fields, and any unit conversion */
const METRIC_MAP: Record<
  string,
  { key: keyof AssemblyStats; label: string; scale?: number }
> = {
  N50:          { key: 'n50',         label: 'N50' },
  number:       { key: 'contigCount', label: '# contigs' },
  Genome_Size:  { key: 'totalLength', label: 'Genome size (bp)' },
  // GC_Content stored as fraction (0.506); gcPercent is % (50.6) → multiply by 100
  GC_Content:   { key: 'gcPercent',   label: 'GC (%)', scale: 100 },
}

/** Cache per species to avoid re-fetching */
const cache = new Map<string, QCCheck[] | null>()

/** Convert "Genus species" → URL path component "Genus/Genus_species" */
function speciesPath(species: string): string {
  const parts = species.trim().split(/\s+/)
  const genus = parts[0]
  const epithet = parts[1] ?? ''
  return `${genus}/${genus}_${epithet}`
}

async function fetchChecks(
  stats: AssemblyStats,
  species: string,
): Promise<QCCheck[]> {
  const path = speciesPath(species)
  const url = `${QUALIBACT_BASE}/${path}/summary.csv`

  const res = await fetch(url)
  if (!res.ok) return []

  const text = await res.text()
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []

  const header = lines[0].split(',')
  const metricIdx = header.indexOf('metric')
  const lowerIdx = header.indexOf('lower_bound')
  const upperIdx = header.indexOf('upper_bound')
  if (metricIdx < 0 || lowerIdx < 0 || upperIdx < 0) return []

  const checks: QCCheck[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    const metric = cols[metricIdx]?.trim()
    const mapping = METRIC_MAP[metric]
    if (!mapping) continue

    const rawLower = cols[lowerIdx]?.trim()
    const rawUpper = cols[upperIdx]?.trim()
    const scale = mapping.scale ?? 1
    const value = (stats[mapping.key] as number) / scale

    if (rawLower && !isNaN(Number(rawLower))) {
      const lower = Number(rawLower)
      checks.push({
        field: mapping.label,
        value: stats[mapping.key] as number,
        threshold: `>= ${(lower * scale).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        status: value >= lower ? 'pass' : 'fail',
      })
    }

    if (rawUpper && !isNaN(Number(rawUpper))) {
      const upper = Number(rawUpper)
      checks.push({
        field: mapping.label,
        value: stats[mapping.key] as number,
        threshold: `<= ${(upper * scale).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        status: value <= upper ? 'pass' : 'fail',
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

  let checks: QCCheck[]
  if (cache.has(species)) {
    const template = cache.get(species)
    if (!template) {
      return { filename: stats.filename, species, overall: 'unknown', checks: [] }
    }
    // Re-evaluate thresholds against this sample's stats
    checks = await fetchChecks(stats, species)
  } else {
    try {
      checks = await fetchChecks(stats, species)
      cache.set(species, checks)
    } catch {
      cache.set(species, null)
      return { filename: stats.filename, species, overall: 'unknown', checks: [] }
    }
  }

  const overall: QCStatus =
    checks.length === 0
      ? 'unknown'
      : checks.some((c) => c.status === 'fail')
      ? 'fail'
      : 'pass'

  return { filename: stats.filename, species, overall, checks }
}
