/** Backend API client. Only meaningful state-changing events go over the network. */
const BASE = '/api';

export interface SessionState {
  id: string;
  case_id: string;
  status: string;
  current_room: string | null;
  event_counter: number;
  discovered_evidence: string[];
  visited_dialogue: string[];
  accused: string | null;
  correct: boolean | null;
  difficulty: string;
  hints_used: number;
  score: number | null;
}

export interface EvidenceDetail {
  id: string;
  title: string;
  description: string;
  location: string;
}

export interface FactDetail {
  name: string;
  args: string[];
  source?: string | null;
}

export interface DerivedDetail {
  fact: FactDetail;
  fact_id: string;
  rule_id: string | null;
  supports: string[];
}

export interface InteractResult {
  evidence: EvidenceDetail;
  already_discovered: boolean;
  new_facts: FactDetail[];
  derived: DerivedDetail[];
  event_counter: number;
}

export interface Knowledge {
  known: FactDetail[];
  derived: DerivedDetail[];
}

export interface CaseSummary {
  id: string;
  title: string;
  description: string;
  version: string;
  suspects: string[];
  rooms: number;
  evidence: number;
  rules: number;
}

export interface CaseObject {
  id: string;
  room: string;
  label: string;
  evidence: string | null;
}

export interface CaseNpc {
  id: string;
  name: string;
  role: string;
}

export interface CaseInfo {
  objects: CaseObject[];
  suspects: string[];
  npcs: CaseNpc[];
  evidence: Array<{ id: string; title: string }>;
  rooms: Array<{ id: string; name: string; description: string }>;
  doors: Array<{ id: string; between: string[] }>;
}

export interface EvidenceCitation {
  id: string;
  title: string;
  via: string[];
}

export interface ScoreBreakdown {
  base: number;
  hints: number;
  hint_cost: number;
  actions: number;
  action_cost: number;
  multiplier: number;
  floor_applied: boolean;
  total: number;
}

export interface AccuseResult {
  accused: string;
  accused_name: string;
  correct: boolean;
  support_level: string;
  summary: string;
  supporting: EvidenceCitation[];
  contradicting: EvidenceCitation[];
  other_suspects_provable: string[];
  leads_remaining: string[];
  proof: unknown;
  why: string;
  score: number;
  breakdown: ScoreBreakdown | null;
}

export interface HintDetail {
  id: string;
  kind: string;
  text: string;
  cost: number;
}

export interface HintResponse {
  hint: HintDetail;
  hints_used: number;
  event_counter: number;
}

export interface QueryResult {
  success: boolean;
  proof: unknown;
  why: string;
}

export interface ResolutionResult {
  success: boolean;
  steps: { selected: string; parent: string; parent_kind: string; mgu: Record<string, string>; resolvent: string[] }[];
  substitution: Record<string, string>;
  used_clauses: string[];
}

export interface WorldNpc {
  id: string;
  name: string;
  role: string;
  location: string;
}

export interface WorldEvent {
  id: string;
  description: string;
}

export interface World {
  npcs: WorldNpc[];
  events_fired: string[];
  events: WorldEvent[];
  unlocked_evidence: string[];
  event_counter: number;
}

export interface DialogueListEntry {
  id: string;
  speaker: string;
  requires: string[];
  available: boolean;
  visited: boolean;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  responses: { text: string; next: string }[];
}

export interface DialogueVisitResult {
  node: DialogueNode;
  already_visited: boolean;
  unlocked_evidence: EvidenceDetail[];
  event_counter: number;
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body.detail) detail = body.detail;
    } catch {
      /* keep status text */
    }
    throw new ApiError(`API ${path} failed: ${detail}`, response.status);
  }
  return response.json() as Promise<T>;
}

function fmt(pred: { name: string; args: string[] }): string {
  return `${pred.name}(${pred.args.join(', ')})`;
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  cases: () => request<{ cases: CaseSummary[] }>('/cases'),
  caseDetail: (caseId: string) => request<CaseInfo>(`/cases/${caseId}`),
  createSession: (caseId: string, difficulty = 'standard') =>
    request<SessionState>('/sessions', {
      method: 'POST',
      body: JSON.stringify({ case_id: caseId, difficulty }),
    }),
  getSession: (sessionId: string) => request<SessionState>(`/sessions/${sessionId}`),
  move: (sessionId: string, room: string) =>
    request<SessionState>(`/sessions/${sessionId}/move-event`, {
      method: 'POST',
      body: JSON.stringify({ room }),
    }),
  interact: (sessionId: string, objectId: string) =>
    request<InteractResult>(`/sessions/${sessionId}/interactions/${objectId}`, {
      method: 'POST',
    }),
  evidence: (sessionId: string) =>
    request<{ evidence: EvidenceDetail[] }>(`/sessions/${sessionId}/evidence`),
  knowledge: (sessionId: string) => request<Knowledge>(`/sessions/${sessionId}/knowledge`),
  query: (sessionId: string, name: string, args: string[]) =>
    request<QueryResult>(`/sessions/${sessionId}/reason/query`, {
      method: 'POST',
      body: JSON.stringify({ goal: { name, args } }),
    }),
  resolution: (sessionId: string, name: string, args: string[]) =>
    request<ResolutionResult>(`/sessions/${sessionId}/reason/resolution`, {
      method: 'POST',
      body: JSON.stringify({ goal: { name, args } }),
    }),
  world: (sessionId: string) => request<World>(`/sessions/${sessionId}/world`),
  dialogueList: (sessionId: string) =>
    request<{ nodes: DialogueListEntry[] }>(`/sessions/${sessionId}/dialogue`),
  visitDialogue: (sessionId: string, nodeId: string) =>
    request<DialogueVisitResult>(`/sessions/${sessionId}/dialogue`, {
      method: 'POST',
      body: JSON.stringify({ node_id: nodeId }),
    }),
  accuse: (sessionId: string, suspect: string) =>
    request<AccuseResult>(`/sessions/${sessionId}/accuse`, {
      method: 'POST',
      body: JSON.stringify({ suspect }),
    }),
  hint: (sessionId: string) =>
    request<HintResponse>(`/sessions/${sessionId}/hints`, { method: 'POST' }),
};

export { ApiError, fmt };
