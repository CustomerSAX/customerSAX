import type { ReportExportRow } from "../types/report-types";

/** Input[type=date] always yields "YYYY-MM-DD"; reformat without going through
 * a Date object so the label can't shift a day due to timezone conversion. */
export function formatDdMmYyyy(value: string): string {
  const [yyyy, mm, dd] = value.split("-");
  if (!yyyy || !mm || !dd) return "all";
  return `${dd}-${mm}-${yyyy}`;
}

export async function exportRowsToExcel(rows: ReportExportRow[], fileName: string): Promise<void> {
  if (rows.length === 0) {
    throw new Error("No data to export");
  }

  // Dynamically import heavy libraries to reduce initial bundle size and avoid SSR issues
  const XLSX = await import("xlsx");
  const { saveAs } = await import("file-saver");

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  saveAs(new Blob([buffer], { type: "application/octet-stream" }), `${fileName}.xlsx`);
}
