"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  saveOnboardingDraftAction,
  submitOnboardingAction,
} from "@/lib/actions/onboarding";
import {
  ONBOARDING_SECTIONS,
  type OnboardingAnswers,
} from "@/lib/onboarding-schema";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function OnboardingForm({
  projectId,
  answers,
  readOnly,
}: {
  projectId: string;
  answers: Partial<OnboardingAnswers>;
  readOnly: boolean;
}) {
  const [draftState, draftAction, draftPending] = useActionState(
    saveOnboardingDraftAction,
    undefined
  );
  const [submitState, submitAction, submitPending] = useActionState(
    submitOnboardingAction,
    undefined
  );
  const wasDraftPending = useRef(false);

  useEffect(() => {
    if (wasDraftPending.current && !draftPending) {
      if (draftState?.saved) toast.success("Brouillon enregistré");
      if (draftState?.error) toast.error(draftState.error);
    }
    wasDraftPending.current = draftPending;
  }, [draftPending, draftState]);

  const pending = draftPending || submitPending;

  return (
    <form className="space-y-6">
      <input type="hidden" name="projectId" value={projectId} />
      {ONBOARDING_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && (
              <CardDescription>{section.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="grid gap-4">
            {section.fields.map((field) => (
              <div key={field.name} className="grid gap-2">
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required && !readOnly && (
                    <span className="text-destructive"> *</span>
                  )}
                </Label>
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.name}
                    name={field.name}
                    rows={3}
                    placeholder={field.placeholder}
                    defaultValue={answers[field.name] ?? ""}
                    disabled={readOnly}
                  />
                ) : (
                  <Input
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder}
                    defaultValue={answers[field.name] ?? ""}
                    disabled={readOnly}
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {!readOnly && (
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="outline"
            formAction={draftAction}
            disabled={pending}
          >
            {draftPending ? "Enregistrement…" : "Enregistrer le brouillon"}
          </Button>
          <Button type="submit" formAction={submitAction} disabled={pending}>
            {submitPending ? "Envoi…" : "Soumettre le questionnaire"}
          </Button>
          {submitState?.error && (
            <p className="text-sm text-destructive">{submitState.error}</p>
          )}
        </div>
      )}
    </form>
  );
}
