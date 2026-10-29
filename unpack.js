// Unpacks a reading from the link (see server/share.js). Works in the browser and in Node.
// Returns null when the code is broken.
export async function unpackReading(code) {
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (ch) => ch.charCodeAt(0));
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
  } catch {
    return null;
  }
}
