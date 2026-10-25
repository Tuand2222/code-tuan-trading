# Project rules

- Scope: preserve Classic/Legacy and the existing backend. The unified V6 application is `v6/index.html`, one HTML file with Tailwind CDN, Chart.js CDN, Inter and JetBrains Mono. Do not add application libraries.
- Use `v6/docs/02_BLUEPRINT_HOP_NHAT.md` and `v6/docs/04_PDF_DOI_CHIEU_VA_KIEM_TRA_V9.md`. Keep retained DOM, Vietnamese labels and styles; document required exceptions.
- One trade ledger, one cashflow ledger, one RiskMath shared with the generated Worker, one RiskStore. No duplicate IDs, named functions, override wrappers or copied math engines.
- Add a numerical regression test before changing a financial formula. Never fabricate missing risk, fees, statistics or historical data. Keep migrations/restores non-destructive and preserve legacy keys.
- Run `npm run verify`, `npm run build`, and `npm run e2e` in `v6` before pushing a PR. Run root validation when backend/build integration changes. Record actual results and limits in the report.
- Use a feature branch and PR. Follow CONTRIBUTING.md: no direct main commits, force-pushes or merge without human approval. Never commit credentials or real journals. Preserve Site identity and audience when deploying an authorized update.
