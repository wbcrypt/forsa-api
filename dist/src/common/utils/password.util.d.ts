export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(hash: string, password: string): Promise<boolean>;
export declare function validatePasswordComplexity(password: string, minLength?: number): void;
