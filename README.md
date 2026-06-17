# HBS Audit Portal - 3 Engineers, Photos, Manager Dashboard

## Deploy
1. Run `sql/schema.sql` in Cloudflare D1.
2. Pages > Get started > Drag and drop your files.
3. Upload a ZIP containing these root items: `index.html`, `functions`, `sql`, `wrangler.toml`, `README.md`.
4. Pages Project > Settings > Bindings > D1 database:
   - Variable name: `DB`
   - Database: `hbsaudits`
5. Redeploy after adding the binding.

## Starter logins
- peter@hbs.local / 1234 - Manager
- compliance@hbs.local / 1234 - Manager
- engineer1@hbs.local / 1234 - Engineer
- engineer2@hbs.local / 1234 - Engineer
- engineer3@hbs.local / 1234 - Engineer

## Notes
Photos are compressed in the browser and stored in D1 as data URLs for a small 3 engineer team. For larger usage use Cloudflare R2.
