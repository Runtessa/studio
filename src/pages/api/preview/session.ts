import type { NextApiRequest, NextApiResponse } from "next";
import { withApiHandler } from "@/lib/api-helpers";
import { requireUser } from "@/lib/auth";
import { resolveTenant } from "@/lib/tenancy";
import { issuePreviewSession } from "@/lib/preview-session";

export default withApiHandler(
  async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.status(405).end();
      return;
    }
    const user = await requireUser(req);
    const tenant = await resolveTenant(req, user, "ide.ui.read");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(await issuePreviewSession(user, tenant));
  },
);
