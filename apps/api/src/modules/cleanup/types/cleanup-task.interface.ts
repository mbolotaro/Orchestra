export interface CleanupTaskResult {
  deleted: Record<string, number>;
}

export interface CleanupTask {
  readonly name: string;
  run(): Promise<CleanupTaskResult>;
}
