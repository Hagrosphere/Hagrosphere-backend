import { Module } from '@nestjs/common';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { AuditService } from '../shared/audit.service';

@Module({
  controllers: [ArticlesController],
  providers: [ArticlesService, AuditService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
