import { AiService } from './ai.service';
export declare class AiInterviewMessageDto {
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    system?: string;
    max_tokens?: number;
    model?: string;
}
export declare class AiScoreDto {
    prompt: string;
}
export declare class AiController {
    private readonly aiService;
    private readonly logger;
    constructor(aiService: AiService);
    interview(dto: AiInterviewMessageDto): Promise<{
        content: string;
        demo: false;
    }>;
    score(dto: AiScoreDto): Promise<{
        content: string;
        demo: false;
    }>;
    demoInterview(dto: {
        messages: any[];
        system?: string;
        studentData?: any;
    }): Promise<{
        content: string;
        demo: true;
    }>;
}
