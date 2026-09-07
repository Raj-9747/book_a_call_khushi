"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Pencil } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, useConfirm } from "@/components/ui";
import { updateOwnProfile } from "@/lib/api/admins";
import { slugSchema } from "@/lib/validations/slug";
import type { Admin } from "@/types/models";

/** The admin's public booking link. Kept separate from the rest of the
 * profile form: changing it immediately breaks any `/book/<old-slug>` link
 * already shared, which deserves an explicit warning rather than being one
 * more field a "Save changes" button quietly includes. */
export function PublicLinkCard({ admin }: { admin: Admin }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(admin.slug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  // Empty until mount so the server and client render the same markup —
  // window.location doesn't exist during SSR, and interpolating it directly
  // would be a hydration mismatch.
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    function readOrigin() {
      setOrigin(window.location.origin);
    }
    readOrigin();
  }, []);

  // Reset the "Copied" label shortly after, so the button doesn't sit there
  // claiming success forever.
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/book/${admin.slug}`);
      setCopied(true);
    } catch {
      // Clipboard access can be blocked (insecure origin, permissions) —
      // the URL is visible above either way, so this is recoverable.
      toast.error("Couldn't copy — select the link above and copy it manually.");
    }
  }

  function startEditing() {
    setValue(admin.slug);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const result = slugSchema.safeParse(value);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid link");
      return;
    }
    const nextSlug = result.data;
    if (nextSlug === admin.slug) {
      setEditing(false);
      return;
    }

    const confirmed = await confirm({
      title: "Change your booking link?",
      description: `Your link will become /book/${nextSlug}. The old link (/book/${admin.slug}) will stop working immediately — anyone who saved or was sent it won't be able to book with you there anymore.`,
      confirmLabel: "Change it",
      tone: "danger",
    });
    if (!confirmed) return;

    setSaving(true);
    try {
      await updateOwnProfile({ slug: nextSlug });
      toast.success("Your booking link has been updated");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update your link");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your booking link</CardTitle>
        <CardDescription>This is the link you share with clients.</CardDescription>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="space-y-3">
            <FormField label="Link" error={error ?? undefined} hint="Lowercase letters, numbers and hyphens only.">
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-sm text-neutral-400">/book/</span>
                <Input
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                  autoFocus
                />
              </div>
            </FormField>
            <div className="flex gap-2">
              <Button type="button" isLoading={saving} onClick={handleSave}>
                Save
              </Button>
              <Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* The full URL, shown the way you'd paste it to a client —
                selectable, and wrapping rather than truncating so a long
                slug is still readable in full. */}
            <p className="break-all rounded-md border border-border bg-surface-muted px-3 py-2.5 font-mono text-sm text-neutral-700">
              {origin}/book/{admin.slug}
            </p>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy link"}
              </Button>

              {/* An <a> styled as a button rather than a Button wrapping a
                  link — nesting interactive elements is invalid, and this
                  keeps middle-click / "open in new tab" working properly. */}
              <a
                href={`/book/${admin.slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-50"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View page
              </a>

              <Button type="button" variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
