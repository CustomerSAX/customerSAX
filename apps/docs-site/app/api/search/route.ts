import { NextResponse } from "next/server";

// Built-in full-text search is intentionally disabled for now (the search box is
// turned off via `search={{ enabled: false }}` on RootProvider in
// app/layout.tsx). This stub keeps the route valid and returns no results.
//
// To re-enable Orama search later, replace this with:
//   import { source } from "@/lib/source";
//   import { createFromSource } from "fumadocs-core/search/server";
//   export const { GET } = createFromSource(source);
// and flip the RootProvider search prop back on.
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json([]);
}
