import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileText } from 'lucide-react';
import { systemModules } from '@/data/mockData';
import { api } from '@/services/api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

interface CreateTicketModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateTicketModal({ open, onClose }: CreateTicketModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [bankName, setBankName] = useState('');
  const [description, setDescription] = useState('');
  const [requestType, setRequestType] = useState<'Issue' | 'Add Form' | 'Add Report'>('Issue');
  const [priority, setPriority] = useState('');
  const [system, setSystem] = useState('');
  const [module, setModule] = useState('');
  const [form, setForm] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadError, setUploadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const modules = system ? Object.keys(systemModules[system] || {}) : [];
  const forms = system && module ? systemModules[system]?.[module] || [] : [];

  const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
  const ACCEPTED_ATTACHMENT_TYPES = [
    'image/png',
    'image/jpeg',
    'application/pdf',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const newFiles = Array.from(files);
    const invalid = newFiles.filter((file) => {
      const name = file.name.toLowerCase();
      const isAllowedByExtension = ['.csv', '.xls', '.xlsx'].some((ext) => name.endsWith(ext));
      return (
        file.size > MAX_ATTACHMENT_SIZE ||
        (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type) && !isAllowedByExtension)
      );
    });

    if (invalid.length > 0) {
      setUploadError('Only PNG, JPG, PDF, CSV, XLS, and XLSX files under 10MB are allowed.');
      return;
    }

    setUploadError('');
    setAttachments((current) => {
      const merged = [...current, ...newFiles];
      return merged.slice(0, 5);
    });
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Unable to read file content.'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    addFiles(event.dataTransfer.files);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(event.target.files);
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => current.filter((_, i) => i !== index));
  };

  const handleSystemChange = (val: string) => {
    setSystem(val);
    setModule('');
    setForm('');
  };

  const handleModuleChange = (val: string) => {
    setModule(val);
    setForm('');
  };

  const reset = () => {
    setStep(1);
    setTitle('');
    setBankName('');
    setDescription('');
    setRequestType('Issue');
    setPriority('');
    setSystem('');
    setModule('');
    setForm('');
    setAttachments([]);
    setUploadError('');
    setSubmitError('');
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const attachmentsPayload = await Promise.all(
        attachments.map(async (file) => ({
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          content: await readFileAsBase64(file),
        })),
      );

      await api.createTicket({
        title,
        bankName,
        description,
        requestType,
        priority: priority as 'Critical' | 'High' | 'Medium' | 'Low',
        system,
        module,
        form,
        environment: 'Production',
        reporter: user?.name,
        reporterEmail: user?.email,
        attachments: attachmentsPayload,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['stats'] }),
      ]);
      onClose();
      reset();
    } catch {
      setSubmitError('Failed to submit the ticket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset(); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-foreground">Create New Ticket</DialogTitle>
          <DialogDescription>Provide details about the issue to help our team resolve it quickly.</DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ${step >= s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                {s}
              </div>
              <span className={`text-xs font-medium ${step >= s ? 'text-foreground' : 'text-muted-foreground'}`}>
                {s === 1 ? 'Issue Details' : s === 2 ? 'CBS Hierarchy' : 'Attachments'}
              </span>
              {s < 3 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Brief summary of the issue"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Bank</Label>
              <Select value={bankName} onValueChange={setBankName}>
                  <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Guheshwori">Guheshwori</SelectItem>
                    <SelectItem value="Reliance">Reliance</SelectItem>
                    <SelectItem value="Progressive">Progressive</SelectItem>
                    <SelectItem value="Ganapati">Ganapati</SelectItem>
                    <SelectItem value="Goodwill">Goodwill</SelectItem>
                    <SelectItem value="Shree Finance">Shree Finance</SelectItem>
                  </SelectContent>
                </Select>
              <p className="text-xs text-muted-foreground">Use this field when creating a ticket on behalf of another bank.</p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe the issue in detail, including steps to reproduce..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Request Type</Label>
                <Select value={requestType} onValueChange={(value) => setRequestType(value as 'Issue' | 'Add Form' | 'Add Report')}>
                  <SelectTrigger><SelectValue placeholder="Select request type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Issue">Issue / Bug</SelectItem>
                    <SelectItem value="Add Form">New Form Request</SelectItem>
                    <SelectItem value="Add Report">New Report Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Select the system, module, and form related to your issue.</p>
            <div className="space-y-2">
              <Label>System</Label>
              <Select value={system} onValueChange={handleSystemChange}>
                <SelectTrigger><SelectValue placeholder="Select system" /></SelectTrigger>
                <SelectContent>
                  {Object.keys(systemModules).map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Module</Label>
              <Select value={module} onValueChange={handleModuleChange} disabled={!system}>
                <SelectTrigger><SelectValue placeholder={system ? 'Select module' : 'Select a system first'} /></SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Form</Label>
              <Select value={form} onValueChange={setForm} disabled={!module}>
                <SelectTrigger><SelectValue placeholder={module ? 'Select form' : 'Select a module first'} /></SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Attach screenshots or relevant files to help diagnose the issue.</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".png,.jpg,.jpeg,.pdf,.csv,.xls,.xlsx"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center gap-3 bg-surface hover:border-primary/40 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              <Upload className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop files here or click to browse</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, PDF, CSV, XLS, XLSX up to 10MB</p>
            </div>
            {uploadError ? (
              <p className="text-xs text-destructive">{uploadError}</p>
            ) : null}
            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-surface rounded-md border border-border">
                    <FileText className="h-5 w-5 text-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={() => removeAttachment(idx)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-surface rounded-md border border-border">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No attachments selected yet.</p>
              </div>
            )}
            {submitError ? (
              <p className="text-xs text-destructive">{submitError}</p>
            ) : null}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={() => step > 1 ? setStep(step - 1) : (onClose(), reset())}
            size="sm"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            onClick={() => step < 3 ? setStep(step + 1) : handleSubmit()}
            size="sm"
            disabled={isSubmitting || (step === 1 && (!title.trim() || !priority))}
          >
            {step === 3 ? (isSubmitting ? 'Submitting…' : 'Submit Ticket') : 'Next'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
