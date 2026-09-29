import { Injectable } from '@nestjs/common';

export interface LogEntry {
  at: string;
  level: 'info' | 'error';
  component: string;
  message: string;
}

@Injectable()
export class LogsService {
  private readonly entries: LogEntry[] = [];
  private readonly lastMessage = new Map<string, string>();

  record(level: LogEntry['level'], component: string, message: string): void {
    this.entries.push({
      at: new Date().toISOString(),
      level,
      component,
      message,
    });

    if (this.entries.length > 80) {
      this.entries.shift();
    }
  }

  recordChange(component: string, message: string): void {
    if (this.lastMessage.get(component) === message) {
      return;
    }

    this.lastMessage.set(component, message);
    this.record('info', component, message);
  }

  recent(): LogEntry[] {
    return [...this.entries];
  }
}
