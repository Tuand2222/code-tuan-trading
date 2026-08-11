import { getBuildInfo } from "../../../lib/build-info";

export async function GET() {
  return Response.json(
    {
      app: "Trading Plan Pro",
      ...getBuildInfo(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
