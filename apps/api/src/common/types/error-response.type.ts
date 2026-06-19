export interface ErrorResponse {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
  timestamp: string;
  path: string;
  requestId: string;
}
