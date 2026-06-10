import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_ROOT = path.join(__dirname, '..', '..', 'uploads');

const ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.csv', '.xls', '.xlsx', '.txt', '.log', '.sql']);

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    const ticketId = req.params.id ?? req.body?.ticketId ?? 'unknown';
    const dir = path.join(UPLOADS_ROOT, ticketId);
    cb(null, dir);
  },
  filename(_req, file, cb) {
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) cb(null, true);
  else cb(new Error(`File type ${ext} is not allowed.`));
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: 20 * 1024 * 1024 } });

export { UPLOADS_ROOT, ALLOWED_EXTENSIONS };
