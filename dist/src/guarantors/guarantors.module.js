"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuarantorsModule = void 0;
const common_1 = require("@nestjs/common");
const guarantors_controller_1 = require("./guarantors.controller");
const guarantors_service_1 = require("./guarantors.service");
const payments_module_1 = require("../payments/payments.module");
let GuarantorsModule = class GuarantorsModule {
};
exports.GuarantorsModule = GuarantorsModule;
exports.GuarantorsModule = GuarantorsModule = __decorate([
    (0, common_1.Module)({
        imports: [payments_module_1.PaymentsModule],
        controllers: [guarantors_controller_1.GuarantorsController],
        providers: [guarantors_service_1.GuarantorsService],
        exports: [guarantors_service_1.GuarantorsService],
    })
], GuarantorsModule);
//# sourceMappingURL=guarantors.module.js.map