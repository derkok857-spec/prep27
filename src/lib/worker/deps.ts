import "server-only";

import { getAdminClient } from "../supabase/admin";
import type { WorkerDeps } from "./handlers";
import { supabaseStore } from "./store";

export function workerDeps(): WorkerDeps {
  const admin = getAdminClient();
  return {
    store: admin ? supabaseStore(admin, process.env.OWNER_USER_ID) : null,
    token: process.env.WORKER_TOKEN,
    timeZone: process.env.APP_TIME_ZONE || "America/Lima",
  };
}
