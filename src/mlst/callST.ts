import type { LocusResult, STProfile, MLSTResult, MLSTStatus } from './types'

/**
 * Given allele calls for all loci and the ST profiles database,
 * determine the sequence type, STATUS (tseemann-compatible), and score.
 */
export function callST(
  filename: string,
  scheme: string,
  locusResults: LocusResult[],
  profiles: STProfile[],
  minscore = 50,
): MLSTResult {
  const alleles: Record<string, string> = {}
  let noHitCount = 0
  let hasNovel = false

  for (const lr of locusResults) {
    alleles[lr.locus] = lr.allele
    if (lr.allele === '-') noHitCount++
    if (lr.allele.startsWith('~')) hasNovel = true
  }

  // Score: average identity (0–100) across all loci
  const score = locusResults.length > 0
    ? Math.round(
        locusResults.reduce((sum, lr) => sum + lr.identity * 100, 0) / locusResults.length
      )
    : 0

  // Determine ST
  const allNoHit = noHitCount === locusResults.length
  const anyNoHit = noHitCount > 0

  let st: string
  let status: MLSTStatus

  if (allNoHit) {
    st = '-'
    status = 'NONE'
  } else if (anyNoHit) {
    st = '-'
    status = 'MISSING'
  } else if (hasNovel) {
    st = '~'
    status = 'MIXED'
  } else {
    st = lookupST(alleles, profiles)
    if (st !== '~') {
      status = 'PERFECT'
    } else {
      status = 'NOVEL'
    }
  }

  return { filename, scheme, st, alleles, status, score }
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
