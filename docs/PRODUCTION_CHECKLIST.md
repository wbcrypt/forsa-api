# FORSA OS — Production Readiness Checklist

## Infrastructure
- [ ] PostgreSQL 15+ with SSL enabled
- [ ] Redis 7+ with password and TLS
- [ ] S3-compatible storage (AWS S3 / Cloudflare R2 / MinIO) configured
- [ ] SMTP service configured and tested
- [ ] Nginx or reverse proxy configured
- [ ] SSL certificate installed (Let's Encrypt or commercial)
- [ ] Domain DNS pointing to server
- [ ] Firewall: only ports 80, 443, 22 open externally

## Application
- [ ] `NODE_ENV=production`
- [ ] `npm run build` completes without errors
- [ ] `npm run start:prod` starts successfully
- [ ] Health check responds: `GET /api/v1/auth/me` returns 401 (not 500)
- [ ] PM2 or systemd service configured for auto-restart
- [ ] Application runs as non-root user

## Database
- [ ] `migrations/001_initial_schema.sql` executed successfully
- [ ] `npm run seed` executed (reference data)
- [ ] `npm run seed:admin` executed (bootstrap admin)
- [ ] All immutability rules applied (REVOKE UPDATE/DELETE on critical tables)
- [ ] Daily backup job configured
- [ ] Backup restoration tested

## First-Run Validation
- [ ] Login with bootstrap credentials works
- [ ] Tenant ID captured from seed:admin output
- [ ] Password change enforced on first login
- [ ] MFA setup completed for admin account
- [ ] Bootstrap credentials removed from .env
- [ ] Created first operational staff user
- [ ] University created with active agreement
- [ ] Test application created and pipeline run
- [ ] Document upload URL generated and tested
- [ ] Payment schedule generated and tested

## Policy Configuration (required before go-live)
All of these must be created via `POST /api/v1/policy/versions` and approved:

- [ ] `eligibility.age.minimum` (default: 17)
- [ ] `eligibility.score.minimum` (default: 300)
- [ ] `approval.thresholds` (auto/single/dual/executive amounts)
- [ ] `payment.grace_period_days` (default: 7)
- [ ] `payment.concurrent.duration_months` (default: 10)
- [ ] `document.requirements.standard` (array of required document codes)
- [ ] `guarantor.required` (true/false)
- [ ] `score.dimension.weights` (5 dimensions summing to 1.0)
- [ ] `portfolio.concentration.university_max_pct` (e.g., 40)

## Monitoring
- [ ] Application logs flowing to log aggregator
- [ ] Error rate monitoring configured
- [ ] Database performance monitoring active
- [ ] Disk space alerts configured
- [ ] Redis memory alerts configured

---

## Version 2 Enhancements (post-launch)

The following are architecturally ready but not implemented in V1:

1. **Bronze / Silver / Gold Membership** — foundation exists via FORSA Score bands
2. **Student Portal** — public-facing API (`FEATURE_STUDENT_PORTAL=true`)
3. **Partner Portal** — partner self-service dashboard
4. **AI Document Verification** — S3 pipeline → AI OCR validation
5. **WhatsApp Notifications** — Twilio WhatsApp channel
6. **Webhook Integrations** — outbox_events table ready for webhook dispatch
7. **Full TypeORM Migrations** — replace raw SQL migration with versioned TypeORM migrations
8. **Test Suite** — unit and integration tests (Jest scaffolded, tests not written)
9. **Multi-country** — currency, regulatory rules per country code
10. **SMS OTP MFA** — MfaService supports SMS method, needs Twilio integration
