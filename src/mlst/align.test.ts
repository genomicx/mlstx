import { describe, it, expect } from 'vitest'
import { parsePAF, parseBlast } from './align'

describe('parsePAF', () => {
  it('returns empty array for empty input', () => {
    expect(parsePAF('')).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(parsePAF('  \n  ')).toEqual([])
  })

  it('parses a single PAF line correctly', () => {
    // PAF: qName qLen qStart qEnd strand tName tLen tStart tEnd nMatch blockLen mapQ
    const line = 'aroC_1\t501\t0\t501\t+\tgenome\t5000000\t100\t601\t501\t501\t60'
    const hits = parsePAF(line)
    expect(hits).toHaveLength(1)
    expect(hits[0]).toEqual({
      targetName: 'aroC_1', // mapped from PAF query (allele name)
      queryName: 'genome', // mapped from PAF target (genome name)
      identity: 100, // 501/501 * 100
      alignmentLength: 501, // qEnd - qStart
      targetStart: 0,
      targetEnd: 501,
      queryStart: 100,
      queryEnd: 601,
      targetLength: 501, // qLen (allele full length)
    })
  })

  it('calculates identity correctly', () => {
    const line = 'aroC_1\t501\t0\t501\t+\tgenome\t5000000\t100\t601\t450\t501\t60'
    const hits = parsePAF(line)
    expect(hits[0].identity).toBeCloseTo(89.82, 1) // 450/501 * 100
  })

  it('calculates alignment length from query span', () => {
    const line = 'aroC_1\t501\t10\t490\t+\tgenome\t5000000\t100\t580\t480\t480\t60'
    const hits = parsePAF(line)
    expect(hits[0].alignmentLength).toBe(480) // 490 - 10
  })

  it('parses multiple PAF lines', () => {
    const lines = [
      'aroC_1\t501\t0\t501\t+\tgenome\t5000000\t100\t601\t501\t501\t60',
      'dnaN_3\t477\t0\t477\t+\tgenome\t5000000\t2000\t2477\t477\t477\t60',
    ].join('\n')
    const hits = parsePAF(lines)
    expect(hits).toHaveLength(2)
    expect(hits[0].targetName).toBe('aroC_1')
    expect(hits[1].targetName).toBe('dnaN_3')
  })

  it('skips lines with fewer than 12 fields', () => {
    const lines = 'aroC_1\t501\t0\t501\t+\tgenome\t5000000\t100\t601\t501\t501'
    const hits = parsePAF(lines)
    expect(hits).toHaveLength(0)
  })

  it('skips lines with invalid numeric fields', () => {
    const line = 'aroC_1\t501\t0\t501\t+\tgenome\t5000000\t100\t601\tNA\t501\t60'
    const hits = parsePAF(line)
    expect(hits).toHaveLength(0)
  })

  it('skips lines with zero blockLen', () => {
    const line = 'aroC_1\t501\t0\t501\t+\tgenome\t5000000\t100\t601\t0\t0\t60'
    const hits = parsePAF(line)
    expect(hits).toHaveLength(0)
  })

  it('handles PAF lines with extra tags after column 12', () => {
    const line =
      'aroC_1\t501\t0\t501\t+\tgenome\t5000000\t100\t601\t501\t501\t60\ttp:A:P\tcm:i:50\tNM:i:0'
    const hits = parsePAF(line)
    expect(hits).toHaveLength(1)
    expect(hits[0].identity).toBe(100)
  })
})

describe('parseBlast', () => {
  // BLAST tabular (-m 8): qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore

  it('returns empty array for empty input', () => {
    expect(parseBlast('')).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(parseBlast('  \n  ')).toEqual([])
  })

  it('skips comment lines', () => {
    const input = '# BLASTN\naroC_1\tcontig1\t100.00\t501\t0\t0\t1\t501\t100\t600\t0\t950'
    const hits = parseBlast(input)
    expect(hits).toHaveLength(1)
  })

  it('parses a single BLAST line correctly', () => {
    const line = 'adk_1\tcontig1\t100.00\t477\t0\t0\t1\t477\t12345\t12821\t0.0\t880'
    const hits = parseBlast(line)
    expect(hits).toHaveLength(1)
    expect(hits[0].targetName).toBe('adk_1')
    expect(hits[0].queryName).toBe('contig1')
    expect(hits[0].identity).toBe(100)
    expect(hits[0].alignmentLength).toBe(477) // qend - qstart + 1 = 477 - 1 + 1
    expect(hits[0].targetStart).toBe(0)       // qstart - 1 = 0
    expect(hits[0].targetEnd).toBe(477)       // qend
    expect(hits[0].queryStart).toBe(12344)    // sstart - 1
    expect(hits[0].queryEnd).toBe(12821)      // send
  })

  it('calculates identity correctly for partial match', () => {
    const line = 'aroC_1\tcontig1\t97.50\t480\t12\t0\t1\t480\t200\t679\t1e-150\t850'
    const hits = parseBlast(line)
    expect(hits[0].identity).toBe(97.5)
  })

  it('handles reverse-strand hits (sstart > send)', () => {
    const line = 'adk_1\tcontig1\t100.00\t477\t0\t0\t1\t477\t12821\t12345\t0.0\t880'
    const hits = parseBlast(line)
    expect(hits).toHaveLength(1)
    expect(hits[0].queryStart).toBe(12344)  // min(sstart,send) - 1
    expect(hits[0].queryEnd).toBe(12821)    // max(sstart,send)
  })

  it('parses multiple BLAST lines', () => {
    const lines = [
      'adk_1\tcontig1\t100.00\t477\t0\t0\t1\t477\t100\t576\t0.0\t880',
      'fumC_3\tcontig1\t99.00\t465\t5\t0\t1\t465\t1000\t1464\t0.0\t850',
    ].join('\n')
    const hits = parseBlast(lines)
    expect(hits).toHaveLength(2)
    expect(hits[0].targetName).toBe('adk_1')
    expect(hits[1].targetName).toBe('fumC_3')
  })

  it('skips lines with fewer than 12 fields', () => {
    const line = 'adk_1\tcontig1\t100.00\t477\t0\t0\t1\t477\t100\t576\t0.0'
    expect(parseBlast(line)).toHaveLength(0)
  })

  it('skips lines with zero alignment length', () => {
    const line = 'adk_1\tcontig1\t100.00\t0\t0\t0\t1\t1\t100\t100\t0.0\t0'
    expect(parseBlast(line)).toHaveLength(0)
  })
})
