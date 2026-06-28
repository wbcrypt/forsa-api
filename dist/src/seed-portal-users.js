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
const app_module_1 = require("./app.module");
const typeorm_1 = require("typeorm");
const argon2 = __importStar(require("argon2"));
const TENANT_ID = 'be694fc0-789a-4dec-b514-850710469c72';
const UNIVERSITY_ID = '09d23f50-30d3-43c7-9cd8-46f1d6248e4f';
const PARTNER_ID = 'b5c1538e-ad57-4add-8c4c-62fcded3547d';
const PORTAL_USERS = [
    {
        email: 'student@forsa.tn',
        password: 'Student2026!',
        fullName: 'Test Student',
        portalType: 'student',
        permissions: ['application.create', 'application.view', 'document.upload', 'document.view', 'payment.view', 'score.view'],
    },
    {
        email: 'university@forsa.tn',
        password: 'University2026!',
        fullName: 'UTM Admin',
        portalType: 'university',
        permissions: ['application.view', 'document.view', 'payment.view', 'student.view', 'university.view'],
    },
    {
        email: 'finance@forsa.tn',
        password: 'Finance2026!',
        fullName: 'Finance Manager',
        portalType: 'finance',
        permissions: [
            'payment.view', 'payment.record', 'payment.reverse',
            'collections.view', 'report.finance', 'report.collections', 'report.audit',
            'student.view', 'application.view', 'university.view',
        ],
    },
    {
        email: 'partner@forsa.tn',
        password: 'Partner2026!',
        fullName: 'EduLead Partner',
        portalType: 'partner',
        permissions: ['application.view', 'partner.view', 'partner.edit', 'payment.view'],
    },
];
async function seed() {
    const app = await core_1.NestFactory.createApplicationContext(app_module_1.AppModule, { logger: false });
    const ds = app.get(typeorm_1.DataSource);
    console.log('\n🌱 Seeding portal users...\n');
    for (const u of PORTAL_USERS) {
        const exists = await ds.query(`SELECT id FROM users WHERE email = $1 AND tenant_id = $2`, [u.email, TENANT_ID]);
        if (exists.length > 0) {
            console.log(`⏭  ${u.email} already exists`);
            continue;
        }
        const hash = await argon2.hash(u.password);
        const [user] = await ds.query(`INSERT INTO users (tenant_id, email, password_hash, full_name, status, must_change_password, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'active', false, NOW(), NOW())
       RETURNING id`, [TENANT_ID, u.email, hash, u.fullName]);
        const perms = await ds.query(`SELECT id FROM permissions WHERE code = ANY($1)`, [u.permissions]);
        let roleResult = await ds.query(`SELECT id FROM roles WHERE tenant_id = $1 AND name = $2`, [TENANT_ID, `${u.portalType}_user`]);
        if (roleResult.length === 0) {
            roleResult = await ds.query(`INSERT INTO roles (tenant_id, name, description, is_system_role, status, created_at, updated_at)
         VALUES ($1, $2, $3, false, 'active', NOW(), NOW())
         RETURNING id`, [TENANT_ID, `${u.portalType}_user`, `${u.portalType} portal access`]);
            for (const perm of perms) {
                await ds.query(`INSERT INTO role_permissions (role_id, permission_id, granted_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`, [roleResult[0].id, perm.id]);
            }
        }
        await ds.query(`INSERT INTO user_roles (user_id, role_id, assigned_at) VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`, [user.id, roleResult[0].id]);
        console.log(`✅ Created ${u.portalType} user: ${u.email}  [password set]`);
    }
    console.log('\n✅ Portal users seeded!\n');
    console.log('Student:    student@forsa.tn     / Student2026!');
    console.log('University: university@forsa.tn  / University2026!');
    console.log('Partner:    partner@forsa.tn     / Partner2026!');
    await app.close();
}
seed().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=seed-portal-users.js.map