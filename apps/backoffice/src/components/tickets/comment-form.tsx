"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addCommentAction } from "@/lib/actions/tickets";
import { AttachmentUploader, type UploadedFile } from "@/components/tickets/attachment-uploader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CommentForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState(addCommentAction, undefined);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state?.error) {
      formRef.current?.reset();
      setFiles([]);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="attachments" value={JSON.stringify(files)} />
      <Textarea
        name="body"
        required
        rows={3}
        placeholder="Votre réponse…"
      />
      <div className="flex items-center justify-between">
        <AttachmentUploader value={files} onChange={setFiles} />
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Répondre"}
        </Button>
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
