import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CJK_OR_HANGUL_OR_KANA =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;
const shouldApply = process.argv.includes('--apply');

function looksLikeLatin1Mojibake(text) {
  for (const char of text) {
    const codePoint = char.codePointAt(0) ?? 0;
    if ((codePoint >= 0x00c0 && codePoint <= 0x00ff) || codePoint === 0x00a0) {
      return true;
    }
  }

  return false;
}

function normalizeUploadedFilename(filename) {
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

async function main() {
  const documents = await prisma.document.findMany({
    select: {
      id: true,
      sourceName: true,
      title: true
    },
    orderBy: {
      updatedAt: 'desc'
    }
  });

  const repairs = documents
    .map((document) => {
      const normalizedSourceName = normalizeUploadedFilename(
        document.sourceName
      );
      const normalizedTitle = normalizeUploadedFilename(document.title);
      const changed =
        normalizedSourceName !== document.sourceName ||
        normalizedTitle !== document.title;

      return changed
        ? {
            id: document.id,
            before: {
              sourceName: document.sourceName,
              title: document.title
            },
            after: {
              sourceName: normalizedSourceName,
              title: normalizedTitle
            }
          }
        : null;
    })
    .filter(Boolean);

  if (!shouldApply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          scanned: documents.length,
          repairCount: repairs.length,
          repairs
        },
        null,
        2
      )
    );
    return;
  }

  for (const repair of repairs) {
    await prisma.document.update({
      where: {
        id: repair.id
      },
      data: {
        sourceName: repair.after.sourceName,
        title: repair.after.title
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: 'apply',
        scanned: documents.length,
        repaired: repairs.length,
        repairs
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
