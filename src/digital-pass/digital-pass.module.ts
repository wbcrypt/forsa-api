import { Module } from '@nestjs/common';
import { DigitalPassController } from './digital-pass.controller';
import { DigitalPassService } from './digital-pass.service';

@Module({
  controllers: [DigitalPassController],
  providers: [DigitalPassService],
  exports: [DigitalPassService],
})
export class DigitalPassModule {}
