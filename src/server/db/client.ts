import "@tanstack/react-start/server-only";
import { drizzle } from "drizzle-orm/d1";
import { bindings } from "../env";
import * as schema from "./schema";
export const db = () => drizzle(bindings().DB, { schema });
