import { useState, useEffect, useCallback, useRef } from 'react'
import { Routes, Route } from 'react-router-dom'
import { NavBar, AppFooter, LogConsole, FileUpload, ProgressBar } from '@genomicx/ui'
import { SchemeSelector } from './components/SchemeSelector'
import { ResultsTable, exportCSV, exportJSON } from './components/ResultsTable'
import { PhyloTree } from './components/PhyloTree'
import { QCPanel } from './components/QCPanel'
import { About } from './pages/About'
import { fetchSchemeList, loadSchemeData } from './mlst/loadScheme'
import { parseFastaFile } from './mlst/parseFasta'
import { runMLST } from './mlst/align'
import { buildTree } from './mlst/buildTree'
import { detectScheme } from './mlst/autoDetect'
import { computeStats } from './mlst/assemblyStats'
import { runQC } from './mlst/qualibact'
import type { MLSTResult, SchemeData } from './mlst/types'
import type { AssemblyStats } from './mlst/assemblyStats'
import type { QCResult } from './mlst/qualibact'
import { APP_VERSION } from './lib/version'
import './App.css'

function AnalysisPage() {
  const [schemes, setSchemes] = useState<string[]>([])
  const [schemesLoading, setSchemesLoading] = useState(true)
  const [selectedScheme, setSelectedScheme] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const [progressPct, setProgressPct] = useState(0)
  const [results, setResults] = useState<MLSTResult[]>([])
  const [loci, setLoci] = useState<string[]>([])
  const [schemeData, setSchemeData] = useState<SchemeData | null>(null)
  const [error, setError] = useState('')
  const [detectedScheme, setDetectedScheme] = useState('')
  const [qcResults, setQcResults] = useState<QCResult[]>([])
  const [statsMap, setStatsMap] = useState<Record<string, AssemblyStats>>({})

  // Tree state
  const [newick, setNewick] = useState('')
  const [alignment, setAlignment] = useState('')
  const [treeBuilding, setTreeBuilding] = useState(false)
  const [treeProgress, setTreeProgress] = useState('')
  const [treeProgressPct, setTreeProgressPct] = useState(0)
  const [treeError, setTreeError] = useState('')
  const [logLines, setLogLines] = useState<string[]>([])

  // Track whether scheme was manually overridden
  const manualSchemeRef = useRef('')

  useEffect(() => {
    fetchSchemeList()
      .then((list) => {
        setSchemes(list)
        setSchemesLoading(false)
      })
      .catch((err) => {
        setError(`Failed to load schemes: ${err.message}`)
        setSchemesLoading(false)
      })
  }, [])

  const runWithScheme = useCallback(async (uploadedFiles: File[], scheme: string) => {
    setRunning(true)
    setError('')
    setResults([])
    setNewick('')
    setAlignment('')
    setTreeError('')
    setLogLines([])
    setQcResults([])
    setStatsMap({})
    setProgress('Loading scheme data...')
    setProgressPct(0)

    try {
      const data = await loadSchemeData(scheme)
      setSchemeData(data)
      setLoci(data.scheme.loci)

      setProgress('Parsing FASTA files...')
      const parsedFiles = await Promise.all(uploadedFiles.map(parseFastaFile))

      const mlstResults = await runMLST(parsedFiles, data, (msg, pct) => {
        setProgress(msg)
        setProgressPct(pct)
      })

      setResults(mlstResults)

      // Compute assembly stats + QC in background
      const newStatsMap: Record<string, AssemblyStats> = {}
      for (const pf of parsedFiles) {
        newStatsMap[pf.filename] = computeStats(pf)
      }
      setStatsMap(newStatsMap)

      const qcs = await Promise.all(
        mlstResults.map((r) => runQC(newStatsMap[r.filename], r.scheme)),
      )
      setQcResults(qcs)
      setProgress('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [])

  /** Run MLST per-file with independent scheme detection (tseemann/mlst style). */
  const runPerFile = useCallback(async (uploadedFiles: File[]) => {
    setRunning(true)
    setError('')
    setResults([])
    setNewick('')
    setAlignment('')
    setTreeError('')
    setLogLines([])
    setSchemeData(null)
    setLoci([])
    setQcResults([])
    setStatsMap({})

    const allResults: MLSTResult[] = []
    let combinedLoci: string[] = []
    const newStatsMap: Record<string, AssemblyStats> = {}
    const allQc: QCResult[] = []

    try {
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i]
        const filePrefix = `[${i + 1}/${uploadedFiles.length}] ${file.name}`

        setProgress(`${filePrefix}: detecting scheme...`)
        setProgressPct((i / uploadedFiles.length) * 100)

        const text = await file.text()
        const detected = await detectScheme(text, (msg) =>
          setProgress(`${filePrefix}: ${msg}`),
        )

        if (detected.length === 0) {
          setError(`${file.name}: Could not detect MLST scheme — no matches found. Select a scheme manually.`)
          setRunning(false)
          return
        }

        const scheme = detected[0].scheme
        if (i === 0) {
          setDetectedScheme(scheme)
          setSelectedScheme(scheme)
        }

        setProgress(`${filePrefix}: loading scheme ${scheme}...`)
        const data = await loadSchemeData(scheme)

        // Accumulate loci (may differ between files/schemes)
        for (const locus of data.scheme.loci) {
          if (!combinedLoci.includes(locus)) combinedLoci.push(locus)
        }

        const parsed = await parseFastaFile(file)
        const fileResults = await runMLST([parsed], data, (msg, pct) => {
          const overallPct = ((i + pct / 100) / uploadedFiles.length) * 100
          setProgress(msg)
          setProgressPct(overallPct)
        })

        allResults.push(...fileResults)
        setResults([...allResults])

        // Compute assembly stats + QC for this file
        const stats = computeStats(parsed)
        newStatsMap[parsed.filename] = stats
        setStatsMap({ ...newStatsMap })

        const qc = await runQC(stats, scheme)
        allQc.push(qc)
        setQcResults([...allQc])

        // Keep the last scheme's data for tree building
        setSchemeData(data)
        setLoci(combinedLoci)
      }

      setProgress('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFilesChange = useCallback(async (newFiles: File[]) => {
    setFiles(newFiles)
    if (newFiles.length === 0) return

    // Reset results and tree
    setResults([])
    setNewick('')
    setAlignment('')
    setTreeError('')
    setLogLines([])
    setError('')
    setDetectedScheme('')
    setQcResults([])
    setStatsMap({})

    const override = manualSchemeRef.current
    if (override) {
      // User pre-selected a scheme — apply to all files
      await runWithScheme(newFiles, override)
      return
    }

    // Auto-detect per file (tseemann/mlst style: each genome gets its own scheme)
    await runPerFile(newFiles)
  }, [runWithScheme, runPerFile])

  const handleSchemeChange = useCallback((scheme: string) => {
    setSelectedScheme(scheme)
    manualSchemeRef.current = scheme
  }, [])

  const handleRun = useCallback(async () => {
    if (files.length === 0 || !selectedScheme) return
    await runWithScheme(files, selectedScheme)
  }, [files, selectedScheme, runWithScheme])

  const handleBuildTree = useCallback(async () => {
    if (!schemeData || results.length < 2) return

    setTreeBuilding(true)
    setTreeError('')
    setNewick('')
    setAlignment('')
    setLogLines([])

    try {
      const result = await buildTree(
        results,
        schemeData,
        (msg, pct) => {
          setTreeProgress(msg)
          setTreeProgressPct(pct)
        },
        (msg) => {
          setLogLines((prev) => [...prev, msg])
        },
      )
      setNewick(result.newick)
      setAlignment(result.alignment)
      setTreeProgress('')
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : String(err))
    } finally {
      setTreeBuilding(false)
    }
  }, [results, schemeData])

  const showRunButton = files.length > 0 && selectedScheme !== '' && !running

  return (
    <>
      <div className="controls">
        <FileUpload
          files={files}
          onFilesChange={handleFilesChange}
          disabled={running}
        />
        <div className="scheme-section">
          <SchemeSelector
            schemes={schemes}
            selected={selectedScheme}
            onSelect={handleSchemeChange}
            disabled={running}
            loading={schemesLoading}
            label={detectedScheme ? `Scheme (auto-detected: ${detectedScheme}):` : 'Scheme (optional override):'}
          />
          {showRunButton && (
            <button
              className="run-button"
              onClick={handleRun}
            >
              {results.length > 0 ? 'Rerun MLST' : 'Run MLST'}
            </button>
          )}
        </div>
      </div>

      {running && (
        <section className="progress" aria-live="polite">
          <ProgressBar value={progressPct} label={progress} />
        </section>
      )}

      {error && (
        <section className="error" role="alert">
          <p>{error}</p>
        </section>
      )}

      {results.length > 0 && (
        <section className="results">
          <div className="results-header">
            <h2>Results</h2>
            <div className="results-actions">
              <button
                className="export-button"
                onClick={() => exportCSV(results, loci)}
              >
                Export CSV
              </button>
              <button
                className="export-button"
                onClick={() => exportJSON(results)}
              >
                Export JSON
              </button>
              {results.length >= 2 && (
                <button
                  className="tree-button"
                  onClick={handleBuildTree}
                  disabled={treeBuilding}
                >
                  {treeBuilding ? 'Building...' : 'Build Tree'}
                </button>
              )}
            </div>
          </div>
          <ResultsTable results={results} loci={loci} />
        </section>
      )}

      {qcResults.length > 0 && (
        <QCPanel qcResults={qcResults} statsMap={statsMap} />
      )}

      {treeBuilding && (
        <section className="progress" aria-live="polite">
          <ProgressBar value={treeProgressPct} label={treeProgress} />
        </section>
      )}

      {treeError && (
        <section className="error" role="alert">
          <p>{treeError}</p>
        </section>
      )}

      {logLines.length > 0 && <LogConsole logs={logLines} />}

      {newick && <PhyloTree newick={newick} alignment={alignment} />}
    </>
  )
}

function App() {
  useEffect(() => {
    const saved = (localStorage.getItem('gx-theme') as 'light' | 'dark') || 'dark'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  return (
    <div className="app">
      <NavBar
        appName="MLSTX"
        appSubtitle="MLST Typing & Phylogenetics"
        version={APP_VERSION}
        githubUrl="https://github.com/genomicx/mlstx"
        icon={
          <svg className="gx-nav-logo-icon" viewBox="0 0 24 24" fill="none" stroke="var(--gx-accent)" strokeWidth="2">
            {/* Grid/table icon representing allele profiles */}
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
        }
      />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<AnalysisPage />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>

      <AppFooter appName="MLSTX" bugReportEmail="nabil@happykhan.com" bugReportUrl="https://github.com/genomicx/mlstx/issues" />
    </div>
  )
}

export default App
