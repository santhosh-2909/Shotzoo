// Vercel catch-all serverless function for every /api/* request.
// It re-exports the Express app from backend/server.ts so all existing
// routes (/api/auth/*, /api/tasks/*, /api/admin/*, etc.) work unchanged.
//
// The filename `[...path].ts` is Vercel's catch-all convention:
// https://vercel.com/docs/functions/vercel-functions#dynamic-segments
import app from '../backend/server';
export default app;
