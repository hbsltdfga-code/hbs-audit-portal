# HBS Audit Portal Phase 2

This version works with the existing D1 tables you have already created:
users, audits, audit_photos, training_records, competency_records and reaudits.

## Upload to GitHub
Replace the current repository files with these root items:
- index.html
- functions/
- sql/
- wrangler.toml
- README.md

Commit to `main`. Cloudflare Pages should automatically redeploy.

## Login
- peter@hbs.local / 1234
- engineer1@hbs.local / 1234
- engineer2@hbs.local / 1234
- engineer3@hbs.local / 1234

## Features added
- Full engineer audit capture form
- Weighted question scoring
- Automatic audit outcome
- Photo upload from iPad/phone
- Automatic training record for scores below 85%
- Automatic 30-day re-audit record for scores below 85%
- Manager dashboard
- Printable PDF audit booklet using browser print/save as PDF
