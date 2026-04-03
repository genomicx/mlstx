import type { SchemeData, MLSTScheme, STProfile } from './types'

const CDN_BASE = 'https://static.genomicx.org/db/mlstx'

/**
 * Fetch the list of available MLST schemes.
 */
export async function fetchSchemeList(): Promise<string[]> {
  const res = await fetch(`${CDN_BASE}/schemes.json`)
  if (!res.ok) throw new Error('Failed to load scheme list')
  return res.json()
}

// Cache scheme data to avoid re-downloading when multiple files share a scheme
const schemeCache = new Map<string, SchemeData>()

/**
 * Load full scheme data for a given scheme name.
 * Downloads scheme.json, profiles.json, and all locus FASTA files from CDN.
 */
export async function loadSchemeData(schemeName: string): Promise<SchemeData> {
  if (schemeCache.has(schemeName)) return schemeCache.get(schemeName)!

  const base = `${CDN_BASE}/${schemeName}`

  const [schemeRes, profilesRes] = await Promise.all([
    fetch(`${base}/scheme.json`),
    fetch(`${base}/profiles.json`),
  ])

  if (!schemeRes.ok) throw new Error(`Failed to load scheme: ${schemeName}`)
  if (!profilesRes.ok) throw new Error(`Failed to load profiles: ${schemeName}`)

  const scheme: MLSTScheme = await schemeRes.json()
  const profiles: STProfile[] = await profilesRes.json()

  // Load allele FASTAs in parallel
  const alleleFastas: Record<string, string> = {}
  const fastaPromises = scheme.loci.map(async (locus) => {
    const res = await fetch(`${base}/${locus}.fasta`)
    if (!res.ok) {
      console.warn(`Failed to load alleles for locus: ${locus}`)
      return
    }
    alleleFastas[locus] = await res.text()
  })

  await Promise.all(fastaPromises)

  const data = { scheme, profiles, alleleFastas }
  schemeCache.set(schemeName, data)
  return data
}
