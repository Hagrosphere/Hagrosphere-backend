import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AuditService } from '../shared/audit.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, AuditService],
  exports: [UsersService],
})
export class UsersModule {}
