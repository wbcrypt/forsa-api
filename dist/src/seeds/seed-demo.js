"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("../app.module");
const typeorm_1 = require("typeorm");
const argon2 = __importStar(require("argon2"));
const TENANT_ID = 'be694fc0-789a-4dec-b514-850710469c72';
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
];
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
        status: 'pre_approved',
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
        status: 'internal_review',
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
        status: 'contracts_signed',
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
        status: 'applied',
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
];
function generateAiReport(student, lang = 'fr') {
    const score = student.aiScore || 70;
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
    };
}
async function seedDemo() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: ['error', 'warn'] });
    const ds = app.get(typeorm_1.DataSource);
    console.log('\n🌱 Seeding FORSA demo data...\n');
    const [admin] = await ds.query(`SELECT id FROM users WHERE email = 'admin@forsa.tn' AND tenant_id = $1`, [TENANT_ID]);
    const adminId = admin?.id;
    let seededCount = 0;
    for (const uni of UNIVERSITIES) {
        const existing = await ds.query(`SELECT id FROM universities WHERE id = $1`, [uni.id]);
        if (existing.length === 0) {
            await ds.query(`INSERT INTO universities (id, tenant_id, name, code, city, country_code, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'TN', 'active', NOW(), NOW())
         ON CONFLICT (id) DO NOTHING`, [uni.id, TENANT_ID, uni.name, uni.code, uni.city]);
            console.log(`✅ University: ${uni.name}`);
            for (const program of uni.programs) {
                await ds.query(`INSERT INTO programs (tenant_id, university_id, name, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'active', NOW(), NOW())
           ON CONFLICT DO NOTHING`, [TENANT_ID, uni.id, program]);
            }
            seededCount++;
        }
        else {
            console.log(`⏭  University already exists: ${uni.name}`);
        }
    }
    const partnerExists = await ds.query(`SELECT id FROM partners WHERE email = 'partner@forsa.tn' AND tenant_id = $1 LIMIT 1`, [TENANT_ID]);
    if (partnerExists.length === 0) {
        await ds.query(`INSERT INTO partners (tenant_id, name, type, status, email, country_code, is_founding_partner, created_at, updated_at)
       VALUES ($1, 'EduLead Tunisia', 'platform', 'active', 'partner@forsa.tn', 'TN', true, NOW(), NOW())
       ON CONFLICT DO NOTHING`, [TENANT_ID]);
        console.log(`✅ Partner: EduLead Tunisia`);
        seededCount++;
    }
    for (const s of STUDENTS) {
        const existingStudent = await ds.query(`SELECT id FROM students WHERE email = $1 AND tenant_id = $2 LIMIT 1`, [s.email, TENANT_ID]);
        let studentId;
        if (existingStudent.length > 0) {
            studentId = existingStudent[0].id;
            console.log(`⏭  Student already exists: ${s.firstName} ${s.lastName}`);
        }
        else {
            const passwordHash = await argon2.hash('Demo2026!');
            const [newUser] = await ds.query(`INSERT INTO users (tenant_id, email, password_hash, full_name, status, must_change_password, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', false, NOW(), NOW())
         ON CONFLICT (email, tenant_id) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`, [TENANT_ID, s.email, passwordHash, `${s.firstName} ${s.lastName}`]);
            const [newStudent] = await ds.query(`INSERT INTO students (tenant_id, user_id, first_name, last_name, email, phone, city, nationality, academic_level, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'TN', 'university', 'active', NOW(), NOW())
         RETURNING id`, [TENANT_ID, newUser?.id, s.firstName, s.lastName, s.email, s.phone, s.city]);
            studentId = newStudent.id;
            const uni = UNIVERSITIES[s.universityIdx];
            const aiReport = s.aiScore ? generateAiReport(s) : null;
            const langs = ['fr', 'ar', 'en'];
            const interviewLang = langs[Math.floor(Math.random() * 3)];
            const [newApp] = await ds.query(`INSERT INTO applications (
          tenant_id, student_id, university_id, program_name,
          tuition_amount, requested_support_amount, currency,
          academic_year, is_renewal, current_status,
          ai_score_overall, ai_recommendation, ai_report, interview_language,
          lead_date, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $5, 'TND', '2026-2027', false, $6, $7, $8, $9, $10, NOW() - INTERVAL '${Math.floor(Math.random() * 30)} days', NOW(), NOW())
         RETURNING id`, [
                TENANT_ID, studentId, uni.id, s.program,
                s.tuition, s.status,
                s.aiScore, s.recommendation,
                aiReport ? JSON.stringify(aiReport) : null,
                interviewLang,
            ]);
            if (s.totalPayments > 0 && newApp) {
                const [schedule] = await ds.query(`INSERT INTO payment_schedules (tenant_id, student_id, application_id, total_amount, currency, installment_count, start_date, payment_model, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'TND', $5, NOW(), 'concurrent', 'active', NOW(), NOW())
           RETURNING id`, [TENANT_ID, studentId, newApp.id, s.tuition, s.totalPayments]);
                if (schedule) {
                    for (let i = 1; i <= s.totalPayments; i++) {
                        const isPaid = i <= s.paymentsPaid;
                        const [inst] = await ds.query(`INSERT INTO installments (tenant_id, schedule_id, sequence_number, due_date, amount, currency, status, created_at, updated_at)
               VALUES ($1, $2, $3, NOW() + INTERVAL '${i * 30} days', $4, 'TND', $5, NOW(), NOW())
               RETURNING id`, [TENANT_ID, schedule.id, i, (s.tuition / s.totalPayments).toFixed(2), isPaid ? 'paid' : 'pending']);
                        if (isPaid && inst) {
                            await ds.query(`INSERT INTO payments (tenant_id, installment_id, student_id, amount, currency, paid_at, payment_method, status, recorded_by, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, 'TND', NOW() - INTERVAL '${(s.paymentsPaid - i + 1) * 30} days', 'bank_transfer', 'paid', $5, NOW(), NOW())`, [TENANT_ID, inst.id, studentId, (s.tuition / s.totalPayments).toFixed(2), adminId]);
                        }
                    }
                }
            }
            console.log(`✅ Student: ${s.firstName} ${s.lastName} (${s.status}${s.aiScore ? `, score: ${s.aiScore}` : ''})`);
            seededCount++;
        }
    }
    console.log(`\n✅ Demo seed complete! ${seededCount} records created.\n`);
    console.log('Demo accounts:');
    console.log('  Admin:      admin@forsa.tn          / Forsa2026pass');
    console.log('  Student:    student@forsa.tn         / Demo2026!');
    console.log('  University: university@forsa.tn      / University2026!');
    console.log('  Partner:    partner@forsa.tn         / Partner2026!');
    console.log('');
    console.log('Demo data includes:');
    console.log(`  - ${UNIVERSITIES.length} partner universities`);
    console.log(`  - ${STUDENTS.length} students at various pipeline stages`);
    console.log('  - AI interview reports with realistic scores');
    console.log('  - Payment schedules with paid installments');
    console.log('  - Partner referral data');
    await app.close();
}
seedDemo().catch(e => {
    console.error('Seed failed:', e.message);
    process.exit(1);
});
//# sourceMappingURL=seed-demo.js.map