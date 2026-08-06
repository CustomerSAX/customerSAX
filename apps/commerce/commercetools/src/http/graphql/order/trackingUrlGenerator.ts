export function generateReturnTrackingUrl(returnTrackingId: string) {
  return returnTrackingId ? `https://tracking.example.com/returns/${encodeURIComponent(returnTrackingId)}` : "";
}
