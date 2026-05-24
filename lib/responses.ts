import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return ok(data, 201);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json(
    { error: message, details },
    { status: 400 }
  );
}

export function notFound(message = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ error: message, code: "CONFLICT" }, { status: 409 });
}

export function gone(message: string) {
  return NextResponse.json({ error: message, code: "GONE" }, { status: 410 });
}

export function tooManyRequests(message = "Too many requests") {
  return NextResponse.json({ error: message }, { status: 429 });
}

export function internalError(message = "Internal server error", err?: unknown) {
  if (process.env.NODE_ENV !== "production" && err) {
    console.error(err);
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

/** Parse a ZodError into a friendly response */
export function validationError(err: ZodError) {
  return NextResponse.json(
    {
      error: "Validation failed",
      issues: err.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    },
    { status: 422 }
  );
}
