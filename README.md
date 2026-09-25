# HiQS AI Resolve — Public Catalog Mirror

Machine-readable mirror of the [HiQS AI Resolve](https://resolve.hiqs.ai) catalog,
plus the skill that keeps it stocked. The website is the source of truth for
browsing, resolving, and methodology; this repository is the token-free read path.

## What's here

- `registry/latest.json` — the newest published catalog snapshot (all published records, with a digest for integrity checks)
- `registry/snapshots/` — dated copies of every published snapshot
- `skills/ai-catalog-update/` — the daily catalog-intake skill: grounded discovery, duplicate checks, and schema-valid draft submissions. Drafts only — publishing stays with the human operator.

## Read the catalog without an account

```bash
curl -s "https://resolve.hiqs.ai/api/public/registry?action=list"
```

Returns published records only. Writes require a maintainer token.

## Website

Browse the catalog, run the resolver workbench, and read the methodology and
guarantees at **https://resolve.hiqs.ai**.

## Status

Beta / unsigned / use at your own risk.

## License

Catalog data is CC0 1.0; code and skill content are MIT. See [LICENSE.md](LICENSE.md).
