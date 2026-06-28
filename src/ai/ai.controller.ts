// src/ai/ai.controller.ts
import {
  Controller, Post, Body, UseGuards, HttpException, HttpStatus, Logger
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { AiService } from './ai.service'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'

export class AiInterviewMessageDto {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  system?: string
  max_tokens?: number
  model?: string
}

export class AiScoreDto {
  prompt: string
}

@ApiTags('AI')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name)

  constructor(private readonly aiService: AiService) {}

  @Post('interview')
  async interview(@Body() dto: AiInterviewMessageDto) {
    try {
      return await this.aiService.chat(dto.messages, dto.system, dto.max_tokens)
    } catch (err: any) {
      this.logger.error('AI interview error:', err.message)
      throw new HttpException(
        err.message || 'AI service error',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('score')
  async score(@Body() dto: AiScoreDto) {
    try {
      return await this.aiService.score(dto.prompt)
    } catch (err: any) {
      this.logger.error('AI score error:', err.message)
      throw new HttpException(
        err.message || 'AI service error',
        err.status || HttpStatus.INTERNAL_SERVER_ERROR,
      )
    }
  }

  @Post('demo-interview')
  async demoInterview(@Body() dto: { messages: any[]; system?: string; studentData?: any }) {
    // Demo mode — returns scripted responses without API key
    return this.aiService.demoChat(dto.messages, dto.studentData)
  }
}
