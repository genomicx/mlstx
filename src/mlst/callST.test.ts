import { describe, it, expect } from 'vitest'
import { callST } from './callST'
import type { LocusResult, STProfile } from './types'

function makeLocus(locus: string, allele: string, identity = 1.0): LocusResult {
  return { locus, allele, identity, coverage: 1.0, bestHit: null }
}

const profiles: STProfile[] = [
  { st: '1', alleles: { aroC: '1', dnaN: '1', hemD: '1' } },
  { st: '2', alleles: { aroC: '2', dnaN: '3', hemD: '1' } },
  { st: '10', alleles: { aroC: '5', dnaN: '5', hemD: '5' } },
]

describe('callST', () => {
  it('returns PERFECT status and ST for matching profile', () => {
    const loci = [makeLocus('aroC', '1'), makeLocus('dnaN', '1'), makeLocus('hemD', '1')]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('1')
    expect(result.status).toBe('PERFECT')
    expect(result.score).toBe(100)
    expect(result.alleles).toEqual({ aroC: '1', dnaN: '1', hemD: '1' })
  })

  it('returns MISSING status when any locus has no hit (-)', () => {
    const loci = [makeLocus('aroC', '1'), makeLocus('dnaN', '-', 0), makeLocus('hemD', '1')]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('-')
    expect(result.status).toBe('MISSING')
  })

  it('returns NONE status when all loci have no hit', () => {
    const loci = [makeLocus('aroC', '-', 0), makeLocus('dnaN', '-', 0), makeLocus('hemD', '-', 0)]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('-')
    expect(result.status).toBe('NONE')
  })

  it('returns MIXED status when any locus is novel (~N)', () => {
    const loci = [makeLocus('aroC', '1'), makeLocus('dnaN', '~3', 0.98), makeLocus('hemD', '1')]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('~')
    expect(result.status).toBe('MIXED')
  })

  it('returns NOVEL status when all exact but no matching profile', () => {
    const loci = [makeLocus('aroC', '99'), makeLocus('dnaN', '99'), makeLocus('hemD', '99')]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('~')
    expect(result.status).toBe('NOVEL')
  })

  it('prioritises MISSING over MIXED when both present', () => {
    const loci = [makeLocus('aroC', '~1', 0.97), makeLocus('dnaN', '-', 0), makeLocus('hemD', '1')]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('-')
    expect(result.status).toBe('MISSING')
  })

  it('score is average identity * 100 across loci', () => {
    const loci = [
      makeLocus('aroC', '1', 1.0),
      makeLocus('dnaN', '1', 0.96),
      makeLocus('hemD', '1', 1.0),
    ]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.score).toBe(Math.round((1.0 + 0.96 + 1.0) / 3 * 100))
  })

  it('includes filename, scheme and locusResults in result', () => {
    const loci = [makeLocus('aroC', '1'), makeLocus('dnaN', '1'), makeLocus('hemD', '1')]
    const result = callST('genome.fna', 'ecoli', loci, profiles)
    expect(result.filename).toBe('genome.fna')
    expect(result.scheme).toBe('ecoli')
    expect(result.locusResults).toHaveLength(3)
    expect(result.locusResults[0].locus).toBe('aroC')
  })
})
