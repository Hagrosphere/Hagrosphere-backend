import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  meta?: any;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        // If data already has 'success' key, it's a custom response — pass through
        if (data && typeof data === 'object' && 'success' in data) return data;

        // Unwrap { data, meta } pattern from services
        if (data && typeof data === 'object' && 'data' in data && 'meta' in data) {
          return { success: true, ...data };
        }

        return { success: true, data };
      }),
    );
  }
}
