import { useRef, useEffect, useCallback, useState } from 'react'
import { downloadText } from '@genomicx/ui'
import type { MLSTResult } from '../mlst/types'

// phylocanvas.gl is loaded from CDN in index.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const phylocanvas: any

// 10 distinct colours for top STs, then grey for "other"
const ST_COLOURS = [
  '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
  '#a65628', '#f781bf', '#999999', '#66c2a5', '#fc8d62',
]
const OTHER_COLOUR = '#cccccc'

function buildStyles(results: MLSTResult[]): Record<string, { fillColour: string }> {
  const stCounts: Record<string, number> = {}
  for (const r of results) {
    stCounts[r.st] = (stCounts[r.st] ?? 0) + 1
  }
  const topSTs = Object.entries(stCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([st]) => st)
  const stColour: Record<string, string> = {}
  topSTs.forEach((st, i) => { stColour[st] = ST_COLOURS[i] ?? OTHER_COLOUR })

  const styles: Record<string, { fillColour: string }> = {}
  for (const r of results) {
    styles[r.filename] = { fillColour: stColour[r.st] ?? OTHER_COLOUR }
  }
  return styles
}

interface PhyloTreeProps {
  newick: string
  alignment?: string
  results?: MLSTResult[]
}

export function PhyloTree({ newick, alignment, results }: PhyloTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const treeRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [showLabels, setShowLabels] = useState(true)
  const [alignLabels, setAlignLabels] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !newick) return

    try {
      if (typeof phylocanvas === 'undefined' || !phylocanvas.PhylocanvasGL) {
        setError('phylocanvas.gl not loaded. Check CDN script in index.html.')
          return
      }

      if (treeRef.current) {
        treeRef.current.destroy()
        treeRef.current = null
      }

      const rect = containerRef.current.getBoundingClientRect()
      const styles = results ? buildStyles(results) : {}
      treeRef.current = new phylocanvas.PhylocanvasGL(
        containerRef.current,
        {
          source: newick,
          size: { width: rect.width || 800, height: 500 },
          padding: 20,
          showLabels: showLabels,
          showLeafLabels: showLabels,
          alignLabels: alignLabels,
          showBranchLengths: false,
          styles,
        }
      )

      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
    }

    return () => {
      if (treeRef.current) {
        treeRef.current.destroy()
        treeRef.current = null
      }
    }
  }, [newick, showLabels, alignLabels, results])

  useEffect(() => {
    const handleResize = () => {
      if (treeRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        treeRef.current.setProps({
          size: { width: rect.width || 800, height: 500 },
        })
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleExportNewick = useCallback(() => {
    downloadText(newick, 'mlstx_tree.nwk')
  }, [newick])

  const handleExportAlignment = useCallback(() => {
    if (!alignment) return
    downloadText(alignment, 'mlstx_alignment.fasta')
  }, [alignment])

  return (
    <section className="tree-section">
      <div className="tree-header">
        <h2>Phylogenetic Tree</h2>
        <div className="results-actions">
          <button
            className={`export-button${showLabels ? ' active' : ''}`}
            onClick={() => setShowLabels((v) => !v)}
          >
            {showLabels ? 'Hide Labels' : 'Show Labels'}
          </button>
          <button
            className={`export-button${alignLabels ? ' active' : ''}`}
            onClick={() => setAlignLabels((v) => !v)}
          >
            Align Labels
          </button>
          <button className="export-button" onClick={handleExportNewick}>
            Export Newick
          </button>
          {alignment && (
            <button className="export-button" onClick={handleExportAlignment}>
              Export MSA
            </button>
          )}
        </div>
      </div>
      {error && <div className="tree-error">{error}</div>}
      <div className="tree-container" ref={containerRef} />
    </section>
  )
}
