"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutionModule = void 0;
const common_1 = require("@nestjs/common");
const execution_service_1 = require("./execution.service");
const execution_controller_1 = require("./execution.controller");
const payments_module_1 = require("../payments/payments.module");
const contracts_module_1 = require("../contracts/contracts.module");
const notifications_module_1 = require("../notifications/notifications.module");
let ExecutionModule = class ExecutionModule {
};
exports.ExecutionModule = ExecutionModule;
exports.ExecutionModule = ExecutionModule = __decorate([
    (0, common_1.Module)({
        imports: [payments_module_1.PaymentsModule, contracts_module_1.ContractsModule, notifications_module_1.NotificationsModule],
        controllers: [execution_controller_1.ExecutionController],
        providers: [execution_service_1.ExecutionService],
        exports: [execution_service_1.ExecutionService],
    })
], ExecutionModule);
//# sourceMappingURL=execution.module.js.map