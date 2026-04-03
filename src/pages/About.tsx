import { Link } from 'react-router-dom'

export function About() {
  return (
    <div className="about-page">
      <section>
        <h2>About MLSTX</h2>
        <p>
          MLSTX is a browser-based Multi-Locus Sequence Typing tool — a WebAssembly clone of{' '}
          <a href="https://github.com/tseemann/mlst" target="_blank" rel="noopener noreferrer">
            tseemann/mlst
          </a>. Drop in one or more bacterial genome assemblies in FASTA format and get
          sequence type assignments in seconds, with no installation or data upload required.
        </p>
        <p>
          Scheme detection is fully automatic. MLSTX identifies the most likely scheme from
          your assembly, runs the allele alignments, and assigns a sequence type — all
          in one step.
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
          <li>Auto-detects MLST scheme from your assembly — no scheme selection needed</li>
          <li>162+ schemes covering major bacterial pathogens (from PubMLST via tseemann/mlst)</li>
          <li>Exact, novel, partial, and missing allele calls with clear visual badging</li>
          <li>Multi-sample batch processing — upload and type any number of assemblies at once</li>
          <li>Neighbour-joining phylogenetic tree from concatenated allele alignment (2+ samples)</li>
          <li>CSV export of all results</li>
          <li>Works offline after first load — scheme databases are cached in your browser</li>
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
          When you drop in a FASTA file, MLSTX maps your assembly against a compact detection
          database (5 alleles per locus, 162 schemes) using minimap2 compiled to WebAssembly.
          The scheme with the most loci hit is selected automatically.
        </p>
        <p>
          The full allele database for the detected scheme is then loaded and each allele is
          aligned against your assembly. The best-matching allele number is assigned per locus,
          and the combination is looked up in the scheme profile to determine the sequence type.
          Exact, novel (~), partial (?), and missing (−) calls follow the same conventions as
          tseemann/mlst.
        </p>
        <p>
          For two or more samples a neighbour-joining tree is built from the concatenated allele
          alignment using FastTree compiled to WebAssembly.
        </p>
      </section>

      <section>
        <h2>Technology</h2>
        <ul>
          <li><strong>minimap2</strong> — sequence alignment (via Aioli/biowasm WebAssembly)</li>
          <li><strong>FastTree</strong> — phylogenetic tree inference (WebAssembly)</li>
          <li><strong>PubMLST / tseemann/mlst</strong> — scheme and allele database source</li>
          <li><strong>React + Vite</strong> — frontend framework</li>
          <li><strong>Cloudflare Pages</strong> — global CDN hosting</li>
        </ul>
      </section>

      <section>
        <h2>Citation</h2>
        <p>
          MLSTX is a browser-based reimplementation of{' '}
          <a href="https://github.com/tseemann/mlst" target="_blank" rel="noopener noreferrer">
            tseemann/mlst
          </a>. If you use MLSTX in your research, please cite:
        </p>
        <blockquote style={{ borderLeft: '4px solid var(--gx-accent)', paddingLeft: '1rem', color: 'var(--gx-text-muted)', fontStyle: 'italic', margin: '0.75rem 0' }}>
          Seemann T. mlst. GitHub. https://github.com/tseemann/mlst
        </blockquote>
        <p>
          Scheme data sourced from{' '}
          <a href="https://pubmlst.org" target="_blank" rel="noopener noreferrer">PubMLST</a>{' '}
          via the tseemann/mlst database.
        </p>
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
