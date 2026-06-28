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
const typeorm_1 = require("typeorm");
const argon2 = __importStar(require("argon2"));
const uuid_1 = require("uuid");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const ds = new typeorm_1.DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    username: process.env.DB_MIGRATION_USER,
    password: process.env.DB_MIGRATION_PASSWORD,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false,
});
async function main() {
    await ds.initialize();
    console.log('Connected to database');
    const tenantName = process.env.BOOTSTRAP_TENANT_NAME || 'FORSA Tunisia';
    const tenantSlug = process.env.BOOTSTRAP_TENANT_SLUG || 'forsa-tn';
    const country = process.env.BOOTSTRAP_TENANT_COUNTRY || 'TN';
    const currency = process.env.BOOTSTRAP_TENANT_CURRENCY || 'TND';
    const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
    const adminPass = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (!adminEmail || !adminPass) {
        console.error('BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD must be set in .env');
        process.exit(1);
    }
    const [existing] = await ds.query('SELECT id FROM tenants WHERE slug = $1', [tenantSlug]);
    let tenantId;
    if (existing) {
        tenantId = existing.id;
        console.log(`Tenant already exists: ${tenantId}`);
    }
    else {
        tenantId = (0, uuid_1.v4)();
        await ds.query(`INSERT INTO tenants (id, name, slug, country_code, default_currency, status)
       VALUES ($1,$2,$3,$4,$5,'active')`, [tenantId, tenantName, tenantSlug, country, currency]);
        console.log(`Created tenant: ${tenantId}`);
    }
    const [existingRole] = await ds.query('SELECT id FROM roles WHERE name = $1 AND tenant_id = $2', ['SUPER_ADMIN', tenantId]);
    let roleId;
    if (existingRole) {
        roleId = existingRole.id;
        console.log('SUPER_ADMIN role already exists');
    }
    else {
        const [role] = await ds.query(`INSERT INTO roles (tenant_id, name, description, is_system_role, status)
       VALUES ($1,'SUPER_ADMIN','Full system access — system role',true,'active')
       RETURNING id`, [tenantId]);
        roleId = role.id;
        await ds.query(`INSERT INTO role_permissions (role_id, permission_id, granted_by, granted_at)
       SELECT $1, p.id, $2, NOW() FROM permissions p
       ON CONFLICT DO NOTHING`, [roleId, '00000000-0000-0000-0000-000000000000']);
        console.log(`Created SUPER_ADMIN role: ${roleId}`);
    }
    const [existingUser] = await ds.query('SELECT id FROM users WHERE email = $1 AND tenant_id = $2', [adminEmail.toLowerCase(), tenantId]);
    if (existingUser) {
        console.log(`Admin user already exists: ${existingUser.id}`);
    }
    else {
        const passwordHash = await argon2.hash(adminPass, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });
        const [user] = await ds.query(`INSERT INTO users
        (tenant_id, email, email_verified, password_hash, full_name,
         status, mfa_enabled, must_change_password)
       VALUES ($1,$2,true,$3,'System Administrator','active',false,true)
       RETURNING id`, [tenantId, adminEmail.toLowerCase(), passwordHash]);
        await ds.query(`INSERT INTO user_roles (user_id, role_id, assigned_by, assigned_at)
       VALUES ($1,$2,$1,NOW())`, [user.id, roleId]);
        console.log(`Created admin user: ${user.id}`);
        console.log(`Email: ${adminEmail}`);
        console.log('\n⚠️  IMPORTANT:');
        console.log('  1. Change password on first login (must_change_password = true)');
        console.log('  2. Enable MFA immediately after login');
        console.log('  3. Remove BOOTSTRAP_* variables from .env');
        console.log(`  4. Tenant ID for login: ${tenantId}`);
    }
    await ds.destroy();
    console.log('\nSeed complete.');
}
main().catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
});
//# sourceMappingURL=seed-admin.js.map