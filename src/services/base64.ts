/** bytes ↔ base64: η γέφυρα προς τον κώδικα iOS μεταφέρει μόνο κείμενο. */
export async function toBase64(blob: Blob): Promise<string> {
  const u = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(text: string): Blob {
  const bin = atob(text);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u]);
}
