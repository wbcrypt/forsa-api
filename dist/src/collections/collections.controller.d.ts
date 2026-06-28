import { CollectionsService } from './collections.service';
import { PaginationDto } from '../common/utils/pagination.util';
export declare class CollectionsController {
    private readonly service;
    constructor(service: CollectionsService);
    getDashboard(t: string): Promise<any>;
    getLate(t: string, p: PaginationDto, f: any): Promise<import("../common/utils/pagination.util").PaginatedResult<unknown>>;
    getWorklist(t: string, u: string, mine: string): Promise<any>;
    logContact(body: any, t: string, u: string): Promise<any>;
    getContactHistory(id: string, t: string): Promise<any>;
}
