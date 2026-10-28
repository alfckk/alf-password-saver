export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

const LABELS = ['非常弱', '弱', '普通', '強', '非常強'];

export function estimateStrength(password: string): Strength {
  if (!password) return { score: 0, label: LABELS[0] };
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 33;
  const uniqueRatio = new Set(password).size / password.length;
  const bits = password.length * Math.log2(Math.max(pool, 1)) * Math.min(1, uniqueRatio + 0.3);
  const score = bits < 28 ? 0 : bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { score, label: LABELS[score] };
}
