import { config } from "dotenv";

/**
 * Next loads `.env.local` on its own, but standalone scripts run through tsx do
 * not. Importing this first gives both the same environment, with `.env.local`
 * winning over `.env` exactly as it does in the app.
 */
config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
