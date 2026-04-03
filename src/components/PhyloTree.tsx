import { useRef, useEffect, useCallback, useState } from 'react'
import { downloadText } from '@genomicx/ui'

// phylocanvas.gl is loaded from CDN in index.html
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const phylocanvas: any

interface PhyloTreeProps {
  newick: string
  alignment?: string
}

export function PhyloTree({ newick, alignment }: PhyloTreeProps) {
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
        console.error('[PhyloTree] phylocanvas global not found')
        return
      }

      if (treeRef.current) {
        treeRef.current.destroy()
        treeRef.current = null
      }

      const rect = containerRef.current.getBoundingClientRect()
      console.log('[PhyloTree] Creating tree, container size:', rect.width, 'x', rect.height)
      console.log('[PhyloTree] Newick (first 100 chars):', newick.slice(0, 100))

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
        }
      )

      console.log('[PhyloTree] Tree created successfully')
      setError(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[PhyloTree] Error creating tree:', err)
      setError(msg)
    }

    return () => {
      if (treeRef.current) {
        treeRef.current.destroy()
        treeRef.current = null
      }
    }
  }, [newick, showLabels, alignLabels])

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
