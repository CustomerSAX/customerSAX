import { AppShell } from "../../components/shell/AppShell";
import { KnowledgeBaseView } from "../../features/knowledge-base/components/KnowledgeBaseView";

export default function KnowledgeBasePage() {
  return (
    <AppShell>
      <KnowledgeBaseView />
    </AppShell>
  );
}
