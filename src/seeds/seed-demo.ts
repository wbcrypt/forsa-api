/**
 * FORSA OS — Demo Data Seed
 * Creates realistic demo data for demonstrations, investor pitches, and testing.
 * Run: npx ts-node -r tsconfig-paths/register src/seeds/seed-demo.ts
 */

import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { DataSource } from 'typeorm'
import * as argon2 from 'argon2'

const TENANT_ID = 'be694fc0-789a-4dec-b514-850710469c72'

// ─── Universities ──────────────────────────────────────────────────────────────
const UNIVERSITIES = [
  {
    id: '09d23f50-30d3-43c7-9cd8-46f1d6248e4f',
    name: 'Université de Tunis El Manar',
    code: 'UTM',
    city: 'Tunis',
    programs: [
      'Licence en Informatique',
      'Licence en Mathématiques',
      'Master en Intelligence Artificielle',
      'Licence en Gestion',
      'Ingénierie Civile',
    ],
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'École Nationale d\'Ingénieurs de Tunis',
    code: 'ENIT',
    city: 'Tunis',
    programs: [
      'Génie Informatique',
      'Génie Civil',
      'Génie Électrique',
      'Génie Mécanique',
    ],
  },
  {
    id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    name: 'Institut Supérieur des Sciences Économiques',
    code: 'ISSEC',
    city: 'Sfax',
    programs: [
      'Licence en Finance',
      'Licence en Commerce International',
      'Master en Comptabilité',
    ],
  },
  {
    id: 'c3d4e5f6-a7b8-9012-cdef-345678901234',
    name: 'Université de Sousse',
    code: 'USOU',
    city: 'Sousse',
    programs: [
      'Médecine',
      'Pharmacie',
      'Licence en Droit',
      'Licence en Sciences Politiques',
    ],
  },
]

// ─── Demo Students ─────────────────────────────────────────────────────────────
const STUDENTS = [
  {
    firstName: 'Fatima Zahra',
    lastName: 'Ben Amor',
    email: 'student@forsa.tn',
    phone: '+216 20 123 456',
    city: 'Tunis',
    universityIdx: 0,
    program: 'Licence en Informatique',
    tuition: 3500,
    status: 'active_student',
    aiScore: 84,
    recommendation: 'Gold Candidate',
    paymentsPaid: 4,
    totalPayments: 10,
  },
  {
    firstName: 'Yassine',
    lastName: 'Gharbi',
    email: 'yassine.gharbi@email.tn',
    phone: '+216 25 234 567',
    city: 'Sfax',
    universityIdx: 1,
    program: 'Génie Informatique',
    tuition: 4800,
    status: 'approved_level2',
    aiScore: 78,
    recommendation: 'Silver Candidate',
    paymentsPaid: 1,
    totalPayments: 12,
  },
  {
    firstName: 'Mariem',
    lastName: 'Trabelsi',
    email: 'mariem.trabelsi@email.tn',
    phone: '+216 29 345 678',
    city: 'Tunis',
    universityIdx: 0,
    program: 'Master en Intelligence Artificielle',
    tuition: 6200,
    status: 'approved_level2', // was 'pre_approved' (dead V2 vocabulary, T-213)
    aiScore: 91,
    recommendation: 'Gold Candidate',
    paymentsPaid: 0,
    totalPayments: 0,
  },
  {
    firstName: 'Ahmed',
    lastName: 'Khelil',
    email: 'ahmed.khelil@email.tn',
    phone: '+216 22 456 789',
    city: 'Sousse',
    universityIdx: 3,
    program: 'Médecine',
    tuition: 7500,
    status: 'under_review', // was 'internal_review' (dead V2 vocabulary, T-213)
    aiScore: 72,
    recommendation: 'Silver Candidate',
    paymentsPaid: 0,
    totalPayments: 0,
  },
  {
    firstName: 'Sarra',
    lastName: 'Mansour',
    email: 'sarra.mansour@email.tn',
    phone: '+216 27 567 890',
    city: 'Tunis',
    universityIdx: 2,
    program: 'Licence en Finance',
    tuition: 2800,
    status: 'ai_interview_completed',
    aiScore: 67,
    recommendation: 'Referral Candidate',
    paymentsPaid: 0,
    totalPayments: 0,
  },
  {
    firstName: 'Omar',
    lastName: 'Zouari',
    email: 'omar.zouari@email.tn',
    phone: '+216 24 678 901',
    city: 'Monastir',
    universityIdx: 1,
    program: 'Génie Civil',
    tuition: 4200,
    status: 'contract_signed', // was 'contracts_signed' (dead V2 vocabulary, T-213)
    aiScore: 80,
    recommendation: 'Gold Candidate',
    paymentsPaid: 0,
    totalPayments: 0,
  },
  {
    firstName: 'Rania',
    lastName: 'Belhaj',
    email: 'rania.belhaj@email.tn',
    phone: '+216 23 789 012',
    city: 'Bizerte',
    universityIdx: 0,
    program: 'Licence en Gestion',
    tuition: 2500,
    status: 'new_lead', // was 'applied' (dead V2 vocabulary, T-213)
    aiScore: null,
    recommendation: null,
    paymentsPaid: 0,
    totalPayments: 0,
  },
  {
    firstName: 'Khalil',
    lastName: 'Dridi',
    email: 'khalil.dridi@email.tn',
    phone: '+216 26 890 123',
    city: 'Tunis',
    universityIdx: 0,
    program: 'Licence en Mathématiques',
    tuition: 2200,
    status: 'rejected',
    aiScore: 41,
    recommendation: 'Manual Review',
    paymentsPaid: 0,
    totalPayments: 0,
  },
]

// ─── AI Report templates ───────────────────────────────────────────────────────
function generateAiReport(student: typeof STUDENTS[0], lang: 'fr' | 'ar' | 'en' = 'fr') {
  const score = student.aiScore || 70
  return {
    scores: {
      educational_readiness: Math.min(100, score + Math.floor(Math.random() * 10) - 5),
      financial_readiness: Math.min(100, score + Math.floor(Math.random() * 12) - 6),
      planning_readiness: Math.min(100, score + Math.floor(Math.random() * 8) - 4),
      commitment_readiness: Math.min(100, score + Math.floor(Math.random() * 10) - 5),
      interview_quality: Math.min(100, score + Math.floor(Math.random() * 6) - 3),
      overall_forsa_score: score,
    },
    executive_summary: `${student.firstName} ${student.lastName} demonstrated strong motivation and a clear career vision during the FORSA readiness interview. Their financial situation is stable with a committed guarantor. Their understanding of the monthly payment commitment is solid and realistic.`,
    executive_summary_fr: `${student.firstName} ${student.lastName} a démontré une forte motivation et une vision professionnelle claire lors de l'entretien FORSA. Sa situation financière est stable avec un garant engagé. Sa compréhension de l'engagement mensuel est solide et réaliste.`,
    strengths: [
      'Clear and specific career objectives',
      'Realistic understanding of monthly payment obligations',
      'Strong support network and committed guarantor',
    ],
    concerns: score < 70
      ? ['Backup financial plan needs strengthening', 'Income documentation incomplete']
      : ['No significant concerns identified'],
    risk_flags: score < 50 ? ['Inconsistent employment history'] : [],
    missing_information: score < 65 ? ['Guarantor income documentation pending'] : [],
    recommended_next_steps: [
      'Request official enrollment certificate from university',
      'Schedule activation meeting within 10 business days',
    ],
    recommendation: student.recommendation || 'Silver Candidate',
    interview_language: lang,
    interview_conducted_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
  }
}

// ─── Seed function ─────────────────────────────────────────────────────────────
async function seedDemo() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  const ds = app.get(DataSource)

  console.log('\n🌱 Seeding FORSA demo data...\n')

  // Get admin user id
  const [admin] = await ds.query(
    `SELECT id FROM users WHERE email = 'admin@forsa.tn' AND tenant_id = $1`,
    [TENANT_ID]
  )
  const adminId = admin?.id

  let seededCount = 0

  // Seed universities
  for (const uni of UNIVERSITIES) {
    const existing = await ds.query(
      `SELECT id FROM universities WHERE id = $1`,
      [uni.id]
    )
    if (existing.length === 0) {
      // Phase 3 discovery — this INSERT referenced a "code" column that
      // has never existed on universities (the real column is
      // short_name), so this script failed outright on the second
      // university it tried to seed. Fixed to match the actual schema.
      await ds.query(
        `INSERT INTO universities (id, tenant_id, name, short_name, city, country_code, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'TN', 'active', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`,
        [uni.id, TENANT_ID, uni.name, uni.code, uni.city]
      )
      console.log(`✅ University: ${uni.name}`)

      // Seed programs — also referenced tenant_id/updated_at columns
      // that don't exist on programs (no tenant_id at all; university_id
      // scopes it, and there's no updated_at column).
      for (const program of uni.programs) {
        await ds.query(
          `INSERT INTO programs (university_id, name, status, created_at)
           VALUES ($1, $2, 'active', NOW())
           ON CONFLICT DO NOTHING`,
          [uni.id, program]
        )
      }
      seededCount++
    } else {
      console.log(`⏭  University already exists: ${uni.name}`)
    }
  }

  // Seed partner — Phase 3 discovery — the original lookup/INSERT
  // referenced partners.email and partners.is_founding_partner, neither
  // of which exists on the partners table (no email column at all —
  // partner login identity lives on the linked users row via
  // partners.user_id, per T-224). This also means the printed "Partner:
  // partner@forsa.tn" demo credential in this script's final log never
  // actually worked — no users row was ever created for it. Fixed to
  // create a real users + partners pair, linked, so the credential is
  // real.
  const partnerUserExists = await ds.query(
    `SELECT id FROM users WHERE email = 'partner@forsa.tn' AND tenant_id = $1 LIMIT 1`,
    [TENANT_ID]
  )
  if (partnerUserExists.length === 0) {
    const partnerPasswordHash = await argon2.hash('Partner2026!')
    const [partnerUser] = await ds.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, status, must_change_password, created_at, updated_at)
       VALUES ($1, 'partner@forsa.tn', $2, 'EduLead Tunisia', 'active', false, NOW(), NOW())
       RETURNING id`,
      [TENANT_ID, partnerPasswordHash]
    )
    await ds.query(
      `INSERT INTO partners (tenant_id, name, type, status, country_code, user_id, created_at, updated_at)
       VALUES ($1, 'EduLead Tunisia', 'platform', 'active', 'TN', $2, NOW(), NOW())
       ON CONFLICT DO NOTHING`,
      [TENANT_ID, partnerUser.id]
    )
    console.log(`✅ Partner: EduLead Tunisia (login: partner@forsa.tn / Partner2026!)`)
    seededCount++
  }

  // Phase 3 discovery — this script's final log claimed a working
  // "University: university@forsa.tn / University2026!" demo credential,
  // but no university user account was ever created anywhere in this
  // file — the login never worked. Linked via universities.user_id per
  // T-223.
  const universityUserExists = await ds.query(
    `SELECT id FROM users WHERE email = 'university@forsa.tn' AND tenant_id = $1 LIMIT 1`,
    [TENANT_ID]
  )
  if (universityUserExists.length === 0) {
    const universityPasswordHash = await argon2.hash('University2026!')
    const [universityUser] = await ds.query(
      `INSERT INTO users (tenant_id, email, password_hash, full_name, status, must_change_password, created_at, updated_at)
       VALUES ($1, 'university@forsa.tn', $2, 'Université de Tunis El Manar Admissions', 'active', false, NOW(), NOW())
       RETURNING id`,
      [TENANT_ID, universityPasswordHash]
    )
    await ds.query(
      `UPDATE universities SET user_id = $2 WHERE id = $1 AND tenant_id = $3`,
      [UNIVERSITIES[0].id, universityUser.id, TENANT_ID]
    )
    console.log(`✅ University login linked: ${UNIVERSITIES[0].name} (login: university@forsa.tn / University2026!)`)
    seededCount++
  }

  // Seed students and applications
  for (const s of STUDENTS) {
    const existingStudent = await ds.query(
      `SELECT id FROM students WHERE email = $1 AND tenant_id = $2 LIMIT 1`,
      [s.email, TENANT_ID]
    )

    let studentId: string
    if (existingStudent.length > 0) {
      studentId = existingStudent[0].id
      console.log(`⏭  Student already exists: ${s.firstName} ${s.lastName}`)
    } else {
      // Create student user account
      const passwordHash = await argon2.hash('Demo2026!')
      const [newUser] = await ds.query(
        `INSERT INTO users (tenant_id, email, password_hash, full_name, status, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', false, NOW(), NOW())
         ON CONFLICT (email, tenant_id) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [TENANT_ID, s.email, passwordHash, `${s.firstName} ${s.lastName}`]
      )

      // Create student record. Phase 3 discovery — "phone" and
      // "academic_level" don't exist on students (real column is
      // phone_primary; there's no academic_level at all) — this INSERT
      // failed outright for every student.
      const [newStudent] = await ds.query(
        `INSERT INTO students (tenant_id, user_id, first_name, last_name, email, phone_primary, city, nationality, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'TN', 'active', NOW(), NOW())
         RETURNING id`,
        [TENANT_ID, newUser?.id, s.firstName, s.lastName, s.email, s.phone, s.city]
      )
      studentId = newStudent.id

      // Create application. Phase 3 discovery — "program_name" doesn't
      // exist on applications (real column is program_id, a FK to
      // programs) — this INSERT failed outright for every student.
      // Fixed to look up the actual program row seeded earlier for this
      // university/name pair.
      const uni = UNIVERSITIES[s.universityIdx]
      const aiReport = s.aiScore ? generateAiReport(s) : null
      const langs = ['fr', 'ar', 'en']
      const interviewLang = langs[Math.floor(Math.random() * 3)]
      const [program] = await ds.query(
        `SELECT id FROM programs WHERE university_id = $1 AND name = $2 LIMIT 1`,
        [uni.id, s.program]
      )

      const [newApp] = await ds.query(
        `INSERT INTO applications (
          tenant_id, student_id, university_id, program_id,
          tuition_amount, requested_support_amount, currency,
          academic_year, is_renewal, current_status,
          ai_score_overall, ai_recommendation, ai_report, interview_language,
          lead_date, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $5, 'TND', '2026-2027', false, $6, $7, $8, $9, $10, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days', NOW(), NOW())
         RETURNING id`,
        [
          TENANT_ID, studentId, uni.id, program?.id,
          s.tuition, s.status,
          s.aiScore, s.recommendation,
          aiReport ? JSON.stringify(aiReport) : null,
          interviewLang,
        ]
      )

      // Create payment schedule for active students. Phase 3 discovery —
      // all three INSERTs below referenced columns that don't exist on
      // the real schema (payment_schedules.student_id/start_date/status/
      // updated_at; installments.schedule_id/updated_at, and a missing
      // required grace_due_date; payments.paid_at/recorded_by/
      // updated_at) — this entire block failed outright the moment any
      // student had totalPayments > 0. Rewritten to match the actual
      // schema (payment_schedules scopes via application_id only, no
      // status column; installments requires grace_due_date; payments
      // uses payment_date/received_by).
      if (s.totalPayments > 0 && newApp) {
        const [schedule] = await ds.query(
          `INSERT INTO payment_schedules (tenant_id, application_id, total_amount, currency, installment_count, payment_model, generated_by, created_at)
           VALUES ($1, $2, $3, 'TND', $4, 'concurrent', $5, NOW())
           RETURNING id`,
          [TENANT_ID, newApp.id, s.tuition, s.totalPayments, adminId]
        )

        if (schedule) {
          for (let i = 1; i <= s.totalPayments; i++) {
            const isPaid = i <= s.paymentsPaid
            const [inst] = await ds.query(
              `INSERT INTO installments (tenant_id, payment_schedule_id, sequence_number, due_date, grace_due_date, amount, currency, status, amount_paid, paid_at, created_at)
               VALUES ($1, $2, $3, NOW() + INTERVAL '${i * 30} days', NOW() + INTERVAL '${i * 30 + 7} days', $4, 'TND', $5, $6, $7, NOW())
               RETURNING id`,
              [
                TENANT_ID, schedule.id, i, (s.tuition / s.totalPayments).toFixed(2), isPaid ? 'paid' : 'pending',
                isPaid ? (s.tuition / s.totalPayments).toFixed(2) : 0,
                isPaid ? new Date(Date.now() - (s.paymentsPaid - i + 1) * 30 * 24 * 60 * 60 * 1000) : null,
              ]
            )

            if (isPaid && inst) {
              await ds.query(
                `INSERT INTO payments (tenant_id, installment_id, student_id, amount, currency, payment_date, payment_method, status, received_by, created_at)
                 VALUES ($1, $2, $3, $4, 'TND', $5, 'bank_transfer', 'confirmed', $6, NOW())`,
                [
                  TENANT_ID, inst.id, studentId, (s.tuition / s.totalPayments).toFixed(2),
                  new Date(Date.now() - (s.paymentsPaid - i + 1) * 30 * 24 * 60 * 60 * 1000), adminId,
                ]
              )
            }
          }
        }
      }

      console.log(`✅ Student: ${s.firstName} ${s.lastName} (${s.status}${s.aiScore ? `, score: ${s.aiScore}` : ''})`)
      seededCount++
    }
  }

  console.log(`\n✅ Demo seed complete! ${seededCount} records created.\n`)
  console.log('Demo accounts:')
  // Phase 3 discovery — this previously printed a hardcoded admin
  // password ('Forsa2026pass') that has never matched the real
  // BOOTSTRAP_ADMIN_PASSWORD env var used to actually create that
  // account (see scripts/seed-admin.ts) — misleading whoever tried it.
  console.log(`  Admin:      admin@forsa.tn          / (see BOOTSTRAP_ADMIN_PASSWORD in .env)`)
  console.log('  Student:    student@forsa.tn         / Demo2026!')
  console.log('  University: university@forsa.tn      / University2026!')
  console.log('  Partner:    partner@forsa.tn         / Partner2026!')
  console.log('')
  console.log('Demo data includes:')
  console.log(`  - ${UNIVERSITIES.length} partner universities`)
  console.log(`  - ${STUDENTS.length} students at various pipeline stages`)
  console.log('  - AI interview reports with realistic scores')
  console.log('  - Payment schedules with paid installments')
  console.log('  - Partner referral data')

  await app.close()
}

seedDemo().catch(e => {
  console.error('Seed failed:', e.message)
  process.exit(1)
})
