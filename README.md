# MLSTX

> Browser-based Multi-Locus Sequence Typing — no server required.

MLSTX is a WebAssembly clone of [tseemann/mlst](https://github.com/tseemann/mlst). Drop in one or more bacterial genome assemblies in FASTA format and get sequence type assignments in seconds. Scheme detection is fully automatic — MLSTX identifies the most likely scheme from your assembly, runs the allele alignments, and assigns a sequence type, all in one step. No installation or data upload required.

## Features

- Auto-detects MLST scheme from your assembly — no scheme selection needed
- 162+ schemes covering major bacterial pathogens (from PubMLST via tseemann/mlst)
- Exact, novel, partial, and missing allele calls with clear visual badging
- Multi-sample batch processing — upload and type any number of assemblies at once
- Neighbour-joining phylogenetic tree from concatenated allele alignment (2+ samples)
- CSV export of all results
- Works offline after first load — scheme databases are cached in your browser

## Tech Stack

- **minimap2** — sequence alignment (via Aioli/biowasm WebAssembly)
- **FastTree** — phylogenetic tree inference (WebAssembly)
- **React + Vite** — frontend framework
- **Cloudflare Pages** — global CDN hosting

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Running Tests

```bash
npm test           # unit tests
npm run test:e2e   # end-to-end tests (requires build first)
```

## Contributing

Contributions welcome. Please open an issue first to discuss changes.

## License

GPL-3.0 — see [LICENSE](LICENSE)
