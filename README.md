# BookStack — QA Engineering Portfolio

A QA process designed, executed and maintained against [BookStack](https://www.bookstackapp.com/),
an open-source documentation platform. This repository holds the QA work only; it is not a fork of
BookStack.

> Status: test environment and pipeline in place, 13 automated checks (login per role, REST API
> authentication, password reset by email, login and reset rate limits) passing against BookStack
> v26.09.3 with seeded users and content. Product discovery is in progress — see
> [docs/01-product-overview.md](docs/01-product-overview.md). No findings to report yet.

## Repository layout

| Path | Contents |
| --- | --- |
| `docker-compose.yml` | Disposable BookStack + MariaDB test environment, with Mailpit capturing all outgoing email |
| `automation/` | Playwright (TypeScript) automated checks |
| `.github/workflows/qa-pipeline.yml` | CI: starts BookStack, runs the automated checks, uploads the report |
| `docs/` | QA documents, starting with the product overview from discovery |

Planned, added as the work is actually done: strategy, test plan, risk assessment, traceability and
summary report in `docs/`, plus `test-cases/` and `bug-reports/`.

## Run it locally

Requires Docker Desktop and Node.js 22+.

```bash
cp .env.example .env
docker compose up -d
cd automation
npm ci
npx playwright install chromium
npm test
```

BookStack is then available at <http://localhost:6875>, and every email it sends appears in the
Mailpit inbox at <http://localhost:8025>. To reset to a clean state:
`docker compose down -v`.

All credentials in `.env.example` are test values for the disposable instance.
