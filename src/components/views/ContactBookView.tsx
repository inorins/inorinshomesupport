import { useState } from 'react';
import { BookUser, Plus, Pencil, Trash2, Check, X, Phone, Briefcase, Mail } from 'lucide-react';
import { useContactBook, type SavedContact } from '@/hooks/useContactBook';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const EMPTY: Omit<SavedContact, 'id'> = { name: '', designation: '', phone: '', email: '' };

function ContactForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Omit<SavedContact, 'id'>;
  onSave: (d: Omit<SavedContact, 'id'>) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const valid = draft.name.trim() && draft.designation.trim() && draft.phone.trim();

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Name <span className="text-primary">*</span></Label>
          <Input
            autoFocus
            value={draft.name}
            onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
            placeholder="Full name"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Designation <span className="text-primary">*</span></Label>
          <Input
            value={draft.designation}
            onChange={(e) => setDraft((p) => ({ ...p, designation: e.target.value }))}
            placeholder="e.g. IT Manager"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phone <span className="text-primary">*</span></Label>
          <Input
            value={draft.phone}
            onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+977-98XXXXXXXX"
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Email</Label>
          <Input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
            placeholder="optional"
            className="h-8 text-sm"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} className="h-7 text-xs gap-1">
          <X className="h-3 w-3" /> Cancel
        </Button>
        <Button size="sm" onClick={() => onSave(draft)} disabled={!valid} className="h-7 text-xs gap-1">
          <Check className="h-3 w-3" /> Save
        </Button>
      </div>
    </div>
  );
}

function ContactCard({
  contact,
  onEdit,
  onDelete,
}: {
  contact: SavedContact;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="bg-card rounded-lg border border-border p-4 flex items-start justify-between gap-3 group">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-secondary/15 flex items-center justify-center shrink-0 text-sm font-bold text-secondary">
          {contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-sm text-foreground">{contact.name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Briefcase className="h-3 w-3 shrink-0" />
              {contact.designation}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              {contact.phone}
            </span>
            {contact.email && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0" />
                {contact.email}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ContactBookView() {
  const { contacts, addContact, updateContact, deleteContact } = useContactBook();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleAdd = (data: Omit<SavedContact, 'id'>) => {
    addContact(data);
    setAdding(false);
  };

  const handleUpdate = (id: string, data: Omit<SavedContact, 'id'>) => {
    updateContact(id, data);
    setEditingId(null);
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BookUser className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Contact Book</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Save contact persons to auto-fill ticket forms quickly.
          </p>
        </div>
        {!adding && (
          <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
        )}
      </div>

      {adding && (
        <ContactForm
          initial={EMPTY}
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
        />
      )}

      {contacts.length === 0 && !adding ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <BookUser className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No saved contacts yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1 mb-4">
            Save contacts here to fill them in one click when submitting a ticket.
          </p>
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add your first contact
          </Button>
        </div>
      ) : (
        <div className={cn('space-y-3', contacts.length === 0 && 'hidden')}>
          {contacts.map((c) =>
            editingId === c.id ? (
              <ContactForm
                key={c.id}
                initial={{ name: c.name, designation: c.designation, phone: c.phone, email: c.email }}
                onSave={(d) => handleUpdate(c.id, d)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <ContactCard
                key={c.id}
                contact={c}
                onEdit={() => setEditingId(c.id)}
                onDelete={() => deleteContact(c.id)}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}
