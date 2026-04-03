import { describe, it, expect } from 'vitest'
import { callST } from './callST'
import type { LocusResult, STProfile } from './types'

function makeLocus(locus: string, allele: string): LocusResult {
  return { locus, allele, identity: 1.0, coverage: 1.0, bestHit: null }
}

const profiles: STProfile[] = [
  { st: '1', alleles: { aroC: '1', dnaN: '1', hemD: '1' } },
  { st: '2', alleles: { aroC: '2', dnaN: '3', hemD: '1' } },
  { st: '10', alleles: { aroC: '5', dnaN: '5', hemD: '5' } },
]

describe('callST', () => {
  it('returns correct ST for matching profile', () => {
    const loci = [
      makeLocus('aroC', '1'),
      makeLocus('dnaN', '1'),
      makeLocus('hemD', '1'),
    ]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('1')
    expect(result.alleles).toEqual({ aroC: '1', dnaN: '1', hemD: '1' })
  })

  it('returns - when any locus has no hit', () => {
    const loci = [
      makeLocus('aroC', '1'),
      makeLocus('dnaN', '-'),
      makeLocus('hemD', '1'),
    ]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('-')
  })

  it('returns ~ when any locus is novel (~N)', () => {
    const loci = [
      makeLocus('aroC', '1'),
      makeLocus('dnaN', '~3'),
      makeLocus('hemD', '1'),
    ]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('~')
  })

  it('returns ~ when all exact but no matching profile', () => {
    const loci = [
      makeLocus('aroC', '99'),
      makeLocus('dnaN', '99'),
      makeLocus('hemD', '99'),
    ]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('~')
  })

  it('prioritises - over ~ when both present', () => {
    const loci = [
      makeLocus('aroC', '~1'),
      makeLocus('dnaN', '-'),
      makeLocus('hemD', '1'),
    ]
    const result = callST('test.fasta', 'salmonella', loci, profiles)
    expect(result.st).toBe('-')
  })

  it('includes filename and scheme in result', () => {
    const loci = [
      makeLocus('aroC', '1'),
      makeLocus('dnaN', '1'),
      makeLocus('hemD', '1'),
    ]
    const result = callST('genome.fna', 'ecoli', loci, profiles)
    expect(result.filename).toBe('genome.fna')
    expect(result.scheme).toBe('ecoli')
  })
})
