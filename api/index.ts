import { createApiHandler } from "../apiRuntime.ts";
export default createApiHandler(() => import("../server.ts"));
