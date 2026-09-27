// Pure input guards shared by client and server code (no server-only imports here).

export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export const isInt = (v: unknown, lo = 0, hi = Number.MAX_SAFE_INTEGER): v is number => Number.isSafeInteger(v) && (v as number) >= lo && (v as number) <= hi;
