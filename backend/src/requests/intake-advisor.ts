export const INTAKE_ADVISOR = Symbol('INTAKE_ADVISOR');

export interface EmployeeRequestContext {
  requestId: string;
  title: string;
  status: string;
  comments: Array<{ authorName: string; message: string }>;
}

export interface CategoryContext {
  categoryId: string;
  name: string;
  departmentId: string;
}

export interface IntakeContext {
  categories: readonly CategoryContext[];
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
