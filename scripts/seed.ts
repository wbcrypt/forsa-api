/**
 * FORSA OS — Reference Data Seed
 * Seeds: permissions, document_types, referral_sources, notification_templates
 * Safe to re-run (idempotent — uses ON CONFLICT DO NOTHING).
 *
 *   ts-node scripts/seed.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const ds = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  username: process.env.DB_MIGRATION_USER,
  password: process.env.DB_MIGRATION_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});

const PERMISSIONS = [
  // Auth
  ['user.create','users','create','Create user accounts',false],
  ['user.view','users','view','View user list and profiles',false],
  ['user.edit','users','edit','Edit user details',false],
  ['user.deactivate','users','deactivate','Deactivate user accounts',true],
  ['user.role.assign','users','role_assign','Assign/revoke roles',true],
  ['user.view_pii','users','view_pii','View raw PII (national IDs etc.)',true],
  // Policy
  ['policy.view','policy','view','View policy definitions and history',false],
  ['policy.create','policy','create','Create policy versions',true],
  ['policy.approve','policy','approve','Approve policy versions',true],
  // Universities
  ['university.view','universities','view','View university data',false],
  ['university.create','universities','create','Create universities',false],
  ['university.edit','universities','edit','Edit university details',false],
  ['university.agreement.create','universities','agreement_create','Create university agreements',true],
  ['university.agreement.approve','universities','agreement_approve','Approve university agreements',true],
  // Partners
  ['partner.view','partners','view','View partner data',false],
  ['partner.create','partners','create','Create partners',false],
  ['partner.edit','partners','edit','Edit partner details',false],
  ['partner.commission.approve','partners','commission_approve','Approve commissions',true],
  // Students
  ['student.view','students','view','View student data',false],
  ['student.create','students','create','Create students',false],
  ['student.edit','students','edit','Edit student details',false],
  ['student.view_pii','students','view_pii','View student PII',true],
  // Membership (Phase 2 — Membership Request -> Bronze, T-203/T-204)
  ['membership.view','membership','view','View membership requests',false],
  ['membership.approve','membership','approve','Approve/reject membership requests, issuing Bronze membership',true],
  // Applications
  ['application.view','applications','view','View applications',false],
  ['application.create','applications','create','Create applications',false],
  ['application.edit','applications','edit','Edit applications',false],
  ['application.assign','applications','assign','Assign applications',false],
  ['application.appeal','applications','appeal','Submit appeal',false],
  // Pipeline
  ['pipeline.run','pipeline','run','Start pipeline runs',true],
  ['pipeline.view','pipeline','view','View pipeline runs and traces',false],
  ['pipeline.review','pipeline','review','Submit human decisions',true],
  // Score
  ['score.view','score','view','View FORSA scores',false],
  ['score.record','score','record','Record score events',true],
  ['score.correct','score','correct','Create corrective events',true],
  ['score.reconcile','score','reconcile','Trigger reconciliation',true],
  // Documents
  ['document.view','documents','view','View documents',false],
  ['document.upload','documents','upload','Upload documents',false],
  ['document.review','documents','review','Verify/reject documents',false],
  // Contracts
  ['contract.view','contracts','view','View contracts',false],
  ['contract.generate','contracts','generate','Generate contracts',true],
  ['contract.send','contracts','send','Send contracts for signature',true],
  ['contract.sign','contracts','sign','Record signatures',true],
  // Payments
  ['payment.view','payments','view','View payments and schedules',false],
  ['payment.create','payments','create','Generate payment schedules',true],
  ['payment.record','payments','record','Record payments',true],
  ['payment.reverse','payments','reverse','Reverse payments',true],
  // Collections
  ['collections.view','collections','view','View collections dashboard',false],
  ['collections.log','collections','log','Log contact attempts',false],
  // Execution
  ['execution.submit','execution','submit','Submit to DEE',true],
  ['execution.view','execution','view','View execution ledger',false],
  // Reports
  ['report.ceo','reports','ceo','CEO dashboard',false],
  ['report.finance','reports','finance','Finance dashboard',false],
  ['report.sales','reports','sales','Sales dashboard',false],
  ['report.collections','reports','collections','Collections report',false],
  ['report.partners','reports','partners','Partner report',false],
  ['report.audit','reports','audit','Audit log report',true],
  // Exceptional events
  ['exceptional_event.view','exceptional_events','view','View exceptional events',false],
  ['exceptional_event.open','exceptional_events','open','Open exceptional events',true],
];

const DOCUMENT_TYPES = [
  ['national_id','National ID Card','identity','Required for all students',true],
  ['passport','Passport','identity','Alternative to national ID',true],
  ['bac_diploma','Baccalaureate Diploma','academic','High school diploma',true],
  ['university_acceptance','University Acceptance Letter','academic','Admission letter',true],
  ['enrollment_certificate','Enrollment Certificate','academic','Proof of enrollment',false],
  ['transcript','Academic Transcript','academic','Previous grades',false],
  ['income_proof','Income Proof','financial','Guarantor income evidence',true],
  ['tax_return','Tax Return','financial','Last 2 years tax returns',false],
  ['bank_statement','Bank Statement','financial','3 months bank statements',false],
  ['employment_contract','Employment Contract','financial','Guarantor employment contract',false],
  ['guarantor_id','Guarantor National ID','identity','Guarantor identification',true],
  ['residency_proof','Residency Proof','identity','Proof of address',false],
  ['payment_receipt','Payment Receipt','financial','Bank transfer or cash deposit receipt uploaded by a student or guarantor (T-111)',false],
  ['birth_certificate','Birth Certificate','identity','Student birth certificate',false],
  ['medical_certificate','Medical Certificate','health','For medical withdrawals only',false],
];

const REFERRAL_SOURCES = [
  ['direct_website','Direct Website','online'],
  ['google_ads','Google Ads','online'],
  ['facebook_ads','Facebook Ads','social'],
  ['instagram','Instagram','social'],
  ['linkedin','LinkedIn','social'],
  ['partner_referral','Partner Referral','partner'],
  ['university_fair','University Fair','event'],
  ['existing_student','Existing Student','referral'],
  ['staff_referral','Staff Referral','referral'],
  ['radio_tv','Radio / TV','traditional'],
  ['newspaper','Newspaper','traditional'],
  ['walk_in','Walk-In','offline'],
  ['phone_call','Phone Call','offline'],
  ['other','Other','other'],
];

const NOTIFICATION_TEMPLATES = [
  ['application_created','email','New Application Received','Application Created - {{studentName}}',
   '<p>Dear {{studentName}},</p><p>Your application has been received. Reference: {{applicationId}}</p>',true],
  ['document_requested','email','Documents Required','Action Required: Documents for {{programName}}',
   '<p>Dear {{studentName}},</p><p>Please upload the following documents: {{missingDocuments}}</p>',true],
  ['application_approved','email','Application Approved','🎉 Your Application is Approved',
   '<p>Dear {{studentName}},</p><p>Congratulations! Your application for {{programName}} at {{universityName}} has been approved at Level {{approvedLevel}}.</p>',true],
  ['application_rejected','email','Application Update','Update on Your Application',
   '<p>Dear {{studentName}},</p><p>We regret to inform you that your application could not be approved at this time. Reason: {{rejectionReason}}</p>',true],
  ['payment_due_soon','email','Payment Reminder','Payment Due in {{daysUntilDue}} Days',
   '<p>Dear {{studentName}},</p><p>Your payment of {{amount}} {{currency}} is due on {{dueDate}}.</p>',true],
  ['payment_overdue','email','Payment Overdue','Overdue Payment Notice',
   '<p>Dear {{studentName}},</p><p>Your payment of {{amount}} {{currency}} was due on {{dueDate}} and is now overdue.</p>',true],
  ['payment_confirmed','email','Payment Confirmed','Payment Received',
   '<p>Dear {{studentName}},</p><p>Your payment of {{amount}} {{currency}} has been received. Reference: {{paymentReference}}</p>',true],
  ['contract_ready','email','Contract Ready for Signature','Please Sign Your Financing Contract',
   '<p>Dear {{studentName}},</p><p>Your financing contract is ready for your signature.</p>',true],
  // Phase 2 — Membership Request -> Bronze (T-204)
  ['membership_approved','email','Membership Approved — Set Your Password','🎉 Welcome to FORSA — Set Your Password',
   '<p>Dear {{studentName}},</p><p>Your FORSA membership request has been approved! You are now a Bronze member.</p><p>Your FORSA ID: <strong>{{forsaId}}</strong></p><p>Set your password to access your account: <a href="{{setPasswordUrl}}">{{setPasswordUrl}}</a></p><p>This link expires in 48 hours.</p>',true],
];

async function main() {
  await ds.initialize();
  console.log('Connected. Seeding reference data...');

  // Permissions
  for (const [code, module, action, desc, isHighImpact] of PERMISSIONS) {
    await ds.query(
      `INSERT INTO permissions (code, module, action, description, is_high_impact)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (code) DO NOTHING`,
      [code, module, action, desc, isHighImpact],
    );
  }
  console.log(`✓ ${PERMISSIONS.length} permissions`);

  // Document types
  for (const [code, name, cat, desc, req] of DOCUMENT_TYPES) {
    await ds.query(
      `INSERT INTO document_types (code, display_name, category, description, is_required, is_active)
       VALUES ($1,$2,$3,$4,$5,true)
       ON CONFLICT (code) DO NOTHING`,
      [code, name, cat, desc, req],
    );
  }
  console.log(`✓ ${DOCUMENT_TYPES.length} document types`);

  // Referral sources
  for (const [code, name, channel] of REFERRAL_SOURCES) {
    await ds.query(
      `INSERT INTO referral_sources (code, display_name, channel, is_active)
       VALUES ($1,$2,$3,true)
       ON CONFLICT (code) DO NOTHING`,
      [code, name, channel],
    );
  }
  console.log(`✓ ${REFERRAL_SOURCES.length} referral sources`);

  // Notification templates
  for (const [code, channel, name, subject, body, active] of NOTIFICATION_TEMPLATES) {
    await ds.query(
      `INSERT INTO notification_templates (code, channel, name, subject_template, body_template, is_active)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (code, channel) DO NOTHING`,
      [code, channel, name, subject, body, active],
    );
  }
  console.log(`✓ ${NOTIFICATION_TEMPLATES.length} notification templates`);

  await ds.destroy();
  console.log('\nReference data seed complete.');
}

main().catch(err => { console.error(err); process.exit(1); });
