import { getInvitationByToken } from "@/lib/actions/invitations";
import { AcceptForm } from "@/components/invite/accept-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Invitation" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        {invitation ? (
          <>
            <CardHeader>
              <CardTitle>Bienvenue !</CardTitle>
              <CardDescription>
                Créez votre compte pour accéder à l&apos;espace client{" "}
                <strong>{invitation.clientName}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AcceptForm token={token} email={invitation.email} />
            </CardContent>
          </>
        ) : (
          <CardHeader>
            <CardTitle>Invitation invalide</CardTitle>
            <CardDescription>
              Ce lien d&apos;invitation est invalide ou a expiré. Contactez la
              personne qui vous a invité pour en recevoir un nouveau.
            </CardDescription>
          </CardHeader>
        )}
      </Card>
    </main>
  );
}
