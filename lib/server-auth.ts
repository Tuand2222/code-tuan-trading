export function requireUserEmail(request: Request): string {
  const email = request.headers.get("oai-authenticated-user-email")?.trim();
  if (!email) throw new Response("Authentication required", { status: 401 });
  return email.toLowerCase();
}

export function routeError(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = /required|invalid|unsupported/i.test(message) ? 400 : 500;
  return Response.json({ error: message }, { status });
}
