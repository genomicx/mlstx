import type { LocusResult, STProfile, MLSTResult } from './types'

/**
 * Given allele calls for all loci and the ST profiles database,
 * determine the sequence type.
 */
export function callST(
  filename: string,
  scheme: string,
  locusResults: LocusResult[],
  profiles: STProfile[],
): MLSTResult {
  const alleles: Record<string, string> = {}
  let hasNoHit = false
  let hasNovel = false

  for (const lr of locusResults) {
    alleles[lr.locus] = lr.allele
    if (lr.allele === '-') hasNoHit = true
    if (lr.allele.startsWith('~')) hasNovel = true
  }

  if (hasNoHit) {
    return { filename, scheme, st: '-', alleles }
  }

  if (hasNovel) {
    return { filename, scheme, st: '~', alleles }
  }

  // All loci have exact allele calls — look up ST
  const st = lookupST(alleles, profiles)
  return { filename, scheme, st, alleles }
}

function lookupST(
  alleles: Record<string, string>,
  profiles: STProfile[],
): string {
  for (const profile of profiles) {
    let match = true
    for (const [locus, allele] of Object.entries(alleles)) {
      if (profile.alleles[locus] !== allele) {
        match = false
        break
      }
    }
    if (match) return profile.st
  }
  return '~'
}
