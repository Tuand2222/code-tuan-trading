import { getAuth } from "../../../../lib/auth";

async function handler(request: Request) {
  return getAuth(request).handler(request);
}

export { handler as GET, handler as POST };
