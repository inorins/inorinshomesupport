import { useState } from 'react';
import { BookUser, ChevronDown, Plus, Check, Trash2 } from 'lucide-react';
import { useContactBook, type SavedContact } from '@/hooks/useContactBook';
import { cn } from '@/lib/utils';

export interface ContactFields {
  contactName: string;
  contactDesignation: string;
  contactPhone: string;
  contactEmail: string;
}

interface ContactPickerProps {
  fields: ContactFields;
  onApply: (contact: ContactFields) => void;
}

export function ContactPicker({ fields, onApply }: ContactPickerProps) {
  const { contacts, addContact, deleteContact } = useContactBook();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');

  const hasCurrentFields =
    fields.contactName.trim() &&
    fields.contactDesignation.trim() &&
    fields.contactPhone.trim();

  const isSavedAlready = contacts.some(
    (c) =>
      c.name === fields.contactName.trim() &&
      c.designation === fields.contactDesignation.trim() &&
      c.phone === fields.contactPhone.trim(),
  );

  const handleSave = () => {
    const name = saveName.trim() || fields.contactName.trim();
    if (!name) return;
    addContact({
      name: fields.contactName.trim(),
      designation: fields.contactDesignation.trim(),
      phone: fields.contactPhone.trim(),
      email: fields.contactEmail.trim(),
    });
    setSaving(false);
    setSaveName('');
  };

  const handleApply = (c: SavedContact) => {
    onApply({
      contactName: c.name,
      contactDesignation: c.designation,
      contactPhone: c.phone,
      contactEmail: c.email,
    });
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BookUser className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Contact Person for this ticket
          </span>
          {contacts.length > 0 && (
            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
              {contacts.length} saved
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Save current fields as a contact */}
          {hasCurrentFields && !isSavedAlready && !saving && (
            <button
              type="button"
              onClick={() => setSaving(true)}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              <Plus className="h-3 w-3" />
              Save contact
            </button>
          )}
          {isSavedAlready && (
            <span className="flex items-center gap-1 text-[11px] text-success">
              <Check className="h-3 w-3" />
              Saved
            </span>
          )}

          {/* Pick from saved */}
          {contacts.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((p) => !p)}
              className={cn(
                'flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors',
                open
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:bg-accent',
              )}
            >
              Saved contacts
              <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
            </button>
          )}
        </div>
      </div>

      {/* Save-as input */}
      {saving && (
        <div className="flex items-center gap-2 p-2.5 rounded-md border border-primary/20 bg-primary/5">
          <input
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaving(false); }}
            placeholder={fields.contactName || 'Contact label…'}
            className="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={handleSave}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setSaving(false)}
            className="text-[11px] text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Dropdown list */}
      {open && contacts.length > 0 && (
        <div className="rounded-md border border-border bg-card shadow-md divide-y divide-border overflow-hidden">
          {contacts.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent cursor-pointer group"
              onClick={() => handleApply(c)}
            >
              <div className="h-7 w-7 rounded-full bg-secondary/15 flex items-center justify-center shrink-0 text-[11px] font-bold text-secondary">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight truncate">{c.name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.designation} · {c.phone}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteContact(c.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded"
                title="Remove contact"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
