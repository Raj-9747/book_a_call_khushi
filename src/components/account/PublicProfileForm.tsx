"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2, Upload } from "lucide-react";
import {
  Avatar,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormField,
  Input,
  Textarea,
} from "@/components/ui";
import {
  removeAdminLogo,
  removeAdminPhoto,
  updateProfileFields,
  uploadAdminLogo,
  uploadAdminPhoto,
} from "@/lib/api/admins";
import type { Admin } from "@/types/models";

/** Optional URL field: empty string is valid and stores as null, but if the
 * admin types something it has to actually be a URL — a half-typed handle
 * would render as a broken link on the public page. */
const optionalUrl = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .refine((value) => value === null || /^https?:\/\/.+\..+/.test(value), "Enter a full URL starting with https://");

const schema = z.object({
  headline: z
    .string()
    .trim()
    .max(120, "Keep the headline under 120 characters")
    .transform((value) => (value === "" ? null : value)),
  about: z
    .string()
    .trim()
    .max(1500, "Keep the about section under 1500 characters")
    .transform((value) => (value === "" ? null : value)),
  linkedin_url: optionalUrl,
  instagram_url: optionalUrl,
  x_url: optionalUrl,
  website_url: optionalUrl,
  company_name: z
    .string()
    .trim()
    .max(120, "Keep the company name under 120 characters")
    .transform((value) => (value === "" ? null : value)),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export function PublicProfileForm({ admin }: { admin: Admin }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState(admin.photo_url);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [logoUrl, setLogoUrl] = useState(admin.company_logo_url);
  const [logoBusy, setLogoBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      headline: admin.headline ?? "",
      about: admin.about ?? "",
      linkedin_url: admin.linkedin_url ?? "",
      instagram_url: admin.instagram_url ?? "",
      x_url: admin.x_url ?? "",
      website_url: admin.website_url ?? "",
      company_name: admin.company_name ?? "",
    },
  });

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file still fires onChange.
    event.target.value = "";
    if (!file) return;

    setPhotoBusy(true);
    try {
      const url = await uploadAdminPhoto(admin.id, file, photoUrl);
      setPhotoUrl(url);
      toast.success("Photo updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handlePhotoRemove() {
    setPhotoBusy(true);
    try {
      await removeAdminPhoto(admin.id, photoUrl);
      setPhotoUrl(null);
      toast.success("Photo removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove photo");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setLogoBusy(true);
    try {
      const url = await uploadAdminLogo(admin.id, file, logoUrl);
      setLogoUrl(url);
      toast.success("Logo updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload logo");
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleLogoRemove() {
    setLogoBusy(true);
    try {
      await removeAdminLogo(admin.id, logoUrl);
      setLogoUrl(null);
      toast.success("Logo removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove logo");
    } finally {
      setLogoBusy(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await updateProfileFields(admin.id, values);
      toast.success("Public profile updated");
      reset({
        headline: values.headline ?? "",
        about: values.about ?? "",
        linkedin_url: values.linkedin_url ?? "",
        instagram_url: values.instagram_url ?? "",
        x_url: values.x_url ?? "",
        website_url: values.website_url ?? "",
        company_name: values.company_name ?? "",
      });
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Public profile</CardTitle>
        <CardDescription>
          What clients see on your booking page. Every field here is optional — anything you leave blank is simply
          hidden.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardContent className="space-y-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar name={admin.name} src={photoUrl} className="h-20 w-20 text-xl" />
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoChange}
              />
              <Button
                type="button"
                variant="outline"
                isLoading={photoBusy}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {photoUrl ? "Replace photo" : "Upload photo"}
              </Button>
              {photoUrl && (
                <Button type="button" variant="ghost" disabled={photoBusy} onClick={handlePhotoRemove}>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
              <p className="w-full text-xs text-neutral-500">JPG, PNG or WebP. Up to 2 MB.</p>
            </div>
          </div>

          <FormField
            label="Headline"
            htmlFor="profile-headline"
            error={errors.headline?.message}
            hint="One line under your name, e.g. “Founder at Phaze · Product & Growth”."
          >
            <Input id="profile-headline" placeholder="What you do, in a line" {...register("headline")} />
          </FormField>

          <FormField
            label="About"
            htmlFor="profile-about"
            error={errors.about?.message}
            hint="A short intro shown on your profile page."
          >
            <Textarea id="profile-about" rows={5} placeholder="Tell clients who you are…" {...register("about")} />
          </FormField>

          <FormField label="LinkedIn" htmlFor="profile-linkedin" error={errors.linkedin_url?.message}>
            <Input id="profile-linkedin" placeholder="https://linkedin.com/in/…" {...register("linkedin_url")} />
          </FormField>

          <FormField label="Instagram" htmlFor="profile-instagram" error={errors.instagram_url?.message}>
            <Input id="profile-instagram" placeholder="https://instagram.com/…" {...register("instagram_url")} />
          </FormField>

          {/* Labelled "X (Twitter)" rather than just "X" — plenty of people
              still recognise it by the old name. */}
          <FormField label="X (Twitter)" htmlFor="profile-x" error={errors.x_url?.message}>
            <Input id="profile-x" placeholder="https://x.com/…" {...register("x_url")} />
          </FormField>

          <FormField label="Website" htmlFor="profile-website" error={errors.website_url?.message}>
            <Input id="profile-website" placeholder="https://yoursite.com" {...register("website_url")} />
          </FormField>

          <div className="space-y-4 border-t border-border pt-5">
            <div>
              <p className="text-sm font-medium text-neutral-800">Company branding</p>
              <p className="text-xs text-neutral-500">
                Shown on the meeting-notes document sent after a recorded call. Leave blank to send it unbranded.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-neutral-50">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external Storage URL, not a local asset
                  <img src={logoUrl} alt="Company logo" className="h-full w-full object-contain" />
                ) : (
                  <span className="text-xs text-neutral-400">No logo</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  isLoading={logoBusy}
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {logoUrl ? "Replace logo" : "Upload logo"}
                </Button>
                {logoUrl && (
                  <Button type="button" variant="ghost" disabled={logoBusy} onClick={handleLogoRemove}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                )}
                <p className="w-full text-xs text-neutral-500">JPG, PNG or WebP. Up to 2 MB.</p>
              </div>
            </div>

            <FormField label="Company name" htmlFor="profile-company-name" error={errors.company_name?.message}>
              <Input id="profile-company-name" placeholder="e.g. Phaze" {...register("company_name")} />
            </FormField>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" isLoading={submitting} disabled={!isDirty}>
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
