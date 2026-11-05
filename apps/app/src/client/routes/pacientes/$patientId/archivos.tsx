import { createFileRoute } from '@tanstack/react-router';
import { Archive, Camera, Download, FileText, FolderOpen, Image as ImageIcon, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ALLOWED_FILE_TYPES, FILE_CATEGORIES, FILE_CATEGORY_LABELS, MAX_FILE_BYTES, type FileCategory } from '../../../../shared/constants';
import { formatBytes, formatDate, todayISO } from '../../../../shared/format';
import type { FileItem } from '../../../../shared/types';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field, Input, Select } from '../../../components/ui/Field';
import { Badge, EmptyState, ErrorState } from '../../../components/ui/misc';
import { PageLoader } from '../../../components/ui/Spinner';
import { ApiError, fileUrl } from '../../../lib/api';
import { cn } from '../../../lib/cn';
import { useFileMutations, useFiles } from '../../../lib/queries';

export const Route = createFileRoute('/pacientes/$patientId/archivos')({
  validateSearch: z.object({ subir: z.boolean().optional() }),
  component: FilesPage,
});

const ACCEPT = Object.keys(ALLOWED_FILE_TYPES).join(',');
const isViewableImage = (mime: string) => ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
const guessCategory = (f: File): FileCategory => (f.type.startsWith('image/') ? 'foto' : f.type === 'application/pdf' ? 'laboratorio' : 'documento');

function FilesPage() {
  const { patientId } = Route.useParams();
  const { subir } = Route.useSearch();
  const navigate = Route.useNavigate();
  const files = useFiles(patientId);
  const m = useFileMutations(patientId);
  const [pending, setPending] = useState<File[]>([]);
  const [viewing, setViewing] = useState<FileItem | null>(null);
  const [filter, setFilter] = useState<FileCategory | 'all'>('all');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (subir) {
      inputRef.current?.click();
      void navigate({ search: {}, replace: true });
    }
  }, [subir, navigate]);

  const pick = (list: FileList | null) => {
    if (!list?.length) return;
    const ok: File[] = [];
    for (const f of Array.from(list)) {
      if (!(f.type in ALLOWED_FILE_TYPES)) toast.error(`${f.name}: tipo no permitido (use PDF, JPG, PNG, HEIC o DOCX).`);
      else if (f.size > MAX_FILE_BYTES) toast.error(`${f.name}: supera 50 MB.`);
      else ok.push(f);
    }
    setPending(ok);
  };

  if (files.isPending) return <PageLoader />;
  if (files.isError) return <ErrorState error={files.error} onRetry={() => files.refetch()} />;

  const visible = files.data.filter((f) => filter === 'all' || f.category === filter);
  const usedCategories = FILE_CATEGORIES.filter((c) => files.data.some((f) => f.category === c));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="section-heading">Archivos y estudios</h2>
        <div className="flex gap-2">
          <Button onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden /> Subir archivos
          </Button>
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-white px-4 font-semibold hover:bg-mist sm:hidden">
            <Camera className="size-4.5" aria-hidden /> Foto
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files)} />
          </label>
        </div>
        <input ref={inputRef} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files)} aria-label="Seleccionar archivos" />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files);
        }}
        className={cn('mt-4 hidden rounded-2xl border-2 border-dashed px-6 py-6 text-center text-sm text-muted transition-colors sm:block', dragging ? 'border-brand-500 bg-brand-50' : 'border-line')}
      >
        Arrastre aquí estudios, fotos o documentos (PDF, JPG, PNG, HEIC, DOCX · máx. 50 MB)
      </div>

      {usedCategories.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
          {(['all', ...usedCategories] as const).map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              aria-pressed={filter === c}
              className={cn('rounded-full border px-3.5 py-1.5 text-sm font-semibold', filter === c ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink/30')}
            >
              {c === 'all' ? 'Todos' : FILE_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      )}

      {files.data.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<FolderOpen />} title="Sin archivos" text="Suba resultados de laboratorio, estudios de imagen, recetas o fotografías." />
        </div>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((f) => (
            <li key={f.id} className="card overflow-hidden">
              <button onClick={() => setViewing(f)} className="block w-full text-left">
                <div className="flex aspect-[4/3] items-center justify-center bg-mist">
                  {isViewableImage(f.mime) ? (
                    <img src={fileUrl(f.id)} alt={f.description ?? f.filename} loading="lazy" className="size-full object-cover" />
                  ) : f.mime.startsWith('image/') ? (
                    <ImageIcon className="size-10 text-muted" aria-hidden />
                  ) : (
                    <FileText className="size-10 text-muted" aria-hidden />
                  )}
                </div>
                <div className="p-3.5">
                  <p className="truncate font-semibold">{f.description || f.filename}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
                    <Badge tone="brand">{FILE_CATEGORY_LABELS[f.category]}</Badge>
                    {f.studyDate ? formatDate(f.studyDate) : formatDate(f.createdAt)} · {formatBytes(f.size)}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <UploadDialog files={pending} onClose={() => setPending([])} onUpload={(form) => m.upload.mutateAsync(form)} />
      <ViewerDialog file={viewing} onClose={() => setViewing(null)} onArchive={(id) => m.archive.mutateAsync(id)} />
    </div>
  );
}

function UploadDialog({ files, onClose, onUpload }: { files: File[]; onClose: () => void; onUpload: (f: FormData) => Promise<unknown> }) {
  const [meta, setMeta] = useState<{ category: FileCategory; description: string; studyDate: string }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMeta(files.map((f) => ({ category: guessCategory(f), description: '', studyDate: todayISO() })));
  }, [files]);

  const submit = async () => {
    setBusy(true);
    let ok = 0;
    for (const [i, f] of files.entries()) {
      const form = new FormData();
      form.set('file', f);
      form.set('category', meta[i]?.category ?? 'otro');
      if (meta[i]?.description) form.set('description', meta[i].description);
      if (meta[i]?.studyDate) form.set('studyDate', meta[i].studyDate);
      try {
        await onUpload(form);
        ok++;
      } catch (err) {
        toast.error(`${f.name}: ${err instanceof ApiError ? err.message : 'no se pudo subir'}`);
      }
    }
    setBusy(false);
    if (ok) toast.success(ok === 1 ? 'Archivo guardado' : `${ok} archivos guardados`);
    onClose();
  };

  return (
    <Dialog
      open={files.length > 0}
      onOpenChange={(o) => !o && !busy && onClose()}
      title={files.length === 1 ? 'Subir archivo' : `Subir ${files.length} archivos`}
      description="Clasifíquelos para encontrarlos fácilmente después."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={submit} loading={busy}>
            <Upload aria-hidden /> Guardar en el expediente
          </Button>
        </>
      }
    >
      <ul className="grid gap-4">
        {files.map((f, i) => (
          <li key={`${f.name}-${i}`} className="rounded-2xl bg-mist p-4">
            <p className="truncate text-sm font-semibold">
              {f.name} <span className="font-normal text-muted">· {formatBytes(f.size)}</span>
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Categoría">
                {(id) => (
                  <Select id={id} value={meta[i]?.category ?? 'otro'} onChange={(e) => setMeta((m) => m.map((x, j) => (j === i ? { ...x, category: e.target.value as FileCategory } : x)))}>
                    {FILE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {FILE_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Fecha del estudio">
                {(id) => <Input id={id} type="date" value={meta[i]?.studyDate ?? ''} onChange={(e) => setMeta((m) => m.map((x, j) => (j === i ? { ...x, studyDate: e.target.value } : x)))} />}
              </Field>
              <Field label="Descripción (opcional)" className="sm:col-span-2">
                {(id) => (
                  <Input
                    id={id}
                    placeholder="p. ej. Biometría hemática, Rx de cadera…"
                    value={meta[i]?.description ?? ''}
                    onChange={(e) => setMeta((m) => m.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
                  />
                )}
              </Field>
            </div>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

function ViewerDialog({ file, onClose, onArchive }: { file: FileItem | null; onClose: () => void; onArchive: (id: string) => Promise<unknown> }) {
  const [confirm, setConfirm] = useState(false);
  if (!file) return null;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={file.description || file.filename}
      description={`${FILE_CATEGORY_LABELS[file.category]} · ${file.studyDate ? formatDate(file.studyDate) : formatDate(file.createdAt)} · ${formatBytes(file.size)}${file.createdByName ? ` · subido por ${file.createdByName}` : ''}`}
      footer={
        <>
          {confirm ? (
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await onArchive(file.id);
                  toast.success('Archivo archivado');
                  onClose();
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : 'No se pudo archivar.');
                }
              }}
            >
              Confirmar: archivar
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setConfirm(true)}>
              <Archive aria-hidden /> Archivar
            </Button>
          )}
          <a href={fileUrl(file.id, true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 font-semibold text-white hover:bg-brand-800">
            <Download className="size-4.5" aria-hidden /> Descargar
          </a>
        </>
      }
    >
      {isViewableImage(file.mime) ? (
        <img src={fileUrl(file.id)} alt={file.description ?? file.filename} className="mx-auto max-h-[65vh] rounded-xl" />
      ) : file.mime === 'application/pdf' ? (
        <iframe src={fileUrl(file.id)} title={file.filename} className="h-[65vh] w-full rounded-xl border border-line" />
      ) : (
        <p className="text-muted">Este tipo de archivo no se puede previsualizar. Descárguelo para abrirlo.</p>
      )}
    </Dialog>
  );
}
