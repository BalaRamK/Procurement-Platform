"use client";

import { EmailTemplateManagerView } from "./EmailTemplateManagerView";

type AdminTab = "templates" | "delivery" | "diagnostics";

export function EmailTemplateManager({ initialTab }: { initialTab?: AdminTab }) {
  return <EmailTemplateManagerView initialTab={initialTab} />;
}
