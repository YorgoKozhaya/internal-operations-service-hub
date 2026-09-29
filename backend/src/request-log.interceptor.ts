import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { LogsService } from './logs.service';

@Injectable()
export class RequestLogInterceptor implements NestInterceptor {
  constructor(private readonly logs: LogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ method?: string; url?: string }>();
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.write(request, http.getResponse<{ statusCode?: number }>().statusCode ?? 200, started),
        error: () => this.write(request, http.getResponse<{ statusCode?: number }>().statusCode ?? 500, started),
      }),
    );
  }

  private write(
    request: { method?: string; url?: string },
    status: number,
    started: number,
  ): void {
    const path = (request.url ?? '').split('?')[0];

    if (
      path === '/health' ||
      path === '/monitor' ||
      path === '/logs' ||
      path.endsWith('/watch')
    ) {
      return;
    }

    const level = status >= 400 ? 'error' : 'info';
    this.logs.record(level, 'backend', `${request.method ?? 'GET'} ${path} ${status} ${Date.now() - started}ms`);
  }
}
