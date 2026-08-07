export function generateTicketNumber() {
  const date = new Date();
  const stamp = `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();

  return `CSA-${stamp}-${suffix}`;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
