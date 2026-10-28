import type { CallToolResult, JSONValue } from "@modelcontextprotocol/server";

export interface CampusApiClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export class CampusApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, error: ApiErrorBody) {
    super(error.message);
    this.name = "CampusApiError";
    this.status = status;
    this.code = error.code;
    this.details = error.details;
  }
}

export interface CampusApiClient {
  request<T>(
    path: string,
    init?: Omit<RequestInit, "body"> & { body?: unknown },
  ): Promise<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function apiErrorBody(
  value: unknown,
  status: number,
  fallbackMessage: string,
): ApiErrorBody {
  const root = isRecord(value) ? value : undefined;
  const nested = root && isRecord(root.error) ? root.error : undefined;
  const source = nested ?? root;

  return {
    code:
      typeof source?.code === "string" ? source.code : `HTTP_${String(status)}`,
    message:
      typeof source?.message === "string" ? source.message : fallbackMessage,
    ...(source && "details" in source ? { details: source.details } : {}),
  };
}

export function createCampusApiClient(
  options: CampusApiClientOptions = {},
): CampusApiClient {
  const baseUrl = (options.baseUrl ?? "http://127.0.0.1:3001").replace(
    /\/+$/,
    "",
  );
  const fetchImpl = options.fetch ?? globalThis.fetch;

  return {
    async request<T>(
      path: string,
      init: Omit<RequestInit, "body"> & { body?: unknown } = {},
    ): Promise<T> {
      const { body: requestBody, ...requestInit } = init;
      const headers = new Headers(init.headers);
      headers.set("accept", "application/json");
      if (requestBody !== undefined) {
        headers.set("content-type", "application/json");
      }

      const response = await fetchImpl(`${baseUrl}${path}`, {
        ...requestInit,
        headers,
        ...(requestBody !== undefined
          ? { body: JSON.stringify(requestBody) }
          : {}),
      });

      const text = await response.text();
      let body: unknown;
      if (text.length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }

      if (!response.ok) {
        throw new CampusApiError(
          response.status,
          apiErrorBody(
            body,
            response.status,
            text || response.statusText || "Campus API request failed",
          ),
        );
      }

      return body as T;
    },
  };
}

export async function toToolResult<T extends Record<string, unknown>>(
  operation: () => Promise<T>,
): Promise<CallToolResult> {
  try {
    const structuredContent = await operation();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(structuredContent),
        },
      ],
      structuredContent: structuredContent as Record<string, JSONValue>,
    };
  } catch (error) {
    const apiError =
      error instanceof CampusApiError
        ? { code: error.code, message: error.message }
        : {
            code: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : String(error),
          };

    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify(apiError),
        },
      ],
    };
  }
}
