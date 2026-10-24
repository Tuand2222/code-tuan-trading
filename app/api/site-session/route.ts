import { requireUser, routeError } from "../../../lib/server-auth";

export async function GET(request: Request) {
  try {
    return Response.json({ user: await requireUser(request) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return routeError(error); }
}
