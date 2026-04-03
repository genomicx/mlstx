export function About() {
  return (
    <div className="about-page">
      <section>
        <h2>About mlstx</h2>
        <p>
          mlstx is a browser-based Multi-Locus Sequence Typing (MLST) tool. It
          uses minimap2 compiled to WebAssembly via{' '}
          <a href="https://biowasm.com" target="_blank" rel="noopener noreferrer">
            Aioli/biowasm
          </a>{' '}
          to align alleles against bacterial genomes entirely in your browser.
          Upload genome assemblies in FASTA format, select an MLST scheme, and
          get sequence type assignments in seconds.
        </p>
        <div className="privacy-note">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <p>
            No data leaves your machine — all processing happens client-side.
            Upload your genome assemblies, select an MLST scheme, and get
            sequence type assignments in seconds.
          </p>
        </div>
      </section>

      <section>
        <h2>What is MLST?</h2>
        <p>
          Multi-Locus Sequence Typing (MLST) is a molecular typing method that
          characterises bacterial isolates using allele sequences from several
          housekeeping genes. Each unique combination of alleles defines a
          sequence type (ST), enabling strain tracking and epidemiological
          studies.
        </p>
        <p>
          mlstx uses MLST scheme definitions from{' '}
          <a href="https://pubmlst.org" target="_blank" rel="noopener noreferrer">
            PubMLST
          </a>
          , covering hundreds of bacterial species. Schemes are fetched and
          cached in your browser, so subsequent analyses run offline.
        </p>
      </section>

      <section>
        <h2>How it works</h2>
        <p>
          mlstx loads the allele sequences for your chosen scheme, then uses
          minimap2 (via WebAssembly) to align each allele against your genome
          assemblies. Hits are scored and the best-matching allele number is
          assigned per locus. When all loci are assigned, the combination is
          looked up in the scheme profile to determine the sequence type.
        </p>
        <p>
          For two or more samples, you can also build a neighbour-joining
          phylogenetic tree from the concatenated allele alignment using FastTree
          compiled to WebAssembly.
        </p>
      </section>

      <section>
        <h2>About the Author</h2>
        <h3>Nabil-Fareed Alikhan</h3>
        <p className="about-role">
          Senior Bioinformatician, Centre for Genomic Pathogen Surveillance,
          University of Oxford
        </p>
        <p>
          Bioinformatics researcher and software developer specialising in
          microbial genomics. Builder of widely used open-source tools,
          peer-reviewed researcher, and co-host of the MicroBinfie podcast.
        </p>
        <div className="about-links">
          <a
            href="https://www.happykhan.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            happykhan.com
          </a>
          <a
            href="https://orcid.org/0000-0002-1243-0767"
            target="_blank"
            rel="noopener noreferrer"
          >
            ORCID: 0000-0002-1243-0767
          </a>
          <a href="mailto:nabil@happykhan.com">nabil@happykhan.com</a>
          <a
            href="https://twitter.com/happy_khan"
            target="_blank"
            rel="noopener noreferrer"
          >
            Twitter: @happy_khan
          </a>
          <a
            href="https://mstdn.science/@happykhan"
            target="_blank"
            rel="noopener noreferrer"
          >
            Mastodon: @happykhan@mstdn.science
          </a>
        </div>
      </section>
    </div>
  )
}
