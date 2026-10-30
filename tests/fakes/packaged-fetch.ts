// A page's fetch that answers with the extension's packaged files: every
// locale's messages and the data files under assets/data. Anything else,
// such as the website or GitHub, is unavailable.
const PACKAGED: Record<string, unknown> = {
  ...import.meta.glob('../../_locales/*/messages.json', { eager: true, import: 'default' }),
  ...import.meta.glob('../../assets/data/*.json', { eager: true, import: 'default' })
};

export async function fetchPackaged(url: string): Promise<{ ok: boolean; json(): Promise<unknown> }> {
  const match = /(_locales\/[^/]+\/messages\.json|assets\/data\/[^/?#]+\.json)/.exec(String(url));
  const body = match ? PACKAGED[`../../${match[1]}`] : undefined;
  return { ok: body !== undefined, json: async () => body };
}
