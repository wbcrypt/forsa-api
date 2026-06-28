"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionsModule = void 0;
const common_1 = require("@nestjs/common");
const collections_controller_1 = require("./collections.controller");
const collections_service_1 = require("./collections.service");
const policy_module_1 = require("../policy/policy.module");
const score_module_1 = require("../score/score.module");
const notifications_module_1 = require("../notifications/notifications.module");
let CollectionsModule = class CollectionsModule {
};
exports.CollectionsModule = CollectionsModule;
exports.CollectionsModule = CollectionsModule = __decorate([
    (0, common_1.Module)({
        imports: [policy_module_1.PolicyModule, score_module_1.ScoreModule, notifications_module_1.NotificationsModule],
        controllers: [collections_controller_1.CollectionsController],
        providers: [collections_service_1.CollectionsService],
        exports: [collections_service_1.CollectionsService],
    })
], CollectionsModule);
//# sourceMappingURL=collections.module.js.map