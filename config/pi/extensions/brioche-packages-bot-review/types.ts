export type Json = Record<string, unknown>;

export type CommandResult = { output: string; exitCode: number };

export type ReviewCandidate = {
  number: number;
  title: string;
  url: string;
  author?: string;
  repository?: string;
};

export type ReviewDetails = {
  number: number;
  title: string;
  author?: string;
  repository?: string;
  isDraft: boolean;
  status: string;
  checkSummary: string;
  reviewDecision: string;
  url: string;
  mergeQueueState?: string;
  mergeQueuePosition?: number;
  queueRemovalReason?: string;
  queueWorkflowUrl?: string;
};

export type PullRequestSnapshot = {
  number: number;
  repository: string;
  title: string;
  url: string;
  author?: string;
  state: string;
  isDraft: boolean;
  reviewDecision: string;
  mergeable: string;
  mergeStateStatus: string;
  headRefName: string;
  headRefOid: string;
  headRepository?: string;
  baseRefName: string;
};

export type PickerMode = "review" | "merge" | "supersede";

export type PickerSelection = {
  mode: PickerMode;
  candidates: ReviewCandidate[];
};

export type MutationTarget = {
  number: number;
  repository: string;
  snapshot: PullRequestSnapshot;
  cwd: string;
};

export type PreparedReview = {
  directory: string;
  number: number;
  repository: string;
  metadata: Json;
  snapshot: PullRequestSnapshot;
  cwd: string;
  sessionId: string;
};

export type ReviewSessionState =
  | "preparing"
  | "researching"
  | "ready"
  | "mutating"
  | "stale";

export type ReviewContext = {
  candidates: ReviewCandidate[];
  reviews: PreparedReview[];
  generation: number;
  state: ReviewSessionState;
};

export type PendingRun = {
  kind: "workflow";
  review: PreparedReview;
};

export type RpcCompletion = {
  runId: string;
  output: string;
  status: string;
  success?: boolean;
};
