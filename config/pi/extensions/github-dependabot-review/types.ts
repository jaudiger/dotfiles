export type Json = Record<string, unknown>;

export type CommandResult = { output: string; exitCode: number };

export type PreparedReview = {
  directory: string;
  number: number;
  repository: string;
  metadata: Json;
  cwd: string;
  sessionId: string;
};

export type ReviewContext = {
  reviews: PreparedReview[];
};

export type PendingRun = {
  kind: "researcher" | "scout";
  review: PreparedReview;
};

export type RpcCompletion = {
  runId: string;
  output: string;
  status: string;
  success?: boolean;
};
