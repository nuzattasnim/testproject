import { BlocksApiError } from "@seliseblocks/client";

// IAM answers some rejections as HTTP 4xx (the SDK throws BlocksApiError)
// and others as HTTP 200 with `isSuccess: false` plus an `errors` map --
// ensureSuccess() turns the second shape into a thrown error so every
// caller handles both the same way.
export class BlocksResultError extends Error {
  constructor(message: string, public readonly body: unknown) {
    super(message);
  }
}

export function errorStatus(error: unknown): number | undefined {
  return error instanceof BlocksApiError ? error.status : undefined;
}

function flattenErrors(errors: unknown): string | undefined {
  if (!errors) return undefined;
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) return errors.map(flattenErrors).filter(Boolean).join(" ") || undefined;
  if (typeof errors === "object") {
    return Object.values(errors as Record<string, unknown>).map(flattenErrors).filter(Boolean).join(" ") || undefined;
  }
  return undefined;
}

function bodyMessage(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return typeof body === "string" && body ? body : undefined;
  const record = body as Record<string, unknown>;
  const direct = record.message ?? record.error_description ?? record.detail ?? record.title;
  return flattenErrors(record.errors) ?? (typeof direct === "string" && direct ? direct : undefined);
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof BlocksApiError) return bodyMessage(error.body) ?? fallback;
  if (error instanceof BlocksResultError) return error.message || fallback;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function ensureSuccess<T>(response: T): T {
  const record = response as Record<string, unknown> | undefined;
  if (record && record.isSuccess === false) {
    throw new BlocksResultError(bodyMessage(record) ?? "The request was rejected.", record);
  }
  return response;
}
