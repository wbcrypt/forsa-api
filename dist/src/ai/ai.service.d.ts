import { ConfigService } from '@nestjs/config';
interface Message {
    role: 'user' | 'assistant';
    content: string;
}
export declare class AiService {
    private readonly config;
    private readonly logger;
    private readonly apiKey;
    private readonly model;
    constructor(config: ConfigService);
    get hasApiKey(): boolean;
    chat(messages: Message[], system?: string, maxTokens?: number): Promise<{
        content: string;
        demo: false;
    }>;
    score(prompt: string): Promise<{
        content: string;
        demo: false;
    }>;
    demoChat(messages: Message[], studentData?: any): Promise<{
        content: string;
        demo: true;
    }>;
}
export {};
