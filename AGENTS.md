# Immotracker Agent Guidelines & Rules

## 1. Git & Deployment Workflow (STRICT REQUIREMENT)
- **Localhost First:** All changes, bug fixes, UI adjustments, and new features must **first be run, tested, and demonstrated on localhost** (`http://localhost:3000`).
- **No Automatic Pushing:** **NEVER** run `git push` automatically or without the user's explicit consent.
- **Explicit User Approval Required:** Only after:
  1. The changes are verified on localhost,
  2. The user has reviewed the result, and
  3. The user explicitly says "OK", "Freigabe", "Push to GitHub", or similar,
  may commits be pushed to GitHub (`origin/main` or any remote).
- **Rationale:** Pushing unverified or in-progress changes breaks running production/deployed instances of the tool.
