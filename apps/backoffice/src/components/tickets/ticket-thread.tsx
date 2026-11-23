import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type Attachment = {
  id: string;
  url: string;
  filename: string;
  contentType: string;
};

function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((a) =>
        a.contentType.startsWith("image/") ? (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
            <Image
              src={a.url}
              alt={a.filename}
              width={120}
              height={80}
              className="rounded border object-cover h-20 w-auto"
              unoptimized
            />
          </a>
        ) : (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm underline text-muted-foreground"
          >
            📄 {a.filename}
          </a>
        )
      )}
    </div>
  );
}

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function TicketThread({
  description,
  authorName,
  createdAt,
  ticketAttachments,
  comments,
}: {
  description: string;
  authorName: string;
  createdAt: Date;
  ticketAttachments: Attachment[];
  comments: {
    id: string;
    body: string;
    createdAt: Date;
    author: { name: string; role: string };
    attachments: Attachment[];
  }[];
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-sm">{authorName}</span>
            <span className="text-xs text-muted-foreground">
              {dateFmt.format(createdAt)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{description}</p>
          <AttachmentList attachments={ticketAttachments} />
        </CardContent>
      </Card>

      {comments.map((c) => (
        <Card key={c.id}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-medium text-sm">{c.author.name}</span>
              {c.author.role === "ADMIN" && (
                <Badge variant="secondary" className="text-xs">
                  Développeur
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {dateFmt.format(c.createdAt)}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            <AttachmentList attachments={c.attachments} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
