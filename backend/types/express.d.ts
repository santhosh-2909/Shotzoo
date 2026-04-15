import { UserRow } from './db';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `protect` middleware — the authenticated user's DB row. */
      user?: UserRow;
    }
  }
}
