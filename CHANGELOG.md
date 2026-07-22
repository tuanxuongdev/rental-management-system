# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
and [Conventional Commits](https://www.conventionalcommits.org/).

## [Unreleased]

### Added

- Sprint-01 delivery foundation: meta endpoints (`/v1/meta/version`, `/v1/meta/ping`), readiness checks, structured logging, correlation IDs, platform status page, worker HTTP health, ADR stubs, expanded CI (unit, SCA, secrets, boundaries, container scan), and development deploy workflow.
- Monorepo foundation (`apps/web`, `apps/api`, `apps/worker`, shared packages).
- Prisma schema bootstrap (no domain models).
- Docker Compose for local Postgres/Redis and app containers.
- Git/GitHub community files, Husky, lint-staged, and commitlint.

## [0.0.0] - 2026-07-22

### Added

- Initial repository scaffolding (pre-release foundation).
