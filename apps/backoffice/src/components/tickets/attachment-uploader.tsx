"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, ImageIcon, Paperclip, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

export type UploadedFile = {
  url: string;
  publicId: string;
  filename: string;
  contentType: string;
  size: number;
};

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo
const ACCEPTED_PREFIXES = ["image/", "text/", "application/pdf"];
const ACCEPTED_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
];
// Certains OS n'envoient pas de MIME (ex. .md) : on retombe sur l'extension.
const ACCEPTED_EXTENSIONS = /\.(pdf|docx?|xlsx?|pptx?|csv|txt|md|json|zip)$/i;
const INPUT_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.json,.zip";

const CHIP_DRAG_TYPE = "application/x-attachment-id";

function isAccepted(f: File) {
  return (
    ACCEPTED_PREFIXES.some((t) => f.type.startsWith(t)) ||
    ACCEPTED_TYPES.includes(f.type) ||
    ACCEPTED_EXTENSIONS.test(f.name)
  );
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} Ko`
    : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/**
 * Upload direct navigateur → Cloudinary (signé côté serveur).
 * Les fichiers ne transitent jamais par nos fonctions serverless
 * (limite 4,5 Mo de Vercel).
 */
export function AttachmentUploader({
  value,
  onChange,
}: {
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [draggingChip, setDraggingChip] = useState<string | null>(null);
  const [trashHover, setTrashHover] = useState(false);
  const [removing, setRemoving] = useState<string[]>([]);
  // Les dragenter/dragleave se déclenchent sur chaque enfant : on compte.
  const dropDepth = useRef(0);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const files = Array.from(fileList);

    if (value.length + files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} fichiers.`);
      return;
    }
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name} dépasse 10 Mo.`);
        return;
      }
      if (!isAccepted(f)) {
        toast.error(`${f.name} : type de fichier non accepté.`);
        return;
      }
    }

    setUploading(true);
    try {
      const signRes = await fetch("/api/uploads/sign", { method: "POST" });
      if (!signRes.ok) throw new Error("sign failed");
      const sign = await signRes.json();

      const uploaded: UploadedFile[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("api_key", sign.apiKey);
        form.append("timestamp", String(sign.timestamp));
        form.append("signature", sign.signature);
        form.append("folder", sign.folder);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sign.cloudName}/auto/upload`,
          { method: "POST", body: form }
        );
        if (!res.ok) throw new Error("upload failed");
        const data = await res.json();
        uploaded.push({
          url: data.secure_url,
          publicId: data.public_id,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });
      }
      onChange([...value, ...uploaded]);
    } catch {
      toast.error("Échec de l'upload. Réessayez.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function removeFile(publicId: string) {
    // Petit délai pour laisser jouer l'animation de sortie du chip.
    setRemoving((r) => [...r, publicId]);
    setTimeout(() => {
      onChange(value.filter((v) => v.publicId !== publicId));
      setRemoving((r) => r.filter((id) => id !== publicId));
    }, 200);
  }

  const chipDragActive = draggingChip !== null;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Zone de drop */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Déposer des fichiers ou cliquer pour parcourir"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragEnter={(e) => {
          if (chipDragActive) return;
          e.preventDefault();
          dropDepth.current += 1;
          setDropHover(true);
        }}
        onDragOver={(e) => {
          if (chipDragActive) return;
          e.preventDefault();
        }}
        onDragLeave={() => {
          if (chipDragActive) return;
          dropDepth.current -= 1;
          if (dropDepth.current <= 0) {
            dropDepth.current = 0;
            setDropHover(false);
          }
        }}
        onDrop={(e) => {
          if (chipDragActive) return;
          e.preventDefault();
          dropDepth.current = 0;
          setDropHover(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-all duration-200",
          dropHover
            ? "scale-[1.02] border-primary bg-primary/10"
            : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/40",
          (uploading || value.length >= MAX_FILES) && "pointer-events-none opacity-50"
        )}
      >
        <UploadCloud
          className={cn(
            "size-6 text-muted-foreground transition-transform duration-200",
            dropHover && "-translate-y-0.5 scale-125 text-primary"
          )}
        />
        <p className="text-sm font-medium">
          {uploading
            ? "Upload en cours…"
            : dropHover
              ? "Lâche tes fichiers ici !"
              : "Glisse tes fichiers ici ou clique"}
        </p>
        <p className="text-xs text-muted-foreground">
          Images, PDF, Office, texte, zip — max {MAX_FILES} fichiers de 10 Mo
        </p>
      </div>

      {/* Fichiers chargés + corbeille */}
      {value.length > 0 && (
        <div className="flex items-start justify-between gap-3">
          <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {value.map((f) => (
              <li
                key={f.publicId}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(CHIP_DRAG_TYPE, f.publicId);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggingChip(f.publicId);
                }}
                onDragEnd={() => {
                  setDraggingChip(null);
                  setTrashHover(false);
                }}
                className={cn(
                  "flex max-w-full cursor-grab items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-sm transition-all duration-200 active:cursor-grabbing",
                  draggingChip === f.publicId && "scale-95 opacity-50",
                  removing.includes(f.publicId) && "scale-75 opacity-0"
                )}
              >
                {f.contentType.startsWith("image/") ? (
                  <ImageIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate max-w-40">{f.filename}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatSize(f.size)}
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(f.publicId)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Retirer ${f.filename}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {/* Corbeille : grossit à l'approche, frétille au survol */}
          <div
            onDragEnter={(e) => {
              if (!chipDragActive) return;
              e.preventDefault();
              setTrashHover(true);
            }}
            onDragOver={(e) => {
              if (!chipDragActive) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
            }}
            onDragLeave={() => setTrashHover(false)}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData(CHIP_DRAG_TYPE);
              setTrashHover(false);
              setDraggingChip(null);
              if (id) removeFile(id);
            }}
            aria-label="Glisser un fichier ici pour le supprimer"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full border transition-all duration-200",
              trashHover
                ? "scale-150 border-destructive bg-destructive/15 text-destructive shadow-lg"
                : chipDragActive
                  ? "scale-125 border-destructive/60 bg-destructive/5 text-destructive"
                  : "border-muted-foreground/25 text-muted-foreground/60"
            )}
          >
            <Trash2 className={cn("size-4", trashHover && "animate-trash-wiggle")} />
          </div>
        </div>
      )}

      {value.length === 0 && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="size-3" />
          Aucune pièce jointe pour l&apos;instant.
        </p>
      )}
    </div>
  );
}
