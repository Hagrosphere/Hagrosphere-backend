import { Module } from '@nestjs/common';
import { EquipmentController } from './equipment.controller';
import { EquipmentService } from './equipment.service';
import { AuditService } from '../shared/audit.service';

@Module({
  controllers: [EquipmentController],
  providers: [EquipmentService, AuditService],
  exports: [EquipmentService],
})
export class EquipmentModule {}
