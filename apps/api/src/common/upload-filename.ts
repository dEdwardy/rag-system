const CJK_OR_HANGUL_OR_KANA =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function looksLikeLatin1Mojibake(text: string) {
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if ((codePoint >= 0x00c0 && codePoint <= 0x00ff) || codePoint === 0x00a0) {
      return true;
    }
  }

  return false;
}

export function normalizeUploadedFilename(filename: string) {
  const trimmed = filename.trim();
  if (trimmed.length === 0) {
    return filename;
  }

  const normalized = trimmed.normalize('NFC');
  if (!looksLikeLatin1Mojibake(normalized)) {
    return normalized;
  }

  const decoded = Buffer.from(normalized, 'latin1')
    .toString('utf8')
    .normalize('NFC');
  if (decoded.includes('\uFFFD')) {
    return normalized;
  }

  if (!CJK_OR_HANGUL_OR_KANA.test(decoded)) {
    return normalized;
  }

  return decoded;
}
