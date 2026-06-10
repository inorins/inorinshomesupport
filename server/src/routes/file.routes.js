import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.csv': 'text/csv; charset=utf-8',
  '.txt': 'text/plain',
  '.log': 'text/plain',
  '.sql': 'text/plain',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const router = Router();

router.get('/:ticketId/:filename', async (req, res, next) => {
  try {
    const { ticketId, filename } = req.params;
    // Express already URL-decodes route params — use them directly
    const filePath = path.join(UPLOADS_ROOT, ticketId, filename);
    const resolved = path.resolve(filePath);
    const uploadDir = path.resolve(path.join(UPLOADS_ROOT, ticketId));
    // Append separator to prevent prefix-match bypass (e.g. TKT-2401 matching TKT-24019)
    if (!resolved.startsWith(uploadDir + path.sep)) {
      return res.status(403).json({ message: 'Access denied.' });
    }

    try { await fs.access(filePath); } catch {
      return res.status(404).json({ message: 'File not found.' });
    }

    const ext = path.extname(filename).toLowerCase();
    res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    createReadStream(filePath).pipe(res);
  } catch (err) { next(err); }
});

export default router;
