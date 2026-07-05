# Superseded schema design — do not build against this

This directory contains the **original, more elaborate schema design**
(`00_master.sql` … `08_seed.sql`, ~73 tables) that was drafted early in the
project but **never adopted**. Zero of its distinguishing tables appear
anywhere in the current application code.

**The live, authoritative schema is `migrations/001-004*.sql` at the repo
root** (~62 tables), applied via `scripts/migrate.ts` / `npm run migrate`.
All backend code (`src/**`) talks to that schema through raw parameterized
SQL via `DataSource.query()`.

This folder is kept for historical/design reference only — it captures an
earlier, more ambitious data model (e.g. full Row-Level Security in
`06_security.sql`, which was designed here but never deployed to the live
schema — see `implementation/KNOWN_ISSUES.md` K-15 / `MASTER_TASK_LIST.md`
T-517). Do not run these files against the live database, and do not add new
tables here — any new table (including Phase 2's membership/FORSA
ID/Digital Pass/fraud-record tables) must go into a new numbered
`migrations/*.sql` file at the repo root.

See `implementation/DECISIONS.md` D-007 for the decision to archive rather
than delete, and `implementation/MASTER_TASK_LIST.md` T-108 for the task
this satisfies.
