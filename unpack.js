// Opens a reading from the link. Works in the browser and in Node. Returns null when it cannot.
// Two kinds of link:
// - short: #<id>.<key>: the reading is encrypted in the repository (see server/publish.js);
// - long: #<packed reading>: the whole reading is in the link (see server/share.js).

const fromBase64url = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
};

async function unpackBytes(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const p = JSON.parse(await new Response(stream).text());
  if (p.v !== 1 || !Array.isArray(p.c)) return null;
  const [INTRO, PAST, PRESENT, FUTURE] = p.s;
  return {
    name: p.n,
    date: p.d,
    cards: p.c.map(([cardId, reversed]) => ({ cardId, reversed: reversed === 1 })),
    sections: { INTRO, PAST, PRESENT, FUTURE },
    story: p.y,
    prophecy: p.a,
    closing: p.e,
    token: p.t,
    luckyNumber: p.l,
  };
}

export async function unpackReading(code) {
  try {
    return await unpackBytes(fromBase64url(code));
  } catch {
    return null;
  }
}

export async function openReading(code, { repo, fetch = globalThis.fetch } = {}) {
  const [id, keyText] = code.split('.');
  if (!keyText) return unpackReading(code);
  try {
    // A new file can take a moment to appear: try again a few times.
    let res;
    for (let i = 0; i < 4; i++) {
      res = await fetch(`https://raw.githubusercontent.com/${repo}/readings/r/${id}.bin`);
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
    if (!res.ok) return null;
    const file = new Uint8Array(await res.arrayBuffer());
    const key = await crypto.subtle.importKey('raw', fromBase64url(keyText), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: file.slice(0, 12) }, key, file.slice(12));
    return await unpackBytes(new Uint8Array(plain));
  } catch {
    return null;
  }
}
