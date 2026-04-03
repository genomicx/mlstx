import { StatusBadge, downloadText } from '@genomicx/ui'
import type { MLSTResult } from '../mlst/types'

interface ResultsTableProps {
  results: MLSTResult[]
  loci: string[]
}

export function ResultsTable({ results, loci }: ResultsTableProps) {
  if (results.length === 0) return null

  return (
    <div className="results-table-container">
      <table className="results-table">
        <thead>
          <tr>
            <th>File</th>
            <th>ST</th>
            {loci.map((l) => (
              <th key={l}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.filename}>
              <td className="filename-cell">{r.filename}</td>
              <td className="st-cell" title={statusLabel(r.st)}>
                <StatusBadge variant={statusVariant(classifyResult(r.st))}>{r.st}</StatusBadge>
              </td>
              {loci.map((l) => {
                const val = r.alleles[l]
                return (
                  <td key={l} className="allele-cell" title={statusLabel(val)}>
                    {val
                      ? <StatusBadge variant={statusVariant(classifyResult(val))}>{val}</StatusBadge>
                      : '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function statusVariant(classification: string): 'success' | 'warning' | 'muted' {
  if (classification === 'exact') return 'success'
  if (classification === 'novel') return 'warning'
  return 'muted'
}

function classifyResult(val: string | undefined): string {
  if (!val) return 'missing'
  if (val === 'no_hit' || val === 'incomplete') return 'nohit'
  if (val === 'novel') return 'novel'
  return 'exact'
}

function statusLabel(val: string | undefined): string {
  if (!val) return 'Missing'
  if (val === 'no_hit') return 'No hit found'
  if (val === 'incomplete') return 'Incomplete — missing loci'
  if (val === 'novel') return 'Novel — above threshold but not exact'
  return `Exact match: ${val}`
}

export function exportCSV(results: MLSTResult[], loci: string[]): void {
  const header = ['File', 'ST', ...loci].join(',')
  const rows = results.map((r) => {
    const alleleValues = loci.map((l) => r.alleles[l] ?? '-')
    return [r.filename, r.st, ...alleleValues].join(',')
  })
  const csv = [header, ...rows].join('\n')

  downloadText(csv, 'mlst_results.csv', 'text/csv')
}
