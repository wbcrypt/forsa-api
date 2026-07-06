"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigitalPassModule = void 0;
const common_1 = require("@nestjs/common");
const digital_pass_controller_1 = require("./digital-pass.controller");
const digital_pass_service_1 = require("./digital-pass.service");
let DigitalPassModule = class DigitalPassModule {
};
exports.DigitalPassModule = DigitalPassModule;
exports.DigitalPassModule = DigitalPassModule = __decorate([
    (0, common_1.Module)({
        controllers: [digital_pass_controller_1.DigitalPassController],
        providers: [digital_pass_service_1.DigitalPassService],
        exports: [digital_pass_service_1.DigitalPassService],
    })
], DigitalPassModule);
//# sourceMappingURL=digital-pass.module.js.map