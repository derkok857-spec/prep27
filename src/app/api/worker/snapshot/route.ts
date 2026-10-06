import { handleSnapshot } from "@/lib/worker/handlers";
import { workerDeps } from "@/lib/worker/deps";

/** Read only snapshot of the study log for the weekly AI worker. Requires the x-worker-token header. */
export async function GET(request: Request) {
  return handleSnapshot(request, workerDeps());
}
