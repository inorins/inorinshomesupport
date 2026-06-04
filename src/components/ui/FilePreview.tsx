import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Download, Loader2 } from 'lucide-react';

export interface FileAttachment {
  name: string;
  size: number;
  type: string;
  url?: string;
}

function isPreviewable(type: string): boolean {
  return (
    type.startsWith('image/') ||
    type === 'application/pdf' ||
    type.startsWith('text/')
  );
}

interface AttachmentViewProps {
  att: FileAttachment;
  className?: string;
}

export function AttachmentView({ att, className }: AttachmentViewProps) {
  const [open, setOpen] = useState(false);
  const type = att.type || '';
  const canPreview = Boolean(att.url) && isPreviewable(type);
  const btnClass = className ?? 'text-xs text-primary hover:underline shrink-0';

  if (!att.url) return null;

  return (
    <>
      {canPreview ? (
        <button type="button" onClick={() => setOpen(true)} className={btnClass}>
          View
        </button>
      ) : (
        <a href={att.url} download={att.name} className={btnClass}>
          Download
        </a>
      )}

      {canPreview && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="max-w-4xl p-0 flex flex-col gap-0 overflow-hidden"
            style={{ height: '85vh' }}
          >
            <DialogHeader className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center gap-3 pr-8">
                <DialogTitle className="text-sm font-medium truncate flex-1 text-left">
                  {att.name}
                </DialogTitle>
                <a
                  href={att.url}
                  download={att.name}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </a>
              </div>
            </DialogHeader>

            <div className="flex-1 min-h-0 overflow-hidden">
              {type.startsWith('image/') && (
                <div className="h-full flex items-center justify-center bg-muted/20 p-6">
                  <img
                    src={att.url}
                    alt={att.name}
                    className="max-w-full max-h-full object-contain rounded-md"
                  />
                </div>
              )}
              {type === 'application/pdf' && (
                <iframe
                  src={att.url}
                  title={att.name}
                  className="w-full h-full border-0"
                />
              )}
              {type.startsWith('text/') && <TextPreview url={att.url} />}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setContent(null);
    setError(false);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed');
        return r.text();
      })
      .then(setContent)
      .catch(() => setError(true));
  }, [url]);

  if (error) {
    return <p className="p-4 text-sm text-destructive">Failed to load file content.</p>;
  }
  if (content === null) {
    return (
      <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }
  return (
    <pre className="h-full overflow-auto p-4 text-xs font-mono text-foreground bg-background whitespace-pre-wrap break-words">
      {content}
    </pre>
  );
}
