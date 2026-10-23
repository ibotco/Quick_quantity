/* =====================================================================
   MINIMAL ZIP WRITER (store method) — used to build .xlsx and .docx
   in the browser with no libraries and no network.
   ===================================================================== */
(function (root) {
  'use strict';

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const enc = new TextEncoder();

  class Zip {
    constructor() { this.files = []; }
    add(name, content) {
      const data = typeof content === 'string' ? enc.encode(content) : content;
      this.files.push({ name, data, crc: crc32(data) });
      return this;
    }
    build() {
      const chunks = [];
      const central = [];
      let offset = 0;
      const now = new Date();
      const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() / 2)) & 0xFFFF;
      const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

      const u16 = v => [v & 0xFF, (v >>> 8) & 0xFF];
      const u32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];

      this.files.forEach(f => {
        const nameBytes = enc.encode(f.name);
        const header = new Uint8Array([
          0x50, 0x4B, 0x03, 0x04,      // local file header
          20, 0,                        // version needed
          0x00, 0x08,                   // flags: UTF-8 names
          0, 0,                         // method: store
          ...u16(dosTime), ...u16(dosDate),
          ...u32(f.crc), ...u32(f.data.length), ...u32(f.data.length),
          ...u16(nameBytes.length), 0, 0
        ]);
        chunks.push(header, nameBytes, f.data);

        central.push(new Uint8Array([
          0x50, 0x4B, 0x01, 0x02,      // central directory
          20, 0, 20, 0,
          0x00, 0x08, 0, 0,
          ...u16(dosTime), ...u16(dosDate),
          ...u32(f.crc), ...u32(f.data.length), ...u32(f.data.length),
          ...u16(nameBytes.length), 0, 0,       // name length, extra length
          0, 0,                                 // comment length
          0, 0,                                 // disk number start
          0, 0,                                 // internal attributes
          0, 0, 0, 0,                           // external attributes
          ...u32(offset)
        ]), nameBytes);
        offset += header.length + nameBytes.length + f.data.length;
      });

      const centralStart = offset;
      let centralSize = 0;
      central.forEach(c => { centralSize += c.length; });

      const end = new Uint8Array([
        0x50, 0x4B, 0x05, 0x06, 0, 0, 0, 0,
        ...u16(this.files.length), ...u16(this.files.length),
        ...u32(centralSize), ...u32(centralStart), 0, 0
      ]);

      const all = chunks.concat(central, [end]);
      const total = all.reduce((s, a) => s + a.length, 0);
      const out = new Uint8Array(total);
      let p = 0;
      all.forEach(a => { out.set(a, p); p += a.length; });
      return new Blob([out], { type: 'application/octet-stream' });
    }
  }

  root.ZipWriter = Zip;
})(typeof window !== 'undefined' ? window : globalThis);
