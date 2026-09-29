const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'openai/gpt-oss-20b';

export class SuggestError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SuggestError';
    this.code = code;
  }
}

export async function suggest(text, context) {
  const apiKey = process.env.GROQ_API_KEY?.trim();

  if (!apiKey) {
    throw new SuggestError('not_configured', 'The AI provider is not configured.');
  }

  const baseUrl = (process.env.GROQ_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL;
  const messages = [
    { role: 'system', content: systemPrompt() },
    { role: 'user', content: userPrompt(text, context?.employeeRequests ?? [], context?.categories ?? []) },
  ];

  let response;

  try {
    response = await requestCompletion(baseUrl, apiKey, {
      model,
      temperature: 0,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages,
    });
  } catch (error) {
    if (!(error instanceof SuggestError) || !error.message.includes('json_validate_failed')) {
      throw error;
    }

    response = await requestCompletion(baseUrl, apiKey, {
      model,
      temperature: 0,
      max_tokens: 1200,
      messages,
    });
  }

  const body = await response.json();
  const message = body.choices?.[0]?.message ?? {};
  const content = [message.content, message.reasoning, message.reasoning_content].find(
    (value) => typeof value === 'string' && value.includes('{'),
  );

  if (typeof content !== 'string') {
    throw new SuggestError('invalid', 'The AI provider returned an invalid intake result.');
  }

  try {
    return JSON.parse(extractJson(content));
  } catch {
    throw new SuggestError('invalid', 'The AI provider returned an invalid intake result.');
  }
}

async function requestCompletion(baseUrl, apiKey, body) {
  let lastError = 'The AI provider could not be reached.';

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response;

    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      lastError = 'The AI provider could not be reached.';
      await delay(1500 * (attempt + 1));
      continue;
    }

    if (response.ok) {
      return response;
    }

    const detail = await response.text().catch(() => '');
    lastError = `The AI provider returned ${response.status}.`;

    if (response.status !== 429 && response.status < 500) {
      if (detail.includes('json_validate_failed')) {
        lastError = `${lastError} json_validate_failed`;
      }

      throw new SuggestError('provider', lastError);
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * (attempt + 1);
    await delay(waitMs);
  }

  throw new SuggestError('provider', lastError);
}

function systemPrompt() {
  return [
    'You classify one employee message for an internal service hub.',
    'Return a JSON object with keys requestType, categoryId, title, needsClarification, clarification, guidance, requestId.',
    'requestType is "new_request" or "status_question".',
    'Use status_question only when the employee asks what happened to an existing request, or asks for its status or progress.',
    'Use new_request when the employee wants something done.',
    'categoryId must be one of the listed category ids, or null.',
    'Choose the listed type that fits the message. If none of the named types fit, use the Other category for that department.',
    'Do not invent a new category id or a new category name.',
    'Do not decide whether approval is required.',
    'If the message is thin, names two departments, or is outside IT, HR, and Finance, set needsClarification to true and categoryId to null.',
    'For status_question, set requestId only when one listed request matches. Otherwise set requestId to null and needsClarification to true.',
    'Comments listed with a request are notes already saved by the department. Use them to recognize the request. Do not invent a comment.',
    'guidance is one sentence for a new request, beginning with "Fill a request stating", using the employee facts. Example: Fill a request stating that your manager is treating you badly and that you want HR to look into it. Use null when needsClarification is true or the message is a status question.',
    'title is a short summary for a new request, or null.',
    'clarification is a short sentence when needsClarification is true, otherwise null.',
  ].join('\n');
}

function userPrompt(text, requests, categories) {
  const requestLines = requests.length
    ? requests
        .map((request) => {
          const comments = Array.isArray(request.comments) && request.comments.length
            ? request.comments.map((comment) => `${comment.authorName}: ${comment.message}`).join('; ')
            : 'none';
          return `- ${request.requestId} | ${request.title} | ${request.status} | Comments: ${comments}`;
        })
        .join('\n')
    : 'None.';
  const categoryLines = categories.length
    ? categories.map((category) => `- ${category.categoryId}: ${category.name} (${category.departmentId})`).join('\n')
    : [
        '- CAT-IT-1: IT Hardware (IT)',
        '- CAT-IT-2: Account Access (IT)',
        '- CAT-IT-3: Software (IT)',
        '- CAT-IT-OTHER: Other (IT)',
        '- CAT-HR-1: Employment Letter (HR)',
        '- CAT-HR-2: Leave (HR)',
        '- CAT-HR-3: Workplace Issue (HR)',
        '- CAT-HR-OTHER: Other (HR)',
        '- CAT-FIN-1: Work Expense (FINANCE)',
        '- CAT-FIN-2: Invoice (FINANCE)',
        '- CAT-FIN-3: Budget (FINANCE)',
        '- CAT-FIN-OTHER: Other (FINANCE)',
      ].join('\n');

  return [
    'Categories:',
    categoryLines,
    '',
    'Employee requests this person is allowed to see:',
    requestLines,
    '',
    'Employee message:',
    text,
  ].join('\n');
}

function extractJson(content) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');

  if (start === -1 || end <= start) {
    return trimmed;
  }

  return trimmed.slice(start, end + 1);
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
