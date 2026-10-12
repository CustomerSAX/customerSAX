export function validateEmail(value: string, name: string): string {
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) throw new Error(`${name} must be an email address`);
  return value;
}

