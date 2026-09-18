/**
 * Minimal probe: confirms Netlify treats this as a true background invocation (fast response,
 * ~35s of work continues after) before building the real async research job on this mechanism.
 * Delete this file once the async research pipeline is live and verified.
 */
export default async (req: Request) => {
  const { delayMs } = await req.json().catch(() => ({}));
  await new Promise((resolve) => setTimeout(resolve, delayMs ?? 35000));
};
