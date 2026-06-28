"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var GlobalExceptionFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("typeorm");
const SAFE_HTTP_CODES = [400, 401, 403, 404, 409, 422, 429];
let GlobalExceptionFilter = GlobalExceptionFilter_1 = class GlobalExceptionFilter {
    constructor() {
        this.logger = new common_1.Logger(GlobalExceptionFilter_1.name);
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'An unexpected error occurred';
        let code = 'INTERNAL_ERROR';
        let errors;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();
            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const resp = exceptionResponse;
                message = resp.message || exception.message;
                code = resp.code || this.statusToCode(status);
                errors = Array.isArray(resp.message) ? resp.message : undefined;
                if (errors)
                    message = 'Validation failed';
            }
            else {
                message = exceptionResponse;
                code = this.statusToCode(status);
            }
        }
        else if (exception instanceof typeorm_1.QueryFailedError) {
            this.logger.error('Database error', {
                message: exception.message,
                query: exception.query,
                path: request.url,
            });
            if (exception.code === '23505') {
                status = common_1.HttpStatus.CONFLICT;
                message = 'A record with this value already exists';
                code = 'DUPLICATE_ENTRY';
            }
            else {
                status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
                message = 'A database error occurred';
                code = 'DATABASE_ERROR';
            }
        }
        else if (exception instanceof Error) {
            this.logger.error('Unhandled error', {
                message: exception.message,
                stack: exception.stack,
                path: request.url,
            });
        }
        else {
            this.logger.error('Unknown exception type', { exception, path: request.url });
        }
        if (status >= 500) {
            this.logger.error(`${request.method} ${request.url} → ${status}`, {
                exception: exception instanceof Error ? exception.message : exception,
                ip: request.ip,
                userAgent: request.headers['user-agent'],
            });
        }
        else if (status === 401 || status === 403) {
            this.logger.warn(`${request.method} ${request.url} → ${status}`, {
                ip: request.ip,
            });
        }
        if (status >= 500) {
            message = 'An unexpected error occurred. Please contact support if this persists.';
            code = 'INTERNAL_ERROR';
            errors = undefined;
        }
        const responseBody = {
            statusCode: status,
            code,
            message,
            timestamp: new Date().toISOString(),
            path: request.url,
        };
        if (errors && SAFE_HTTP_CODES.includes(status)) {
            responseBody.errors = errors;
        }
        response.status(status).json(responseBody);
    }
    statusToCode(status) {
        const codes = {
            400: 'BAD_REQUEST',
            401: 'UNAUTHORIZED',
            403: 'FORBIDDEN',
            404: 'NOT_FOUND',
            409: 'CONFLICT',
            422: 'UNPROCESSABLE_ENTITY',
            429: 'TOO_MANY_REQUESTS',
            500: 'INTERNAL_ERROR',
        };
        return codes[status] || 'ERROR';
    }
};
exports.GlobalExceptionFilter = GlobalExceptionFilter;
exports.GlobalExceptionFilter = GlobalExceptionFilter = GlobalExceptionFilter_1 = __decorate([
    (0, common_1.Catch)()
], GlobalExceptionFilter);
//# sourceMappingURL=global-exception.filter.js.map