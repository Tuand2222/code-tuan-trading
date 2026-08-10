import { getAuthCapabilities } from "../../../../lib/auth";

export async function GET() {
  return Response.json(getAuthCapabilities(), {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
