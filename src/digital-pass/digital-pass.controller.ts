import {
  Controller, Get, Post, Body, Param, UseGuards, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DigitalPassService } from './digital-pass.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { CurrentUser, CurrentTenant, RequirePermissions, Public } from '../common/decorators';
import { RevokePassDto } from './dto/revoke-pass.dto';

// No class-level route prefix — routes below span /pass (public QR
// target), /students/me/digital-pass (self-scoped student view), and
// /digital-passes (staff admin), matching the existing convention of
// keeping a "me"-scoped read next to its resource's own controller
// (T-101's GET /students/me, T-219's GET /students/me/payments) while
// this module owns everything Digital-Pass-specific.
@ApiTags('Digital Student Pass')
@Controller()
export class DigitalPassController {
  constructor(private readonly service: DigitalPassService) {}

  // T-206 — genuinely public, no auth: the QR code embeds this URL.
  @Public()
  @Get('pass/verify/:token')
  @ApiOperation({ summary: 'Public QR verification — live status check, not a static payload (T-206)' })
  verify(@Param('token') token: string) {
    return this.service.verifyByToken(token);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('students/me/digital-pass')
  @ApiOperation({ summary: "Get the logged-in student's own Digital Student Pass + QR code (T-205)" })
  findMyPass(@CurrentUser('id') u: string, @CurrentTenant() t: string) {
    return this.service.findMyPass(u, t);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('digital-passes')
  @RequirePermissions('membership.view')
  @ApiOperation({ summary: 'Admin Dashboard Digital Pass list' })
  findAll(@CurrentTenant() t: string) {
    return this.service.findAll(t);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('digital-passes/:id/revoke')
  @RequirePermissions('membership.approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a Digital Student Pass' })
  revoke(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokePassDto,
    @CurrentTenant() t: string,
    @CurrentUser('id') u: string,
  ) {
    return this.service.revoke(id, t, u, dto.reason);
  }
}
