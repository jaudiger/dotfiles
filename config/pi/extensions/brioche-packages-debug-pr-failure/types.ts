export type Json = Record<string, unknown>;

export type PendingRun = {
  directory: string;
  pr: string;
};

export type PreparedContext = {
  directory: string;
  metadata: Json;
  summary: string;
};
