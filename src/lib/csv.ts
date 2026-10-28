import type { Credential } from './types';

export interface CsvRow {
  name: string;
  url: string;
  username: string;
  password: string;
  note: string;
}

const HEADER = ['name', 'url', 'username', 'password', 'note'] as const;

const HEADER_ALIASES: Record<string, keyof CsvRow> = {
  name: 'name',
  title: 'name',
  url: 'url',
  login_uri: 'url',
  website: 'url',
  origin: 'url',
  username: 'username',
  login_username: 'username',
  user: 'username',
  email: 'username',
  password: 'password',
  login_password: 'password',
  note: 'note',
  notes: 'note',
  extra: 'note',
};

/** RFC 4180 parser: quoted fields, escaped quotes, CRLF/LF, newlines inside quotes. */
export function parseCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records.filter((r) => r.some((f) => f.trim() !== ''));
}

export function parseCredentialCsv(text: string): CsvRow[] {
  const [header, ...rows] = parseCsvRecords(text);
  if (!header) return [];
  const columns = header.map((h) => HEADER_ALIASES[h.trim().toLowerCase()]);
  if (!columns.includes('url') || !columns.includes('password')) {
    throw new Error('CSV 缺少必要欄位（需要 url 與 password）');
  }
  return rows.map((cells) => {
    const row: CsvRow = { name: '', url: '', username: '', password: '', note: '' };
    columns.forEach((col, i) => {
      if (col && cells[i] !== undefined) row[col] = cells[i];
    });
    return row;
  });
}

function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function credentialsToCsv(credentials: Credential[]): string {
  const lines = [HEADER.join(',')];
  for (const c of credentials) {
    lines.push(
      [c.name || c.hostname, c.origin, c.username, c.password, c.notes].map(escapeField).join(','),
    );
  }
  return lines.join('\n') + '\n';
}
