export const PRODUCT_CATEGORIES = [
  {
    categoryId: 'CAT-IT-1',
    name: 'IT Hardware',
    departmentId: 'IT',
  },
  {
    categoryId: 'CAT-HR-1',
    name: 'Employment Letter',
    departmentId: 'HR',
  },
  {
    categoryId: 'CAT-FIN-1',
    name: 'Work Expense',
    departmentId: 'FINANCE',
  },
] as const;

export type ProductCategoryId = (typeof PRODUCT_CATEGORIES)[number]['categoryId'];

export type IntakeRequestType = 'new_request' | 'status_question';

export interface IntakeResult {
  requestType: IntakeRequestType;
  categoryId: string | null;
  categoryName: string | null;
  title: string | null;
  needsApproval: null;
  departmentId: string | null;
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
  categoryName: string | null;
  departmentId: string | null;
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

export const KNOWN_CATEGORY_IDS = [
  'CAT-IT-1',
  'CAT-IT-2',
  'CAT-IT-3',
  'CAT-IT-OTHER',
  'CAT-HR-1',
  'CAT-HR-2',
  'CAT-HR-3',
  'CAT-HR-OTHER',
  'CAT-FIN-1',
  'CAT-FIN-2',
  'CAT-FIN-3',
  'CAT-FIN-OTHER',
] as const;

export function isKnownCategoryId(categoryId: string): boolean {
  return (KNOWN_CATEGORY_IDS as readonly string[]).includes(categoryId);
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
    pattern: /\b(hr|human resources|employment|letter|manager|workplace|raise|salary|promotion)\b/i,
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
    !isKnownCategoryId(categoryId) &&
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
    categoryName: cleanCategoryName(optionalText(record.categoryName)),
    departmentId: normalizeDepartment(optionalText(record.departmentId)),
    title: optionalText(record.title),
    needsClarification,
    clarification: optionalText(record.clarification),
    guidance: optionalText(record.guidance),
    requestId,
  };
}

export function cleanCategoryName(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.replace(/\s+/g, ' ').trim();

  if (!trimmed) {
    return null;
  }

  const capped = trimmed.length > 40 ? trimmed.slice(0, 40).trim() : trimmed;
  return capped.charAt(0).toUpperCase() + capped.slice(1);
}

const TYPE_SIGNALS: Array<{ categoryId: string; pattern: RegExp }> = [
  { categoryId: 'CAT-IT-1', pattern: /\b(laptop|keyboard|hardware|computer|monitor|screen|printer|mouse|headset)\b/i },
  { categoryId: 'CAT-IT-2', pattern: /\b(account|access|vpn|password|login|credential)\b/i },
  { categoryId: 'CAT-IT-3', pattern: /\b(software|install|license|application)\b/i },
  { categoryId: 'CAT-HR-1', pattern: /\b(employment letter|letter of employment|employment)\b/i },
  { categoryId: 'CAT-HR-2', pattern: /\b(leave|day off|vacation|time off)\b/i },
  { categoryId: 'CAT-HR-3', pattern: /\b(workplace|manager|harass|behaving|behave)\b/i },
  { categoryId: 'CAT-FIN-1', pattern: /\b(expense|reimburse|reimbursement|taxi)\b/i },
  { categoryId: 'CAT-FIN-2', pattern: /\b(invoice)\b/i },
  { categoryId: 'CAT-FIN-3', pattern: /\b(budget)\b/i },
];

export function categoryMatchesMessage(categoryId: string, name: string, message: string): boolean {
  if (name.trim().toLowerCase() === 'other') {
    return false;
  }

  const signal = TYPE_SIGNALS.find((type) => type.categoryId === categoryId);

  if (signal?.pattern.test(message)) {
    return true;
  }

  return message.toLowerCase().includes(name.trim().toLowerCase());
}

export function normalizeDepartment(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase();

  if (normalized === 'IT' || normalized === 'HR' || normalized === 'FINANCE') {
    return normalized;
  }

  if (normalized === 'FIN') {
    return 'FINANCE';
  }

  return null;
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
