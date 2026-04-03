import { Link } from 'react-router-dom'

export function About() {
  return (
    <div className="about-page">
      <section>
        <h2>About MLSTX</h2>
        <p>
          MLSTX is a browser-based MLST typing and phylogenetics tool. Drop in one or more
          bacterial genome assemblies in FASTA format and get sequence type assignments,
          a phylogenetic tree, and assembly QC — all in seconds, with no installation or
          data upload required.
        </p>
        <p>
          Output format matches{' '}
          <a href="https://github.com/tseemann/mlst" target="_blank" rel="noopener noreferrer">
            tseemann/mlst
          </a>{' '}
          (allele notation, ST assignment, JSON export). Scheme detection is fully automatic
          — MLSTX identifies the most likely scheme per genome, so mixed-species uploads work
          correctly.
        </p>
        <div className="privacy-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p>
            No data leaves your machine — all alignment and typing happens client-side using
            WebAssembly. Your genome assemblies remain entirely private.
          </p>
        </div>
      </section>

      <section>
        <h2>Features</h2>
        <ul>
          <li>Auto-detects MLST scheme per genome — no scheme selection needed; mixed-species uploads work</li>
          <li>162+ schemes covering major bacterial pathogens (PubMLST via tseemann/mlst)</li>
          <li>Allele calls match tseemann/mlst notation: exact, ~novel, - no-hit</li>
          <li>Multi-sample batch processing — type any number of assemblies at once</li>
          <li>Phylogenetic tree from concatenated allele alignment (MUSCLE + FastTree, 2+ samples)</li>
          <li>Species-specific assembly QC: N50, contig count, genome size, GC%, Ns/100kbp (thresholds from qualibact)</li>
          <li>CSV and JSON export (tseemann/mlst --full compatible)</li>
          <li>Works offline after first load — scheme databases cached in your browser</li>
        </ul>
      </section>

      <section>
        <h2>What is MLST?</h2>
        <p>
          Multi-Locus Sequence Typing characterises bacterial isolates by the allele sequences
          of several conserved housekeeping genes. Each unique combination of alleles defines
          a sequence type (ST), enabling strain tracking and epidemiological surveillance.
        </p>
        <p>
          MLSTX uses scheme definitions from{' '}
          <a href="https://pubmlst.org" target="_blank" rel="noopener noreferrer">PubMLST</a>,
          covering hundreds of bacterial species. Allele databases are fetched from a CDN and
          cached in your browser — subsequent runs of the same scheme are instant.
        </p>
      </section>

      <section>
        <h2>How it works</h2>
        <p>
          <strong>Scheme detection:</strong> When you drop in a FASTA file, MLSTX maps your
          assembly against a compact detection database (5 alleles per locus, all 162 PubMLST
          schemes) using minimap2 via WebAssembly. Each file is detected independently — so a
          mixed upload of <em>E. coli</em> and <em>S. aureus</em> assemblies is handled correctly.
        </p>
        <p>
          <strong>Allele calling:</strong> The full allele FASTA for the detected scheme is
          fetched from the CDN and BLAST (blastall + formatdb) is used to align each allele
          against the assembly. The best-matching allele number per locus is assigned and looked
          up in the ST profile table. Exact, novel (~), partial (?), and missing (−) calls follow
          the same conventions as tseemann/mlst.
        </p>
        <p>
          <strong>Phylogenetic tree:</strong> For two or more samples, each locus alignment is
          computed with MUSCLE, the per-locus alignments are concatenated into a super-alignment,
          and FastTree infers a maximum-likelihood tree — all via WebAssembly in your browser.
        </p>
      </section>

      <section>
        <h2>Technology</h2>
        <ul>
          <li><strong>BLAST (blastall + formatdb)</strong> — allele alignment, same parameters as tseemann/mlst (via WebAssembly)</li>
          <li><strong>minimap2</strong> — scheme auto-detection: mapping against a compact 162-scheme database (via Aioli/biowasm)</li>
          <li><strong>MUSCLE</strong> — per-locus multiple sequence alignment for phylogenetic tree input (WebAssembly)</li>
          <li><strong>FastTree</strong> — maximum-likelihood phylogenetic tree inference from concatenated allele alignment (WebAssembly)</li>
          <li><strong>PubMLST / tseemann/mlst</strong> — scheme and allele database source</li>
          <li><strong>React + Vite</strong> — frontend framework</li>
          <li><strong>Cloudflare Pages</strong> — global CDN hosting</li>
        </ul>
      </section>

      <section>
        <h2>Citation</h2>
        <p>
          MLSTX incorporates scheme data from PubMLST. The following citation is required
          in any publication that uses MLSTX:
        </p>
        <blockquote className="citation-block">
          This publication made use of the PubMLST website (
          <a href="https://pubmlst.org/" target="_blank" rel="noopener noreferrer">https://pubmlst.org/</a>
          ) developed by Keith Jolley (
          <a href="https://doi.org/10.12688/wellcomeopenres.14826.1" target="_blank" rel="noopener noreferrer">
            Wellcome Open Res. 2018 Sep 24;3:124
          </a>
          ) and sited at the University of Oxford. The development of that website was funded by the Wellcome Trust.
        </blockquote>
        <p>Please also cite this software as:</p>
        <blockquote className="citation-block">
          Alikhan N-F. MLSTX. GitHub.{' '}
          <a href="https://github.com/genomicx/mlstx" target="_blank" rel="noopener noreferrer">
            https://github.com/genomicx/mlstx
          </a>
        </blockquote>
      </section>

      <section>
        <h2>Source Code</h2>
        <p>
          MLSTX is open-source software. Contributions and issues welcome on{' '}
          <a href="https://github.com/genomicx/mlstx" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>.
        </p>
      </section>

      <section>
        <h2>About the Author</h2>
        <h3>Nabil-Fareed Alikhan</h3>
        <p className="about-role">
          Senior Bioinformatician, Centre for Genomic Pathogen Surveillance, University of Oxford
        </p>
        <p>
          Bioinformatics researcher and software developer specialising in microbial genomics.
          Builder of widely used open-source tools, peer-reviewed researcher, and co-host of
          the MicroBinfie podcast.
        </p>
        <div className="about-links">
          <a href="https://www.happykhan.com" target="_blank" rel="noopener noreferrer">happykhan.com</a>
          <a href="https://orcid.org/0000-0002-1243-0767" target="_blank" rel="noopener noreferrer">ORCID: 0000-0002-1243-0767</a>
          <a href="mailto:nabil@happykhan.com">nabil@happykhan.com</a>
          <a href="https://twitter.com/happy_khan" target="_blank" rel="noopener noreferrer">@happy_khan</a>
          <a href="https://mstdn.science/@happykhan" target="_blank" rel="noopener noreferrer">@happykhan@mstdn.science</a>
        </div>
      </section>

      <div style={{ marginTop: '1rem' }}>
        <Link to="/" style={{ color: 'var(--gx-accent)', textDecoration: 'none', fontWeight: 500 }}>
          ← Back to Application
        </Link>
      </div>
    </div>
  )
}
