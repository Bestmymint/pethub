export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors?: Record<string, string[]>; formError?: string };
