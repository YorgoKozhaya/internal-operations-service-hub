import { useEffect, useState, type FormEvent } from 'react';

const API_URL = 'http://localhost:3000';

type CommentEntry = {
  commentId: string;
  requestId: string;
  userId: string;
  authorName: string;
  message: string;
  createdAt: string;
};

type HistoryEntry = {
  historyId: string;
  requestId: string;
  status: string;
  updatedDate: string;
};

type ApprovalEntry = {
  approvalId: string;
  approverId: string;
  approverName: string;
  requestId: string;
  decision: string | null;
  decisionDate: string | null;
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
  emailUpdates: boolean;
  history: HistoryEntry[];
  comments: CommentEntry[];
  approvals: ApprovalEntry[];
};

type RequestSummary = {
  requestId: string;
  title: string;
  status: string;
  date: string;
  userId: string;
  departmentId: string;
};

type Section = 'requests' | 'notices' | 'suggest' | 'submit' | 'help' | 'users' | 'departments';

type Notice = {
  notificationId: string;
  requestId: string;
  message: string;
  createdAt: string;
  read: boolean;
};

type Category = {
  categoryId: string;
  name: string;
  departmentId: string;
};

type Actor = {
  id: string;
  name: string;
  position: string;
  departmentId: string;
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
  needsApproval: null;
  departmentId: string | null;
  needsClarification: boolean;
  clarification: string | null;
  guidance: string | null;
  requestId: string | null;
  status: string | null;
  answer: string | null;
};

const CATEGORIES: Category[] = [
  { categoryId: 'CAT-IT-1', name: 'IT Hardware', departmentId: 'IT' },
  { categoryId: 'CAT-IT-2', name: 'Account Access', departmentId: 'IT' },
  { categoryId: 'CAT-IT-3', name: 'Software', departmentId: 'IT' },
  { categoryId: 'CAT-IT-OTHER', name: 'Other', departmentId: 'IT' },
  { categoryId: 'CAT-HR-1', name: 'Employment Letter', departmentId: 'HR' },
  { categoryId: 'CAT-HR-2', name: 'Leave', departmentId: 'HR' },
  { categoryId: 'CAT-HR-3', name: 'Workplace Issue', departmentId: 'HR' },
  { categoryId: 'CAT-HR-OTHER', name: 'Other', departmentId: 'HR' },
  { categoryId: 'CAT-FIN-1', name: 'Work Expense', departmentId: 'FINANCE' },
  { categoryId: 'CAT-FIN-2', name: 'Invoice', departmentId: 'FINANCE' },
  { categoryId: 'CAT-FIN-3', name: 'Budget', departmentId: 'FINANCE' },
  { categoryId: 'CAT-FIN-OTHER', name: 'Other', departmentId: 'FINANCE' },
];

const USERS: Actor[] = [
  { id: 'EMP-1', name: 'Nour El Hajj', position: 'Employee', departmentId: 'IT' },
  { id: 'EMP-2', name: 'Karim Farah', position: 'Employee', departmentId: 'HR' },
  { id: 'EMP-3', name: 'Rania Daher', position: 'Employee', departmentId: 'FINANCE' },
  { id: 'EMP-4', name: 'Yorgo Kozhaya', position: 'Employee', departmentId: 'IT' },
  { id: 'DEPT-IT-1', name: 'Tarek Salameh', position: 'Department Employee', departmentId: 'IT' },
  { id: 'DEPT-HR-1', name: 'Lina Awad', position: 'Department Employee', departmentId: 'HR' },
  { id: 'DEPT-FIN-1', name: 'Fadi Chamoun', position: 'Department Employee', departmentId: 'FINANCE' },
  { id: 'APPR-IT-1', name: 'Maya Haddad', position: 'Approver', departmentId: 'IT' },
  { id: 'APPR-HR-1', name: 'Rami Nassar', position: 'Approver', departmentId: 'HR' },
  { id: 'APPR-1', name: 'Hiba Karam', position: 'Approver', departmentId: 'FINANCE' },
  { id: 'ADMIN-1', name: 'Elie Boustany', position: 'Administrator', departmentId: 'IT' },
];

const DEPARTMENTS = [
  { id: 'IT', name: 'IT' },
  { id: 'HR', name: 'HR' },
  { id: 'FINANCE', name: 'Finance' },
];

const POSITIONS = ['Employee', 'Department Employee', 'Approver', 'Administrator'];

const STATUS_OPTIONS = [
  'Submitted',
  'Assigned',
  'In Progress',
  'Waiting for Approval',
  'Approved',
  'Rejected',
  'Resolved',
  'Closed',
];

const STAFF_NEXT: Record<string, string[]> = {
  Submitted: ['Assigned'],
  Assigned: ['In Progress'],
  Approved: ['Resolved'],
  Rejected: ['Closed'],
  Resolved: ['Closed'],
  Closed: [],
};

function departmentName(
  departmentId: string | null,
  list: Array<{ id: string; name: string }> = DEPARTMENTS,
): string {
  return list.find((department) => department.id === departmentId)?.name ?? departmentId ?? '';
}

function listHeading(position: string | undefined): string {
  if (position === 'Department Employee') {
    return 'Requests in your department';
  }

  if (position === 'Approver') {
    return 'Requests waiting for your approval';
  }

  if (position === 'Administrator') {
    return 'Requests across the system';
  }

  return 'Your requests';
}

function helpSteps(position: string | undefined): Array<{ title: string; text: string }> {
  if (position === 'Department Employee') {
    return [
      { title: 'Requests', text: 'These are the requests in your department. Open one to update the status or add a comment.' },
      { title: 'Your own request', text: 'If you submitted it, you can read it. Another department employee updates it.' },
      { title: 'Approval', text: 'When a request is In Progress, choose whether it needs approval and who should approve it.' },
      { title: 'Notices', text: 'You are told when a new request arrives, and again after it is approved or rejected.' },
      { title: 'Suggest and New request', text: 'You can still submit a request of your own. Suggest does not save anything.' },
    ];
  }

  if (position === 'Approver') {
    return [
      { title: 'Requests', text: 'These are waiting for your approval. Open one and choose Approve or Reject.' },
      { title: 'Your own request', text: 'You can submit a request, but you cannot approve it yourself.' },
      { title: 'Notices', text: 'You are told when a request is waiting for you.' },
      { title: 'Suggest and New request', text: 'Describe what you need, then submit it. Suggest does not save anything.' },
    ];
  }

  if (position === 'Administrator') {
    return [
      { title: 'Requests', text: 'You can see every request: its status, department, and who submitted it. The title, category, and comments stay hidden.' },
      { title: 'Status', text: 'You do not change the status. The department employee and the approver do that.' },
      { title: 'Users', text: 'Add employees, department employees, and approvers.' },
      { title: 'Departments', text: 'Add or rename departments and categories.' },
    ];
  }

  return [
    { title: 'New request', text: 'Write a title and a description, choose a category, and submit. Tick the email box if you want each status change sent to your email.' },
    { title: 'Suggest', text: 'Describe what you need in your own words. The assistant suggests a category. It does not save the request.' },
    { title: 'Requests', text: 'These are the requests you submitted. Open one to see the status, history, and comments.' },
    { title: 'Notices', text: 'You are told when the status changes or someone adds a comment.' },
  ];
}

function actorLabel(actor: Actor, list: Array<{ id: string; name: string }> = DEPARTMENTS): string {
  const role = actor.position === 'Department Employee' ? `${departmentName(actor.departmentId, list)} Department Employee` : actor.position;
  return `${actor.name} (${role})`;
}

async function readApiError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as ApiError;
  return body.message ?? `Request failed with ${response.status}.`;
}

export default function App() {
  const [users, setUsers] = useState(USERS);
  const [categories, setCategories] = useState(CATEGORIES);
  const [departments, setDepartments] = useState(DEPARTMENTS);
  const [userId, setUserId] = useState('EMP-1');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('CAT-IT-1');
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [lookupId, setLookupId] = useState('REQ-1001');
  const [nextStatus, setNextStatus] = useState('Assigned');
  const [approvalChoice, setApprovalChoice] = useState('needs');
  const [approverId, setApproverId] = useState('');
  const [approvers, setApprovers] = useState<Actor[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPosition, setNewPosition] = useState('Employee');
  const [newDepartmentId, setNewDepartmentId] = useState('IT');
  const [departmentIdInput, setDepartmentIdInput] = useState('');
  const [departmentNameInput, setDepartmentNameInput] = useState('');
  const [categoryIdInput, setCategoryIdInput] = useState('');
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryDepartmentId, setCategoryDepartmentId] = useState('IT');
  const [commentText, setCommentText] = useState('');
  const [intakeText, setIntakeText] = useState('');
  const [intake, setIntake] = useState<IntakeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [requestList, setRequestList] = useState<RequestSummary[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [section, setSection] = useState<Section>('requests');

  const actor = users.find((user) => user.id === userId);
  const isAdministrator = actor?.position === 'Administrator';
  const ownsRequest = !!request && actor?.id === request.userId;
  const isDepartmentStaff =
    !!request &&
    !ownsRequest &&
    actor?.position === 'Department Employee' &&
    actor.departmentId === request.departmentId;
  const openApproval = request?.approvals.find((approval) => !approval.decision);
  const canDecide = !!openApproval && openApproval.approverId === userId && !ownsRequest;
  const staffNext = request ? (STAFF_NEXT[request.status] ?? []) : [];
  const checkingApproval = isDepartmentStaff && request?.status === 'In Progress';
  const canFilterStatus =
    actor?.position === 'Department Employee' || actor?.position === 'Administrator';

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      const statusQuery =
        canFilterStatus && statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';

      try {
        const [requestsResponse, noticesResponse] = await Promise.all([
          fetch(`${API_URL}/requests${statusQuery}`, { headers: { 'x-user-id': userId } }),
          fetch(`${API_URL}/notifications`, { headers: { 'x-user-id': userId } }),
        ]);

        if (cancelled) {
          return;
        }

        if (requestsResponse.ok) {
          setRequestList((await requestsResponse.json()) as RequestSummary[]);
        }

        if (noticesResponse.ok) {
          setNotices((await noticesResponse.json()) as Notice[]);
        }
      } catch {
        // The lists stay as they are when the API is not up yet.
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [userId, statusFilter, reloadKey, canFilterStatus]);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const [categoryResponse, departmentResponse] = await Promise.all([
          fetch(`${API_URL}/categories`, { headers: { 'x-user-id': userId } }),
          fetch(`${API_URL}/departments`, { headers: { 'x-user-id': userId } }),
        ]);

        if (cancelled) {
          return;
        }

        if (categoryResponse.ok) {
          const loaded = (await categoryResponse.json()) as Category[];

          if (loaded.length > 0) {
            setCategories(loaded);
          }
        }

        if (departmentResponse.ok) {
          const loaded = (await departmentResponse.json()) as Array<{ departmentId: string; name: string }>;

          if (loaded.length > 0) {
            setDepartments(loaded.map((department) => ({ id: department.departmentId, name: department.name })));
          }
        }
      } catch {
        // The form keeps the known categories when the API is not up yet.
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  useEffect(() => {
    if (!checkingApproval || !request) {
      return;
    }

    let cancelled = false;

    async function loadApprovers() {
      try {
        const response = await fetch(
          `${API_URL}/users/approvers?departmentId=${request?.departmentId}`,
          { headers: { 'x-user-id': userId } },
        );

        if (!response.ok || cancelled) {
          return;
        }

        const loaded = (await response.json()) as Array<{
          userId: string;
          name: string;
          position: string;
          departmentId: string;
        }>;

        if (cancelled) {
          return;
        }

        const nextApprovers = loaded
          .filter((approver) => approver.userId !== request?.userId)
          .map((approver) => ({
            id: approver.userId,
            name: approver.name,
            position: approver.position,
            departmentId: approver.departmentId,
          }));
        setApprovers(nextApprovers);
        setApproverId((current) =>
          nextApprovers.some((approver) => approver.id === current) ? current : (nextApprovers[0]?.id ?? ''),
        );
      } catch {
        if (!cancelled) {
          setApprovers([]);
        }
      }
    }

    void loadApprovers();

    return () => {
      cancelled = true;
    };
  }, [checkingApproval, request, userId]);

  function showSection(next: Section) {
    setSection(next);
    setError('');
    setNotice('');
  }

  function showRequest(found: ServiceRequest) {
    setRequest(found);
    setLookupId(found.requestId);
    setNextStatus((STAFF_NEXT[found.status] ?? [])[0] ?? '');
    setApprovalChoice('needs');
    setReloadKey((key) => key + 1);
  }

  async function openRequest(id: string) {
    setBusy(true);
    setError('');
    setLookupId(id);

    try {
      const response = await fetch(`${API_URL}/requests/${id}`, {
        headers: { 'x-user-id': userId },
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      showRequest((await response.json()) as ServiceRequest);
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function openNotice(item: Notice) {
    if (!item.read) {
      await fetch(`${API_URL}/notifications/${encodeURIComponent(item.notificationId)}/read`, {
        method: 'PATCH',
        headers: { 'x-user-id': userId },
      }).catch(() => undefined);

      setNotices((current) =>
        current.map((noticeItem) =>
          noticeItem.notificationId === item.notificationId ? { ...noticeItem, read: true } : noticeItem,
        ),
      );
    }

    setSection('requests');
    await openRequest(item.requestId);
  }

  async function suggestIntake(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
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

    setSection('submit');
  }

  async function submitRequest(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    setRequest(null);

    try {
      const response = await fetch(`${API_URL}/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ title, description, categoryId, emailUpdates }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      showRequest((await response.json()) as ServiceRequest);
      setSection('requests');
      setTitle('');
      setDescription('');
      setEmailUpdates(false);
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
    setNotice('');
    setRequest(null);

    try {
      const response = await fetch(`${API_URL}/requests/${lookupId}`, {
        headers: { 'x-user-id': userId },
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      showRequest((await response.json()) as ServiceRequest);
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function patchStatus(status: string, chosenApproverId?: string) {
    if (!request) {
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/requests/${request.requestId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify(
          chosenApproverId ? { status, approverId: chosenApproverId } : { status },
        ),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      showRequest((await response.json()) as ServiceRequest);
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(event: FormEvent) {
    event.preventDefault();
    await patchStatus(nextStatus);
  }

  async function saveApprovalCheck(event: FormEvent) {
    event.preventDefault();

    if (approvalChoice === 'needs') {
      await patchStatus('Waiting for Approval', approverId);
      return;
    }

    await patchStatus('Resolved');
  }

  async function addUser(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          userId: newUserId,
          name: newName,
          email: newEmail,
          position: newPosition,
          departmentId: newDepartmentId,
        }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      const created = (await response.json()) as {
        userId: string;
        name: string;
        position: string;
        departmentId: string;
      };
      setUsers((current) => [
        ...current.filter((user) => user.id !== created.userId),
        {
          id: created.userId,
          name: created.name,
          position: created.position,
          departmentId: created.departmentId,
        },
      ]);
      setNotice(`${created.name} was added.`);
      setNewUserId('');
      setNewName('');
      setNewEmail('');
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function addDepartment(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ departmentId: departmentIdInput, name: departmentNameInput }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setDepartmentIdInput('');
      setDepartmentNameInput('');
      setNotice('Department was added.');
      setReloadKey((key) => key + 1);
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function renameDepartment(event: FormEvent<HTMLFormElement>, departmentId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '');
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/departments/${departmentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setNotice('Department was renamed.');
      setReloadKey((key) => key + 1);
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          categoryId: categoryIdInput,
          name: categoryNameInput,
          departmentId: categoryDepartmentId,
        }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setCategoryIdInput('');
      setCategoryNameInput('');
      setNotice('Category was added.');
      setReloadKey((key) => key + 1);
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function renameCategory(event: FormEvent<HTMLFormElement>, categoryIdToRename: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '');
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/categories/${categoryIdToRename}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      setNotice('Category was renamed.');
      setReloadKey((key) => key + 1);
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  async function addComment(event: FormEvent) {
    event.preventDefault();

    if (!request) {
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${API_URL}/requests/${request.requestId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ message: commentText }),
      });

      if (!response.ok) {
        setError(await readApiError(response));
        return;
      }

      showRequest((await response.json()) as ServiceRequest);
      setCommentText('');
      setNotice('Comment was added.');
    } catch {
      setError('Could not reach the API. Start the backend on port 3000.');
    } finally {
      setBusy(false);
    }
  }

  function requestHint(current: ServiceRequest): string {
    const handlesOwnRequest =
      ownsRequest &&
      actor?.departmentId === current.departmentId &&
      (actor.position === 'Department Employee' || actor.position === 'Approver');
    const waitingForSomeoneElse =
      current.status === 'Waiting for Approval' && !!openApproval && openApproval.approverId !== userId;

    if (waitingForSomeoneElse) {
      return `${openApproval?.approverName ?? 'The assigned approver'} decides this request.`;
    }

    if (handlesOwnRequest) {
      return 'You submitted this request, so someone else updates it.';
    }

    if (current.status === 'Waiting for Approval') {
      return `${openApproval?.approverName ?? 'The assigned approver'} decides this request.`;
    }

    return `Only a department employee for ${departmentName(current.departmentId, departments)} can change status.`;
  }

  const categoriesByDepartment = departments
    .map((department) => ({
    ...department,
    categories: [
      ...categories.filter((category) => category.departmentId === department.id && category.name !== 'Other'),
      ...categories.filter((category) => category.departmentId === department.id && category.name === 'Other'),
    ],
  }))
    .filter((department) => department.categories.length > 0);

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Internal Operations Service Hub</p>
        <h1>Internal operations</h1>
        <p className="lede">
          Employees submit requests to IT, HR, or Finance. The responsible department checks whether that request needs approval.
        </p>
      </header>

      <div className="toolbar">
        <label className="field acting-as">
          Acting as
          <select
            value={userId}
            onChange={(event) => {
              const nextId = event.target.value;
              const next = users.find((user) => user.id === nextId);
              setUserId(nextId);
              setStatusFilter('');
              setRequest(null);
              setError('');
              setNotice('');
              if (next?.position !== 'Administrator' && (section === 'users' || section === 'departments')) {
                setSection('requests');
              }
            }}
            aria-label="Acting as"
          >
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {actorLabel(user, departments)}
              </option>
            ))}
          </select>
        </label>

        <nav className="nav" aria-label="Sections">
          <button type="button" className={section === 'requests' ? 'active' : undefined} onClick={() => showSection('requests')}>
            Requests
          </button>
          <button type="button" className={section === 'notices' ? 'active' : undefined} onClick={() => showSection('notices')}>
            Notices{notices.some((item) => !item.read) ? ` (${notices.filter((item) => !item.read).length})` : ''}
          </button>
          <button type="button" className={section === 'suggest' ? 'active' : undefined} onClick={() => showSection('suggest')}>
            Suggest
          </button>
          <button type="button" className={section === 'submit' ? 'active' : undefined} onClick={() => showSection('submit')}>
            New request
          </button>
          <button type="button" className={section === 'help' ? 'active' : undefined} onClick={() => showSection('help')}>
            Help
          </button>
          {isAdministrator ? (
            <button type="button" className={section === 'users' ? 'active' : undefined} onClick={() => showSection('users')}>
              Users
            </button>
          ) : null}
          {isAdministrator ? (
            <button type="button" className={section === 'departments' ? 'active' : undefined} onClick={() => showSection('departments')}>
              Departments
            </button>
          ) : null}
        </nav>
      </div>

      {section === 'help' ? (
        <section className="card">
          <h2>How to use this</h2>
          <ol className="guide">
            {helpSteps(actor?.position).map((step) => (
              <li key={step.title}>
                <strong>{step.title}</strong>
                <span>{step.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {section === 'requests' ? (
        <section className="card">
          <h2>{listHeading(actor?.position)}</h2>
          {canFilterStatus ? (
            <label className="field">
              Status
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {requestList.length === 0 ? (
            <p className="hint">No requests to show.</p>
          ) : (
            <ul className="history" data-testid="request-list">
              {requestList.map((item) => (
                <li key={item.requestId}>
                  <button type="button" onClick={() => openRequest(item.requestId)}>
                    {isAdministrator
                      ? `${item.requestId} · ${departmentName(item.departmentId, departments)} · ${
                          users.find((user) => user.id === item.userId)?.name ?? item.userId
                        }`
                      : `${item.requestId} · ${item.title}`}
                  </button>
                  <span>{item.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {section === 'notices' ? (
        <section className="card">
          <h2>Notices</h2>
          {notices.length === 0 ? (
            <p className="hint">No notices.</p>
          ) : (
            <ul className="history" data-testid="notices">
              {notices.map((item) => (
                <li key={item.notificationId} className={item.read ? undefined : 'unread'}>
                  <button type="button" onClick={() => openNotice(item)}>
                    {item.message}
                  </button>
                  <span>{item.read ? 'Read' : 'New'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {section === 'users' && isAdministrator ? (
        <form className="card" onSubmit={addUser}>
          <h2>Add a user</h2>
          <p className="hint">Only an administrator can add employees, department staff, and approvers.</p>
          <label className="field">
            User ID
            <input value={newUserId} onChange={(event) => setNewUserId(event.target.value)} placeholder="EMP-9" />
          </label>
          <label className="field">
            Name
            <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Sara Khoury" />
          </label>
          <label className="field">
            Email
            <input value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="sara.khoury@company.local" />
          </label>
          <label className="field">
            Position
            <select aria-label="Position" value={newPosition} onChange={(event) => setNewPosition(event.target.value)}>
              {POSITIONS.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Department
            <select
              aria-label="Department"
              value={newDepartmentId}
              onChange={(event) => setNewDepartmentId(event.target.value)}
            >
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            Add user
          </button>
        </form>
      ) : null}

      {section === 'departments' && isAdministrator ? (
        <section className="card">
          <h2>Departments and categories</h2>
          <p className="hint">Only an administrator can add or rename departments and categories.</p>
          <form onSubmit={addDepartment}>
            <label className="field">
              Department ID
              <input
                aria-label="New department ID"
                value={departmentIdInput}
                onChange={(event) => setDepartmentIdInput(event.target.value)}
                placeholder="LEGAL"
              />
            </label>
            <label className="field">
              Department name
              <input
                aria-label="New department name"
                value={departmentNameInput}
                onChange={(event) => setDepartmentNameInput(event.target.value)}
                placeholder="Legal"
              />
            </label>
            <button type="submit" disabled={busy}>
              Add department
            </button>
          </form>
          <ul className="history">
            {departments.map((department) => (
              <li key={department.id}>
                <form onSubmit={(event) => renameDepartment(event, department.id)}>
                  <strong>{department.id}</strong>
                  <input aria-label={`Rename ${department.name}`} name="name" defaultValue={department.name} />
                  <button type="submit" disabled={busy}>
                    Rename
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form onSubmit={addCategory}>
            <label className="field">
              Category ID
              <input
                aria-label="New category ID"
                value={categoryIdInput}
                onChange={(event) => setCategoryIdInput(event.target.value)}
                placeholder="CAT-HR-4"
              />
            </label>
            <label className="field">
              Category name
              <input
                aria-label="New category name"
                value={categoryNameInput}
                onChange={(event) => setCategoryNameInput(event.target.value)}
                placeholder="Benefits"
              />
            </label>
            <label className="field">
              Department
              <select
                aria-label="Category department"
                value={categoryDepartmentId}
                onChange={(event) => setCategoryDepartmentId(event.target.value)}
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" disabled={busy}>
              Add category
            </button>
          </form>
          <ul className="history">
            {categories.map((category) => (
              <li key={category.categoryId}>
                <form onSubmit={(event) => renameCategory(event, category.categoryId)}>
                  <strong>
                    {category.categoryId} · {departmentName(category.departmentId, departments)}
                  </strong>
                  <input aria-label={`Rename ${category.name}`} name="name" defaultValue={category.name} />
                  <button type="submit" disabled={busy}>
                    Rename
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {section === 'suggest' ? (
      <section className="card intake">
        <h2>Describe it in your own words</h2>
        <p className="hint">
          The assistant suggests a category or the status of a request you can see. It does not save anything, and it does not decide approval.
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
                    {categories.find((category) => category.categoryId === intake.categoryId)?.name ??
                      intake.categoryName}
                  </strong>
                </p>
                <p>
                  The {departmentName(intake.departmentId, departments)} department checks whether this request needs approval.
                </p>
                {intake.guidance ? <p data-testid="intake-guidance">{intake.guidance}</p> : null}
                <button type="button" onClick={useSuggestion} disabled={busy}>
                  Use this suggestion
                </button>
              </>
            )}
          </div>
        ) : null}
      </section>
      ) : null}

      {section === 'submit' ? (
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
            <select aria-label="Category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {categoriesByDepartment.map((department) => (
                <optgroup key={department.id} label={department.name}>
                  {department.categories.map((category) => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {category.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="choice">
            <input
              type="checkbox"
              checked={emailUpdates}
              onChange={(event) => setEmailUpdates(event.target.checked)}
            />
            Email me when the status of this request changes
          </label>
          <button type="submit" disabled={busy}>
            Submit request
          </button>
        </form>
      ) : null}

      {section === 'requests' ? (
        <form className="card lookup" onSubmit={lookupRequest}>
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
      ) : null}

      {error ? <p className="banner error">{error}</p> : null}
      {notice ? <p className="banner">{notice}</p> : null}

      {section === 'requests' && request ? (
        <section className="card result">
          <h2>Request {request.requestId}</h2>
          <dl>
            <div>
              <dt>Status</dt>
              <dd data-testid="request-status">{request.status}</dd>
            </div>
            {request.emailUpdates ? (
              <div>
                <dt>Email</dt>
                <dd>Status changes are sent by email</dd>
              </div>
            ) : null}
            {isAdministrator ? null : (
              <div>
                <dt>Title</dt>
                <dd>{request.title}</dd>
              </div>
            )}
            <div>
              <dt>Requester</dt>
              <dd>{users.find((user) => user.id === request.userId)?.name ?? request.userId}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{departmentName(request.departmentId, departments)}</dd>
            </div>
            {isAdministrator ? null : (
              <div>
                <dt>Category</dt>
                <dd>{categories.find((category) => category.categoryId === request.categoryId)?.name ?? request.categoryId}</dd>
              </div>
            )}
          </dl>

          {request.approvals.length > 0 ? (
            <div>
              <h3>Approval</h3>
              <ul className="history">
                {request.approvals.map((approval) => (
                  <li key={approval.approvalId}>
                    <strong>{approval.approverName}</strong>
                    <span>
                      {approval.decision ?? 'Waiting for a decision'}
                      {approval.decisionDate ? ` · ${new Date(approval.decisionDate).toLocaleString()}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {checkingApproval ? (
            <form className="status-form stacked" onSubmit={saveApprovalCheck}>
              <label className="field">
                Approval check
                <select
                  aria-label="Approval check"
                  value={approvalChoice}
                  onChange={(event) => setApprovalChoice(event.target.value)}
                >
                  <option value="needs">Needs approval</option>
                  <option value="skip">No approval needed</option>
                </select>
              </label>
              {approvalChoice === 'needs' ? (
                <label className="field">
                  Approver
                  <select aria-label="Approver" value={approverId} onChange={(event) => setApproverId(event.target.value)}>
                    {approvers.map((approver) => (
                      <option key={approver.id} value={approver.id}>
                        {approver.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button type="submit" disabled={busy}>
                Save approval check
              </button>
            </form>
          ) : null}

          {canDecide ? (
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => patchStatus('Approved')}>
                Approve
              </button>
              <button type="button" className="secondary" disabled={busy} onClick={() => patchStatus('Rejected')}>
                Reject
              </button>
            </div>
          ) : null}

          {isDepartmentStaff && staffNext.length > 0 ? (
            <form className="status-form" onSubmit={updateStatus}>
              <label className="field">
                Next status
                <select
                  aria-label="Next status"
                  value={nextStatus}
                  onChange={(event) => setNextStatus(event.target.value)}
                >
                  {staffNext.map((status) => (
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
          ) : null}

          {!checkingApproval && !canDecide && !(isDepartmentStaff && staffNext.length > 0) ? (
            <p className="hint">{requestHint(request)}</p>
          ) : null}

          {isDepartmentStaff ? (
            <form className="status-form" onSubmit={addComment}>
              <label className="field">
                Comment
                <textarea
                  aria-label="Comment"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                  placeholder="What should the requester know?"
                  rows={3}
                />
              </label>
              <button type="submit" disabled={busy}>
                Add comment
              </button>
            </form>
          ) : null}

          {isAdministrator ? null : (
            <>
              <h3>Comments</h3>
              {(request.comments ?? []).length === 0 ? (
                <p className="hint">No comments.</p>
              ) : (
                <ul className="history">
                  {(request.comments ?? []).map((comment) => (
                    <li key={comment.commentId}>
                      <strong>{comment.authorName}</strong>
                      <span>
                        {comment.message} · {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
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
