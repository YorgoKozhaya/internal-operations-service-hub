import { PRODUCT_CATEGORIES } from './intake-rules';

export const INTAKE_ADVISOR = Symbol('INTAKE_ADVISOR');

export interface EmployeeRequestContext {
  requestId: string;
  title: string;
  status: string;
}

export interface IntakeContext {
  categories: typeof PRODUCT_CATEGORIES;
  employeeRequests: EmployeeRequestContext[];
}

export interface IntakeAdvisor {
  advise(text: string, context: IntakeContext): Promise<unknown>;
}

export class IntakeProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IntakeProviderError';
  }
}

export class InvalidIntakeOutputError extends Error {
  constructor() {
    super('The AI provider returned an invalid intake result.');
    this.name = 'InvalidIntakeOutputError';
  }
}
