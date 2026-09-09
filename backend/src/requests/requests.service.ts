import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ALLOWED_TRANSITIONS,
  REQUEST_STATUSES,
  RequestStatus,
  isRequestStatus,
} from './request-status';
import { createInitialRequests } from './request.data';
import { RequestRecord } from './request-record';

@Injectable()
export class RequestsService {
  private requests = createInitialRequests();

  findAll(): RequestRecord[] {
    return [...this.requests.values()];
  }

  findOne(id: string): RequestRecord {
    const request = this.requests.get(id);

    if (!request) {
      throw new NotFoundException(`Request ${id} was not found.`);
    }

    return request;
  }

  resetDemoData(): RequestRecord[] {
    this.requests = createInitialRequests();
    return this.findAll();
  }

  updateStatus(id: string, nextStatus: string): RequestRecord {
    const request = this.findOne(id);

    if (!request.status) {
      throw new BadRequestException('Request must always have one current status.');
    }

    if (!isRequestStatus(nextStatus)) {
      throw new BadRequestException(
        `Invalid status. Allowed statuses are: ${REQUEST_STATUSES.join(', ')}.`,
      );
    }

    if (!this.canTransition(request.status, nextStatus)) {
      throw new BadRequestException(
        `Cannot transition request ${id} from ${request.status} to ${nextStatus}.`,
      );
    }

    request.status = nextStatus;
    request.history.push({
      historyId: `HIST-${request.history.length + 1}`,
      requestId: request.requestId,
      status: nextStatus,
      updatedDate: new Date().toISOString(),
    });

    return request;
  }

  private canTransition(currentStatus: RequestStatus, nextStatus: RequestStatus): boolean {
    return ALLOWED_TRANSITIONS[currentStatus].includes(nextStatus);
  }
}
