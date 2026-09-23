export const PRODUCT_CATEGORIES = [
  {
    categoryId: 'CAT-IT-1',
    name: 'IT Hardware',
    departmentId: 'IT',
    needsApproval: false,
  },
  {
    categoryId: 'CAT-HR-1',
    name: 'Employment Letter',
    departmentId: 'HR',
    needsApproval: false,
  },
  {
    categoryId: 'CAT-FIN-1',
    name: 'Work Expense',
    departmentId: 'FINANCE',
    needsApproval: true,
  },
] as const;

export type ProductCategoryId = (typeof PRODUCT_CATEGORIES)[number]['categoryId'];

export type IntakeRequestType = 'new_request' | 'status_question';

export interface IntakeResult {
  requestType: IntakeRequestType;
  categoryId: string | null;
  categoryName: string | null;
  title: string | null;
  needsApproval: boolean;
  needsClarification: boolean;
  clarification: string | null;
  guidance: string | null;
  requestId: string | null;
  status: string | null;
  answer: string | null;
}

export interface ParsedIntake {
  requestType: IntakeRequestType;
  categoryId: string | null;
  title: string | null;
  needsClarification: boolean;
  clarification: string | null;
  guidance: string | null;
  requestId: string | null;
}

const STATUS_QUESTION =
  /\b(what happened|what(?:'s| is) the status|status of|any update|where is|progress)\b/i;

const ALL_REQUESTS =
  /\b(all (of )?my requests|what are my requests|statuses of my requests|status of my requests|every request|show (me )?my requests)\b/i;

export function isProductCategory(categoryId: string): categoryId is ProductCategoryId {
  return PRODUCT_CATEGORIES.some((category) => category.categoryId === categoryId);
}

export function categoryById(categoryId: string | null) {
  return PRODUCT_CATEGORIES.find((category) => category.categoryId === categoryId) ?? null;
}

export function looksLikeStatusQuestion(text: string): boolean {
  return STATUS_QUESTION.test(text) || asksForEveryRequest(text);
}

export function asksForEveryRequest(text: string): boolean {
  return ALL_REQUESTS.test(text);
}

export function isThinRequest(text: string): boolean {
  return text.trim().split(/\s+/).filter(Boolean).length < 3;
}

const AREA_SIGNALS: Array<{ categoryId: ProductCategoryId; pattern: RegExp }> = [
  {
    categoryId: 'CAT-IT-1',
    pattern: /\b(it|laptop|keyboard|hardware|computer|monitor|vpn|password|software|screen)\b/i,
  },
  {
    categoryId: 'CAT-HR-1',
    pattern: /\b(hr|human resources|employment|letter|manager|workplace)\b/i,
  },
  {
    categoryId: 'CAT-FIN-1',
    pattern: /\b(finance|reimburse|reimbursement|expense|expenses|taxi|invoice)\b/i,
  },
];

export function matchingAreas(text: string): ProductCategoryId[] {
  const matches = AREA_SIGNALS.filter((area) => area.pattern.test(text)).map((area) => area.categoryId);

  return [...new Set(matches)];
}

export function parseModelOutput(raw: unknown): ParsedIntake {
  const value = unwrapModelValue(raw);

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('invalid');
  }

  const record = value as Record<string, unknown>;
  const requestType = record.requestType;

  if (requestType !== 'new_request' && requestType !== 'status_question') {
    throw new Error('invalid');
  }

  const categoryId = optionalText(record.categoryId);
  const needsClarification = record.needsClarification === true;

  if (
    requestType === 'new_request' &&
    categoryId &&
    !isProductCategory(categoryId) &&
    !needsClarification
  ) {
    throw new Error('invalid');
  }

  const requestId = optionalText(record.requestId);

  if (requestId && !/^REQ-\d+$/.test(requestId)) {
    throw new Error('invalid');
  }

  return {
    requestType,
    categoryId,
    title: optionalText(record.title),
    needsClarification,
    clarification: optionalText(record.clarification),
    guidance: optionalText(record.guidance),
    requestId,
  };
}

function unwrapModelValue(raw: unknown): unknown {
  if (typeof raw !== 'string') {
    return raw;
  }

  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim() ?? extractObject(trimmed);

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new Error('invalid');
  }
}

function extractObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');

  if (start === -1 || end <= start) {
    return text;
  }

  return text.slice(start, end + 1);
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new Error('invalid');
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
