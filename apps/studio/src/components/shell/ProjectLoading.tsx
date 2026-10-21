import { Loader2 } from "lucide-react";

export function ProjectLoading() {
  return (
    <div role="status" className="fixed inset-0 flex items-center justify-center bg-m-surface">
      <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-m-primary motion-reduce:animate-none" />
      <span className="sr-only">Loading project…</span>
    </div>
  );
}
