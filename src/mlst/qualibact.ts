/**
 * qualibact.ts
 *
 * Fetches QC thresholds from the qualibact project and applies them to
 * assembly stats computed from parsed FASTA files.
 *
 * Only Quast-computable metrics are used (no CheckM/Speciator/Ariba/Sylph):
 *   N50, # contigs, Total length, GC (%), Ns per 100 kbp
 */

import type { AssemblyStats } from './assemblyStats'

const CRITERIA_URL =
  'https://raw.githubusercontent.com/happykhan/qualibact/main/test_criteria.csv'

export interface QCCriterion {
  field: string
  operator: string
  value: number
}

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

/** Map MLST scheme name → species name used in qualibact criteria */
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
  koxytoca: 'Klebsiella pneumoniae',
  kpneumoniae: 'Klebsiella pneumoniae',
  kpneumoniae_2: 'Klebsiella pneumoniae',
  mgenitalium: 'Mycoplasma genitalium',
  mpneumoniae: 'Mycoplasma pneumoniae',
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

/** Quast field names → AssemblyStats keys */
const FIELD_MAP: Record<string, keyof AssemblyStats> = {
  'N50': 'n50',
  '# contigs (>= 0 bp)': 'contigCount',
  'Total length (>= 0 bp)': 'totalLength',
  'GC (%)': 'gcPercent',
  'Ns per 100 kbp': 'nsPer100k',
}

interface RawCriterion {
  species: string
  assembly_type: string
  software: string
  field: string
  operator: string
  value: string
}

let cachedCriteria: RawCriterion[] | null = null

async function loadCriteria(): Promise<RawCriterion[]> {
  if (cachedCriteria) return cachedCriteria

  const res = await fetch(CRITERIA_URL)
  if (!res.ok) throw new Error(`Failed to fetch qualibact criteria: ${res.status}`)

  const text = await res.text()
  const lines = text.trim().split('\n')
  const header = lines[0].split(',')

  const criteria: RawCriterion[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(',')
    const row: Record<string, string> = {}
    header.forEach((h, idx) => { row[h] = fields[idx]?.trim() ?? '' })
    criteria.push(row as unknown as RawCriterion)
  }

  cachedCriteria = criteria
  return criteria
}

function applyOp(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>=': return value >= threshold
    case '<=': return value <= threshold
    case '>': return value > threshold
    case '<': return value < threshold
    case '=': return value === threshold
    default: return true
  }
}

export async function runQC(
  stats: AssemblyStats,
  scheme: string,
): Promise<QCResult> {
  const species = SCHEME_TO_SPECIES[scheme] ?? null

  let criteria: RawCriterion[]
  try {
    criteria = await loadCriteria()
  } catch {
    return { filename: stats.filename, species, overall: 'unknown', checks: [] }
  }

  // Filter to Quast rules only, applicable to this species + assembly_type=all or short
  const allCriteria = criteria.filter(
    (c) =>
      c.software === 'Quast' &&
      (c.species === 'all' || c.species === species) &&
      (c.assembly_type === 'all' || c.assembly_type === 'short') &&
      !c.field.startsWith('speciesName') &&
      FIELD_MAP[c.field],
  )

  // For fields that have species-specific criteria, drop the generic 'all' fallback —
  // otherwise the generic thresholds (designed for small genomes) conflict with
  // species-specific ones (e.g. generic Total length < 1.2Mb would fail E. coli)
  const speciesFields = new Set(
    allCriteria.filter((c) => c.species === species).map((c) => c.field)
  )
  const applicable = allCriteria.filter(
    (c) => c.species === species || !speciesFields.has(c.field)
  )

  const checks: QCCheck[] = []

  for (const criterion of applicable) {
    const statKey = FIELD_MAP[criterion.field]
    if (!statKey) continue

    const value = stats[statKey] as number
    const threshold = parseFloat(criterion.value)
    const passes = applyOp(value, criterion.operator, threshold)

    checks.push({
      field: criterion.field,
      value,
      threshold: `${criterion.operator} ${criterion.value}`,
      status: passes ? 'pass' : 'fail',
    })
  }

  const overall: QCStatus =
    checks.length === 0
      ? 'unknown'
      : checks.some((c) => c.status === 'fail')
      ? 'fail'
      : 'pass'

  return { filename: stats.filename, species, overall, checks }
}
