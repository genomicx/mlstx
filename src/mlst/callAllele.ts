import type { AlignmentHit, LocusResult } from './types'

// Match tseemann/mlst defaults: --minid 95, --mincov 10
const IDENTITY_THRESHOLD = 0.95
const COVERAGE_THRESHOLD = 0.10

/**
 * Given all alignment hits for a locus (across all alleles and all contigs),
 * determine the best allele call.
 *
 * Each hit's targetName is expected to be the allele identifier (e.g. "adk_1").
 * The alleleLength map provides the full length of each allele sequence.
 */
export function callAllele(
  locus: string,
  hits: AlignmentHit[],
  alleleLengths: Record<string, number>,
): LocusResult {
  if (hits.length === 0) {
    return { locus, allele: 'no_hit', identity: 0, coverage: 0, bestHit: null }
  }

  let bestHit: AlignmentHit | null = null
  let bestIdentity = 0
  let bestCoverage = 0

  for (const hit of hits) {
    const alleleLen = alleleLengths[hit.targetName] ?? hit.targetLength
    if (alleleLen === 0) continue

    const identity = hit.identity / 100 // LASTZ reports percentage
    const coverage = hit.alignmentLength / alleleLen

    // Choose best: highest identity, then highest coverage
    if (
      identity > bestIdentity ||
      (identity === bestIdentity && coverage > bestCoverage)
    ) {
      bestIdentity = identity
      bestCoverage = coverage
      bestHit = hit
    }
  }

  if (!bestHit) {
    return { locus, allele: 'no_hit', identity: 0, coverage: 0, bestHit: null }
  }

  if (bestIdentity < IDENTITY_THRESHOLD || bestCoverage < COVERAGE_THRESHOLD) {
    return {
      locus,
      allele: 'no_hit',
      identity: bestIdentity,
      coverage: bestCoverage,
      bestHit,
    }
  }

  if (bestIdentity === 1.0 && bestCoverage >= 1.0) {
    // Exact match — extract allele number from target name
    // Target name format: "locusName_alleleNumber" e.g. "adk_1"
    const alleleNumber = extractAlleleNumber(bestHit.targetName)
    return {
      locus,
      allele: alleleNumber,
      identity: bestIdentity,
      coverage: bestCoverage,
      bestHit,
    }
  }

  // Above threshold but not exact
  return {
    locus,
    allele: 'novel',
    identity: bestIdentity,
    coverage: bestCoverage,
    bestHit,
  }
}

function extractAlleleNumber(targetName: string): string {
  // Handle formats like "adk_1", "adk-1", or just "1"
  const parts = targetName.split(/[_-]/)
  return parts[parts.length - 1]
}
