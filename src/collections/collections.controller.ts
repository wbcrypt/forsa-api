import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CollectionsService } from './collections.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions } from '../common/decorators';
import { PaginationDto } from '../common/utils/pagination.util';

@ApiTags('Collections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('collections')
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}

  @Get('dashboard')
  @RequirePermissions('collections.view')
  @ApiOperation({ summary: 'Collections dashboard — late, at-risk, defaulted summary' })
  getDashboard(@CurrentTenant() t: string) {
    return this.service.getDashboard(t);
  }

  @Get('late')
  @RequirePermissions('collections.view')
  @ApiOperation({ summary: 'Paginated list of late installments' })
  getLate(@CurrentTenant() t: string, @Query() p: PaginationDto, @Query() f: any) {
    return this.service.getLateInstallments(t, p, f);
  }

  @Get('worklist')
  @RequirePermissions('collections.view')
  @ApiOperation({ summary: 'Score-prioritized collections worklist' })
  getWorklist(@CurrentTenant() t: string, @CurrentUser('id') u: string, @Query('mine') mine: string) {
    return this.service.getPrioritizedWorklist(t, mine === 'true' ? u : undefined);
  }

  @Post('contact-logs')
  @RequirePermissions('collections.log')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log a contact attempt with a student' })
  logContact(@Body() body: any, @CurrentTenant() t: string, @CurrentUser('id') u: string) {
    return this.service.logContactAttempt({ ...body, tenantId: t, loggedBy: u });
  }

  @Get('installments/:id/contact-history')
  @RequirePermissions('collections.view')
  getContactHistory(@Param('id', ParseUUIDPipe) id: string, @CurrentTenant() t: string) {
    return this.service.getContactHistory(id, t);
  }
}
