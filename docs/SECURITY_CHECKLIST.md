# FORSA OS — Security Checklist

## Pre-Launch (must complete ALL before go-live)

### Authentication & Sessions
- [ ] JWT secrets are 64+ bytes of cryptographically random data
- [ ] Access token expiry ≤ 15 minutes
- [ ] Refresh token expiry ≤ 7 days  
- [ ] MFA enforced for all admin/staff accounts (`FEATURE_MFA_REQUIRED=true`)
- [ ] Session cookies are `httpOnly`, `secure`, `sameSite=strict`
- [ ] Rate limiting active: max 5 login attempts per 15 min per IP
- [ ] Account lockout after 5 failed attempts

### Encryption
- [ ] PII_ENCRYPTION_KEY is 32 bytes (64 hex chars), generated with `crypto.randomBytes(32)`
- [ ] MFA_ENCRYPTION_KEY is a **different** 32-byte key
- [ ] Encryption keys are stored in secrets manager (not in version control)
- [ ] Key versions are tracked (`CURRENT_PII_KEY_VERSION`)
- [ ] S3 bucket has server-side encryption enabled (`AES-256`)
- [ ] Database connections use TLS (`DB_SSL=true`)
- [ ] Redis connection uses TLS (`REDIS_TLS=true`)

### Data Protection
- [ ] `national_id_reference` columns contain only encrypted values
- [ ] PII fields never appear in logs
- [ ] Audit logs are append-only (rules enforced at DB level)
- [ ] Financial ledger is append-only
- [ ] Financing decisions are immutable after generation

### Network
- [ ] HTTPS only — HTTP redirects to HTTPS
- [ ] HSTS header enabled with `max-age=63072000`
- [ ] CORS restricted to `FRONTEND_URL` only
- [ ] Swagger/API docs disabled in production (`NODE_ENV=production`)
- [ ] Helmet security headers active
- [ ] API rate limiting active (`THROTTLE_LIMIT=100` per 60s)

### Secrets Management
- [ ] `.env` file is NOT in git (`.gitignore` includes `.env`)
- [ ] `BOOTSTRAP_*` variables removed after first seed
- [ ] Database passwords are 20+ character random strings
- [ ] S3 access keys are IAM-scoped to this bucket only
- [ ] No secrets in application logs

### PostgreSQL Hardening
- [ ] `forsa_app` user cannot UPDATE/DELETE on audit_logs, security_events, financial_ledger, financing_decisions
- [ ] RLS policies active (app sets `app.current_tenant_id` session variable)
- [ ] `forsa_readonly` user used for reporting queries
- [ ] No direct superuser access from application

### S3 / Storage
- [ ] Bucket is **private** (no public access)
- [ ] Signed URLs used for all access (≤ 5 minutes)
- [ ] Document access is logged in `document_access_logs`
- [ ] No S3 pre-signed URL in application logs

### Monitoring
- [ ] Security events table (`security_events`) is monitored
- [ ] Login failure alerts configured for > 3 failures/minute
- [ ] Alert on `PERMISSION_DENIED` severity=high events
- [ ] Alert on `IMMUTABILITY_VIOLATION_ATTEMPT` events
- [ ] Database connection monitoring active

### Operations
- [ ] Backups configured and tested (RTO/RPO defined)
- [ ] Database backup encryption enabled
- [ ] Incident response procedure documented
- [ ] PII data handling agreement in place
- [ ] Log retention policy configured (default: 2555 days audit, 365 security)

---

## Ongoing Security Practices

- **Rotate** JWT secrets every 90 days (coordinate with session invalidation)
- **Rotate** PII encryption keys annually (requires re-encryption of stored values)
- **Review** audit logs weekly for anomalies
- **Review** permission grants quarterly
- **Test** backup restoration every 3 months
- **Update** dependencies monthly (`npm audit`)
