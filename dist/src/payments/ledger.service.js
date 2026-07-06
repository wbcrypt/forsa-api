"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LedgerService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const uuid_1 = require("uuid");
let LedgerService = class LedgerService {
    constructor(dataSource) {
        this.dataSource = dataSource;
    }
    async recordEntries(tenantId, applicationId, referenceId, entry) {
        const batchId = (0, uuid_1.v4)();
        const referenceType = entry.referenceType || 'payment';
        await this.dataSource.query(`INSERT INTO financial_ledger
        (tenant_id, application_id, entry_type, account, amount, currency,
         reference_id, reference_type, description, batch_id)
       VALUES ($1,$2,'debit',$3,$4,$5,$6,$7,$8,$9)`, [tenantId, applicationId, entry.debitAccount, entry.amount, entry.currency,
            referenceId, referenceType, entry.description, batchId]);
        await this.dataSource.query(`INSERT INTO financial_ledger
        (tenant_id, application_id, entry_type, account, amount, currency,
         reference_id, reference_type, description, batch_id)
       VALUES ($1,$2,'credit',$3,$4,$5,$6,$7,$8,$9)`, [tenantId, applicationId, entry.creditAccount, entry.amount, entry.currency,
            referenceId, referenceType, entry.description, batchId]);
    }
};
exports.LedgerService = LedgerService;
exports.LedgerService = LedgerService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], LedgerService);
//# sourceMappingURL=ledger.service.js.map