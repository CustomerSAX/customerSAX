import { AppShell } from "../../components/shell/AppShell";
import { KnowledgeBasePageView } from "../../features/workspace/ModulePages";

export default function KnowledgeBasePage() {
  return (
    <AppShell>
      <KnowledgeBasePageView />
    </AppShell>
  );
}
