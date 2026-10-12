import { PageHeader } from "../../components/ui";
import {
  CommitmentCapture,
  CommitmentTable,
  Panel
} from "../../features/repmotion/components";

export default function CommitmentsPage() {
  return (
    <div className="page-stack">
      <PageHeader
        title="Keep every promise in view."
        subtitle="Shared commitments across sales and customer care."
        actions={<CommitmentCapture />}
      />
      <Panel
        title="Customer commitments"
        description="Owners, due dates, and dependencies across the sample portfolio"
      >
        <CommitmentTable />
      </Panel>
    </div>
  );
}
