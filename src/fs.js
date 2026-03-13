// ═══════════════════════════════════════════════════════════════════
// FILE SYSTEM ACCESS API  (Chrome / Edge only)
// ═══════════════════════════════════════════════════════════════════
export const FS_SUPPORTED = 'showDirectoryPicker' in window;

export async function pickFolder() {
  return window.showDirectoryPicker({ mode: 'readwrite' });
}

export async function writeCsvToFolder(handle, filename, text) {
  const fh = await handle.getFileHandle(filename, { create: true });
  const wr = await fh.createWritable();
  await wr.write(text);
  await wr.close();
}

export async function readCsvFromFolder(handle, filename) {
  const fh   = await handle.getFileHandle(filename, { create: false });
  const file = await fh.getFile();
  return file.text();
}

export async function deleteFileFromFolder(handle, filename) {
  try { await handle.removeEntry(filename); } catch (_) { /* ignore */ }
}
