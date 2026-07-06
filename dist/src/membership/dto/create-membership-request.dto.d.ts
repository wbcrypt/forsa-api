export declare class CreateMembershipRequestDto {
    tenantId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    city: string;
    universityId?: string;
    programme: string;
    academicYear: string;
    currentOrFutureStudent: 'current' | 'future';
}
