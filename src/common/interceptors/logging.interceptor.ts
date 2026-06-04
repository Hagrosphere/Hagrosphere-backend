import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const ms = Date.now() - start;
        const status = context.switchToHttp().getResponse().statusCode;
        if (ms > 1000) {
          this.logger.warn(`${method} ${url} ${status} - ${ms}ms [SLOW]`);
        } else {
          this.logger.log(`${method} ${url} ${status} - ${ms}ms`);
        }
      }),
    );
  }
}
