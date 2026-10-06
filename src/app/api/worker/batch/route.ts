import { handleBatch } from "@/lib/worker/handlers";
import { workerDeps } from "@/lib/worker/deps";

/** Receives the weekly batch of verified questions, patterns and the coach summary. Requires the x-worker-token header. */
export async function POST(request: Request) {
  return handleBatch(request, workerDeps());
}
