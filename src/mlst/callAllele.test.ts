import { describe, it, expect } from 'vitest'
import { callAllele } from './callAllele'
import type { AlignmentHit } from './types'

function makeHit(overrides: Partial<AlignmentHit> = {}): AlignmentHit {
  return {
    queryName: 'genome',
    targetName: 'aroC_1',
    identity: 100,
    alignmentLength: 501,
    queryStart: 0,
    queryEnd: 501,
    targetStart: 0,
    targetEnd: 501,
    targetLength: 501,
    ...overrides,
  }
}

describe('callAllele', () => {
  it('returns - when no hits provided', () => {
    const result = callAllele('aroC', [], {})
    expect(result.allele).toBe('-')
    expect(result.identity).toBe(0)
    expect(result.coverage).toBe(0)
    expect(result.bestHit).toBeNull()
  })

  it('returns exact allele for 100% identity and full coverage', () => {
    const hit = makeHit({ targetName: 'aroC_42', identity: 100, alignmentLength: 501 })
    const result = callAllele('aroC', [hit], { aroC_42: 501 })
    expect(result.allele).toBe('42')
    expect(result.identity).toBe(1.0)
    expect(result.coverage).toBe(1.0)
  })

  it('returns ~N for high identity but not exact (novel allele)', () => {
    const hit = makeHit({ targetName: 'aroC_1', identity: 99, alignmentLength: 501 })
    const result = callAllele('aroC', [hit], { aroC_1: 501 })
    expect(result.allele).toBe('~1')
    expect(result.identity).toBe(0.99)
  })

  it('returns - for identity below 95% (tseemann --minid 95)', () => {
    const hit = makeHit({ targetName: 'aroC_1', identity: 94, alignmentLength: 501 })
    const result = callAllele('aroC', [hit], { aroC_1: 501 })
    expect(result.allele).toBe('-')
  })

  it('returns - for coverage below 10% (tseemann --mincov 10)', () => {
    const hit = makeHit({ targetName: 'aroC_1', identity: 100, alignmentLength: 40 })
    const result = callAllele('aroC', [hit], { aroC_1: 501 })
    expect(result.allele).toBe('-')
  })

  it('selects best hit by highest identity', () => {
    const hits = [
      makeHit({ targetName: 'aroC_1', identity: 95, alignmentLength: 501 }),
      makeHit({ targetName: 'aroC_2', identity: 100, alignmentLength: 501 }),
      makeHit({ targetName: 'aroC_3', identity: 98, alignmentLength: 501 }),
    ]
    const lengths = { aroC_1: 501, aroC_2: 501, aroC_3: 501 }
    const result = callAllele('aroC', hits, lengths)
    expect(result.allele).toBe('2')
  })

  it('uses coverage as tiebreaker when identity is equal', () => {
    const hits = [
      makeHit({ targetName: 'aroC_1', identity: 100, alignmentLength: 490 }),
      makeHit({ targetName: 'aroC_2', identity: 100, alignmentLength: 501 }),
    ]
    const lengths = { aroC_1: 501, aroC_2: 501 }
    const result = callAllele('aroC', hits, lengths)
    expect(result.allele).toBe('2')
  })

  it('handles allele names with hyphens', () => {
    const hit = makeHit({ targetName: 'aroC-5', identity: 100, alignmentLength: 501 })
    const result = callAllele('aroC', [hit], { 'aroC-5': 501 })
    expect(result.allele).toBe('5')
  })
})
