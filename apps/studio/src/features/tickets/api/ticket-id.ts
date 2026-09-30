export function ticketIdFromRoute(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}
