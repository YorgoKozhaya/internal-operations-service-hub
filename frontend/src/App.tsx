import { useState, type FormEvent } from 'react';

const API_URL = 'http://localhost:3000';

type HistoryEntry = {
  historyId: string;
  requestId: string;
  status: string;
  updatedDate: string;
};

type ServiceRequest = {
  requestId: string;
  title: string;
  description: string;
  status: string;
  date: string;
  userId: string;
  departmentId: string;
  categoryId: string;
  history: HistoryEntry[];
};

type ApiError = {
  message?: string;
  statusCode?: number;
};

type IntakeResult = {
  requestType: 'new_request' | 'status_question';
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
};

const CATEGORIES = [
  { id: 'CAT-IT-1', name: 'IT' },
  { id: 'CAT-HR-1', name: 'HR' },
  { id: 'CAT-FIN-1', name: 'Finance' },
];

const USERS = [
  { id: 'EMP-1', name: 'Nour El Hajj (Employee)' },
  { id: 'EMP-2', name: 'Karim Farah (Employee)' },
  { id: 'DEPT-IT-1', name: 'Tarek Salameh (IT Department Employee)' },
];

const DEPARTMENT_STAFF: Record<string, string> = {
  'DEPT-IT-1': 'IT',
  'DEPT-HR-1': 'HR',
  'DEPT-FIN-1': 'FINANCE',
};

const NEXT_STATUSES: Record<string, string[]> = {
  Submitted: ['Assigned'],
  Assigned: ['In Progress'],
  'In Progress': ['Waiting for Approval', 'Resolved'],
  'Waiting for Approval': ['Approved', 'Rejected'],
  Approved: ['Resolved'],
  Rejected: ['Closed'],
  Resolved: ['Closed'],
  Closed: [],
};

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  return body.message ?? `Request failed with ${response.status}.`;
}

export default function App() {
  const [userId, setUserId] = useState('EMP-1');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('CAT-IT-1');
  const [lookupId, setLookupId] = useState('REQ-1001');
  const [nextStatus, setNextStatus] = useState('Assigned');
  const [intakeText, setIntakeText] = useState('');
  const [intake, setIntake] = useState<IntakeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [request, setRequest] = useState<ServiceRequest | null>(null);

  const nextStatuses = request ? (NEXT_STATUSES[request.status] ?? []) : [];
  const canUpdateStatus =
    !!request &&
    DEPARTMENT_STAFF[userId] === request.departmentId &&
    nextStatuses.length > 0;

  async function suggestIntake(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setIntake(null);

    try {
      const response = await fetch(`${API_URL}/requests/intake`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ text: intakeText }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setIntake((await response.json()) as IntakeResult);
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  function useSuggestion() {
    if (!intake || intake.requestType !== 'new_request' || intake.needsClarification) {
      return;
    }

    if (intake.title) {
      setTitle(intake.title);
    }

    setDescription(intakeText);
    if (intake.categoryId) {
      setCategoryId(intake.categoryId);
    }
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setRequest(null);

    try {
      const response = await fetch(`${API_URL}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ title, description, categoryId }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const created = (await response.json()) as ServiceRequest;
      setRequest(created);
      setLookupId(created.requestId);
      setNextStatus((NEXT_STATUSES[created.status] ?? [])[0] ?? '');
      setTitle('');
      setDescription('');
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function lookupRequest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setRequest(null);

    try {
      const response = await fetch(`${API_URL}/requests/${lookupId}`, {
        headers: { 'x-user-id': userId },
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const found = (await response.json()) as ServiceRequest;
      setRequest(found);
      setNextStatus((NEXT_STATUSES[found.status] ?? [])[0] ?? '');
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(event: FormEvent) {
    event.preventDefault();
    if (!request) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/requests/${request.requestId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const updated = (await response.json()) as ServiceRequest;
      setRequest(updated);
      setNextStatus((NEXT_STATUSES[updated.status] ?? [])[0] ?? '');
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Internal Operations Service Hub</p>
        <h1>Submit a service request</h1>
        <p className="lede">
          Employees submit requests. Department employees update status for their department.
        </p>
      </header>

      <label className="field acting-as">
        Acting as
        <select
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          aria-label="Acting as"
        >
          {USERS.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>

      <section className="card intake">
        <h2>Describe it in your own words</h2>
        <p className="hint">
          The assistant suggests a category or the status of a request you can see. It does not save anything.
        </p>
        <form onSubmit={suggestIntake}>
          <label className="field">
            What do you need?
            <textarea
              value={intakeText}
              onChange={(event) => setIntakeText(event.target.value)}
              placeholder="My laptop keyboard stopped working."
              rows={3}
            />
          </label>
          <button type="submit" disabled={busy}>
            Suggest
          </button>
        </form>

        {intake ? (
          <div className="suggestion" data-testid="intake-result">
            {intake.needsClarification ? (
              <p>{intake.clarification}</p>
            ) : intake.requestType === 'status_question' ? (
              <p data-testid="intake-answer">{intake.answer}</p>
            ) : (
              <>
                <p>
                  Suggested title: <strong>{intake.title}</strong>
                </p>
                <p>
                  Category:{' '}
                  <strong data-testid="intake-category">
                    {CATEGORIES.find((category) => category.id === intake.categoryId)?.name ??
                      intake.categoryName}
                  </strong>
                </p>
                <p>{intake.needsApproval ? 'Needs approval.' : 'No approval step.'}</p>
                {intake.guidance ? <p data-testid="intake-guidance">{intake.guidance}</p> : null}
                <button type="button" onClick={useSuggestion} disabled={busy}>
                  Use this suggestion
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>

      <section className="grid">
        <form className="card" onSubmit={submitRequest}>
          <h2>New request</h2>
          <label className="field">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Laptop keyboard is not working"
            />
          </label>
          <label className="field">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What needs to be done?"
              rows={4}
            />
          </label>
          <label className="field">
            Category
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            Submit request
          </button>
        </form>

        <form className="card" onSubmit={lookupRequest}>
          <h2>View a request</h2>
          <label className="field">
            Request ID
            <input
              value={lookupId}
              onChange={(event) => setLookupId(event.target.value)}
              placeholder="REQ-1001"
            />
          </label>
          <button type="submit" disabled={busy}>
            Open request
          </button>
        </form>
      </section>

      {error ? <p className="banner error">{error}</p> : null}

      {request ? (
        <section className="card result">
          <h2>Request {request.requestId}</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd data-testid="request-status">{request.status}</dd>
            </div>
            <div>
              <dt>Title</dt>
              <dd>{request.title}</dd>
            </div>
            <div>
              <dt>Requester</dt>
              <dd>{request.userId}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{request.departmentId}</dd>
            </div>
          </dl>

          {canUpdateStatus ? (
            <form className="status-form" onSubmit={updateStatus}>
              <label className="field">
                Next status
                <select
                  aria-label="Next status"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value)}
                >
                  {nextStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" disabled={busy}>
                Update status
              </button>
            </form>
          ) : (
            <p className="hint">Only a department employee for {request.departmentId} can change status.</p>
          )}

          <h3>History</h3>
          <ul className="history">
            {request.history.map((entry) => (
              <li key={entry.historyId}>
                <strong>{entry.status}</strong>
                <span>{new Date(entry.updatedDate).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
