import type { SchemeData, MLSTScheme, STProfile } from './types'

const CDN_BASE = 'https://static.genomicx.org/db/mlstx'

/** Cached raw schemes map: schemeName → loci[] */
let schemesMap: Record<string, string[]> | null = null

async function fetchSchemesMap(): Promise<Record<string, string[]>> {
  if (schemesMap) return schemesMap
  const res = await fetch(`${CDN_BASE}/schemes.json`)
  if (!res.ok) throw new Error('Failed to load scheme list')
  schemesMap = await res.json()
  return schemesMap!
}

/**
 * Fetch the list of available MLST scheme names.
 * schemes.json on CDN is a dict {schemeName: loci[]}.
 */
export async function fetchSchemeList(): Promise<string[]> {
  const map = await fetchSchemesMap()
  return Object.keys(map).sort()
}

// Cache scheme data to avoid re-downloading when multiple files share a scheme
const schemeCache = new Map<string, SchemeData>()

/**
 * Load full scheme data for a given scheme name.
 * Downloads profiles.json and all locus FASTA files.
 * Loci are sourced from the already-fetched schemes.json to avoid an extra round-trip.
 * Tries CDN first, falls back to local /db/ for the 4 bundled schemes.
 */
export async function loadSchemeData(schemeName: string): Promise<SchemeData> {
  if (schemeCache.has(schemeName)) return schemeCache.get(schemeName)!

  // Get loci from the schemes map (already fetched for the scheme list)
  const map = await fetchSchemesMap()
  const loci = map[schemeName]
  if (!loci) throw new Error(`Unknown scheme: ${schemeName}`)

  const scheme: MLSTScheme = { name: schemeName, loci }

  // Determine base URL — try CDN first, fall back to local bundled schemes
  const cdnBase = `${CDN_BASE}/${schemeName}`
  const localBase = `/db/${schemeName}`

  async function tryFetch(path: string): Promise<Response> {
    try {
      const cdnRes = await fetch(`${cdnBase}/${path}`)
      if (cdnRes.ok) return cdnRes
    } catch {
      // CDN unreachable (CORS, network) — fall through to local
    }
    return fetch(`${localBase}/${path}`)
  }

  const profilesRes = await tryFetch('profiles.json')
  if (!profilesRes.ok) throw new Error(`Failed to load profiles: ${schemeName}`)
  const profiles: STProfile[] = await profilesRes.json()

  // Load allele FASTAs in parallel
  const alleleFastas: Record<string, string> = {}
  await Promise.all(loci.map(async (locus) => {
    const res = await tryFetch(`${locus}.fasta`)
    if (!res.ok) {
      console.warn(`Failed to load alleles for locus: ${locus}`)
      return
    }
    alleleFastas[locus] = await res.text()
  }))

  const data = { scheme, profiles, alleleFastas }
  schemeCache.set(schemeName, data)
  return data
}
