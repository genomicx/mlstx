import type { QCResult, QCStatus } from '../mlst/qualibact'
import type { AssemblyStats } from '../mlst/assemblyStats'
import { StatusBadge } from '@genomicx/ui'

interface QCPanelProps {
  qcResults: QCResult[]
  statsMap: Record<string, AssemblyStats>
  collapsed?: boolean
  onToggle?: () => void
}

export function QCPanel({ qcResults, statsMap, collapsed, onToggle }: QCPanelProps) {
  if (qcResults.length === 0) return null

  return (
    <section className="qc-section">
      <div className="qc-header">
        {onToggle && (
          <button
            className="section-toggle"
            onClick={onToggle}
            aria-label={collapsed ? 'Expand QC' : 'Collapse QC'}
          >
            <span className={`chevron ${!collapsed ? 'open' : ''}`}>›</span>
          </button>
        )}
        <h2>Assembly QC ({qcResults.length})</h2>
      </div>
      {!collapsed && (
        <>
          <p className="qc-source">
            Thresholds from{' '}
            <a href="https://happykhan.github.io/qualibact/" target="_blank" rel="noopener noreferrer">
              qualibact
            </a>{' '}
            — species-specific N50, contig count, genome size, GC%.
          </p>
          <div className="qc-table-container">
            <table className="qc-table">
              <thead>
                <tr>
                  <th>File</th>
                  <th>Species</th>
                  <th>QC</th>
                  <th>N50</th>
                  <th>Contigs</th>
                  <th>Length (Mb)</th>
                  <th>GC %</th>
                  <th>Ns/100kbp</th>
                </tr>
              </thead>
              <tbody>
                {qcResults.map((r) => {
                  const stats = statsMap[r.filename]
                  return (
                    <tr key={r.filename}>
                      <td className="filename-cell">{r.filename}</td>
                      <td className="species-cell">{r.species ?? <span className="no-data">—</span>}</td>
                      <td>
                        <StatusBadge variant={statusVariant(r.overall)}>
                          {r.overall}
                        </StatusBadge>
                      </td>
                      <td><StatCell value={stats?.n50} field="N50" checks={r.checks} /></td>
                      <td><StatCell value={stats?.contigCount} field="# contigs" checks={r.checks} /></td>
                      <td><StatCell value={stats ? stats.totalLength / 1e6 : undefined} field="Genome size (bp)" checks={r.checks} fmt={(v) => v.toFixed(2)} /></td>
                      <td><StatCell value={stats?.gcPercent} field="GC (%)" checks={r.checks} fmt={(v) => v.toFixed(1)} /></td>
                      <td><StatCell value={stats?.nsPer100k} field="" checks={[]} fmt={(v) => v.toFixed(0)} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

function statusVariant(s: QCStatus): 'success' | 'warning' | 'muted' {
  if (s === 'pass') return 'success'
  if (s === 'fail') return 'warning'
  return 'muted'
}

interface StatCellProps {
  value: number | undefined
  field: string
  checks: QCResult['checks']
  fmt?: (v: number) => string
}

function StatCell({ value, field, checks, fmt }: StatCellProps) {
  if (value === undefined) return <span className="no-data">—</span>

  const relevant = checks.filter((c) => c.field === field)
  const hasFail = relevant.some((c) => c.status === 'fail')
  const tooltipLines = relevant.map((c) => `${c.field} ${c.threshold}`).join('\n')

  const display = fmt ? fmt(value) : value.toLocaleString()
  const cls = hasFail ? 'stat-fail' : 'stat-pass'

  return (
    <span className={cls} title={tooltipLines || undefined}>
      {display}
    </span>
  )
}
