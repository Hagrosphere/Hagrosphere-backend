import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { AuditService } from '../shared/audit.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, AuditService],
  exports: [JobsService],
})
export class JobsModule {}
