export function convertToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  const binaryString = String.fromCharCode(...bytes);
  return btoa(binaryString);
}

export function convertFromBase64(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function mergeBuffer(buffer1: ArrayBuffer, buffer2: ArrayBuffer) {
  const tmp = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
  tmp.set(new Uint8Array(buffer1), 0);
  tmp.set(new Uint8Array(buffer2), buffer1.byteLength);
  return tmp.buffer;
}

function readAsn1IntegerSequence(input: Uint8Array) {
  if (input[0] !== 0x30) throw new Error('Input is not an ASN.1 sequence');
  const seqLength = input[1];
  const elements: Uint8Array[] = [];

  let current = input.slice(2, 2 + seqLength);
  while (current.length > 0) {
    const tag = current[0];
    if (tag !== 0x02) throw new Error('Expected ASN.1 sequence element to be an INTEGER');

    const elLength = current[1];
    elements.push(current.slice(2, 2 + elLength));

    current = current.slice(2 + elLength);
  }
  return elements;
}

export function convertEcdsaAsn1Signature(input: Uint8Array) {
  const elements = readAsn1IntegerSequence(input);
  if (elements.length !== 2) throw new Error('Expected 2 ASN.1 sequence elements');
  let [r, s] = elements;

  // R and S length is assumed multiple of 128bit.
  // If leading is 0 and modulo of length is 1 byte then
  // leading 0 is for two's complement and will be removed.
  if (r[0] === 0 && r.byteLength % 16 == 1) {
    r = r.slice(1);
  }
  if (s[0] === 0 && s.byteLength % 16 == 1) {
    s = s.slice(1);
  }

  // R and S length is assumed multiple of 128bit.
  // If missing a byte then it will be padded by 0.
  if (r.byteLength % 16 == 15) {
    r = new Uint8Array(mergeBuffer(new Uint8Array([0]), r));
  }
  if (s.byteLength % 16 == 15) {
    s = new Uint8Array(mergeBuffer(new Uint8Array([0]), s));
  }

  // If R and S length is not still multiple of 128bit,
  // then error
  if (r.byteLength % 16 != 0) throw Error('unknown ECDSA sig r length error');
  if (s.byteLength % 16 != 0) throw Error('unknown ECDSA sig s length error');

  return mergeBuffer(r, s);
}
