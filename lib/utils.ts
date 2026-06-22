export function slugify(input: string): string {
  return (input || '')
    .toString()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80) || 'app';
}

export function searchTerms(...inputs: (string | undefined | null)[]): string[] {
  const set = new Set<string>();
  for (const raw of inputs) {
    if (!raw) continue;
    const words = raw
      .toString()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && w.length <= 30);
    for (const w of words) set.add(w);
  }
  return Array.from(set).slice(0, 80);
}

export function safeExt(filename: string, fallback = 'bin'): string {
  const m = (filename || '').match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : fallback;
}

export function randomId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
