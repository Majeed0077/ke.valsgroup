const shouldUseDefaultNextDir =
  Boolean(process.env.VERCEL) || process.platform !== "win32";
process.env.NEXT_OUTPUT_DIR =
  process.env.NEXT_OUTPUT_DIR || (shouldUseDefaultNextDir ? ".next" : ".next-prod");
require("../server.js");
