"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { Severity } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitIssue, type IssueFormState } from "@/lib/issues/actions";
import { severityLabel } from "@/lib/issues/labels";
import type { IssueCategoryOption } from "@/lib/issues/types";

const initial: IssueFormState = { message: "", fieldErrors: {} };

type SelectedPhoto = { key: string; file: File; url: string };

const controlClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-base text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-small text-destructive">
      {message}
    </p>
  );
}

function RequiredMark() {
  return <span className="text-small font-semibold text-muted-foreground"> Required</span>;
}

function Section({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-5">
      <div>
        <h2 className="text-section font-semibold">{title}</h2>
        <p className="mt-1 text-small text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export function ReportForm({ categories }: { categories: IssueCategoryOption[] }) {
  const [state, formAction, pending] = useActionState(submitIssue, initial);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [photoNote, setPhotoNote] = useState("");
  const photosRef = useRef(photos);
  const errors = state.fieldErrors;

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) URL.revokeObjectURL(photo.url);
    };
  }, []);

  function addPhotos(list: FileList | null) {
    if (!list) return;
    const next = [...photos];
    let note = "";
    for (const file of Array.from(list)) {
      if (next.length >= 4) {
        note = "You can attach up to 4 photographs.";
        break;
      }
      next.push({ key: crypto.randomUUID(), file, url: URL.createObjectURL(file) });
    }
    setPhotoNote(note);
    setPhotos(next);
  }

  function removePhoto(key: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.key === key);
      if (removed) URL.revokeObjectURL(removed.url);
      return current.filter((photo) => photo.key !== key);
    });
    setPhotoNote("");
  }

  return (
    <form
      action={(formData) => {
        for (const photo of photos) formData.append("photos", photo.file);
        formAction(formData);
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {state.message ? (
        <p role="alert" className="text-destructive">
          {state.message}
        </p>
      ) : null}

      <Section title="Issue" hint="Say what is wrong and how serious it is.">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">
            Title
            <RequiredMark />
          </Label>
          <Input
            id="title"
            name="title"
            required
            minLength={8}
            maxLength={160}
            autoComplete="off"
            aria-invalid={Boolean(errors.title)}
            aria-describedby={errors.title ? "title-error" : "title-hint"}
          />
          <p id="title-hint" className="text-small text-muted-foreground">
            A short name for the problem, from 8 to 160 characters.
          </p>
          <FieldError id="title-error" message={errors.title} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">
            Description
            <RequiredMark />
          </Label>
          <Textarea
            id="description"
            name="description"
            required
            minLength={20}
            maxLength={5000}
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? "description-error" : "description-hint"}
          />
          <p id="description-hint" className="text-small text-muted-foreground">
            What is wrong and who it affects. 20 to 5000 characters.
          </p>
          <FieldError id="description-error" message={errors.description} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="categoryId">
              Category
              <RequiredMark />
            </Label>
            <select
              id="categoryId"
              name="categoryId"
              required
              defaultValue=""
              aria-invalid={Boolean(errors.categoryId)}
              aria-describedby={errors.categoryId ? "category-error" : undefined}
              className={controlClass}
            >
              <option value="">Choose a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <FieldError id="category-error" message={errors.categoryId} />
          </div>
          <fieldset
            className="flex flex-col gap-2"
            aria-invalid={Boolean(errors.severity)}
            aria-describedby={errors.severity ? "severity-error" : undefined}
          >
            <legend className="text-label font-semibold">
              Severity
              <RequiredMark />
            </legend>
            {Object.values(Severity).map((severity) => (
              <label key={severity} className="flex items-center gap-2 text-body">
                <input type="radio" name="severity" value={severity} />
                {severityLabel(severity)}
              </label>
            ))}
            <FieldError id="severity-error" message={errors.severity} />
          </fieldset>
        </div>
      </Section>

      <Section title="Location" hint="Name the street, landmark, neighbourhood, and city. A map point is not needed.">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="locationDescription">
            Street or landmark
            <RequiredMark />
          </Label>
          <Input
            id="locationDescription"
            name="locationDescription"
            required
            minLength={3}
            maxLength={500}
            autoComplete="street-address"
            aria-invalid={Boolean(errors.locationDescription)}
            aria-describedby={errors.locationDescription ? "location-error" : "location-hint"}
          />
          <p id="location-hint" className="text-small text-muted-foreground">
            An address or landmark someone can use to find the problem.
          </p>
          <FieldError id="location-error" message={errors.locationDescription} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="locality">Neighbourhood</Label>
            <Input
              id="locality"
              name="locality"
              maxLength={160}
              autoComplete="address-level3"
              aria-invalid={Boolean(errors.locality)}
              aria-describedby={errors.locality ? "locality-error" : "locality-hint"}
            />
            <p id="locality-hint" className="text-small text-muted-foreground">
              Optional.
            </p>
            <FieldError id="locality-error" message={errors.locality} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="city">
              City
              <RequiredMark />
            </Label>
            <Input
              id="city"
              name="city"
              required
              maxLength={120}
              autoComplete="address-level2"
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? "city-error" : undefined}
            />
            <FieldError id="city-error" message={errors.city} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input
            id="postalCode"
            name="postalCode"
            maxLength={16}
            autoComplete="postal-code"
            className="sm:max-w-48"
            aria-invalid={Boolean(errors.postalCode)}
            aria-describedby={errors.postalCode ? "postal-error" : "postal-hint"}
          />
          <p id="postal-hint" className="text-small text-muted-foreground">
            Optional.
          </p>
          <FieldError id="postal-error" message={errors.postalCode} />
        </div>
      </Section>

      <Section title="Photographs" hint="Optional. Add up to 4 JPEG, PNG, or WebP photographs, 5 MB each.">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="photos">Upload photographs</Label>
          <input
            id="photos"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="w-full border border-input bg-card px-3 py-2 text-base text-foreground file:mr-3 file:border-0 file:bg-transparent file:text-base file:text-foreground"
            aria-invalid={Boolean(errors.photos)}
            aria-describedby={errors.photos ? "photos-error" : "photos-hint"}
            onChange={(event) => {
              addPhotos(event.target.files);
              event.target.value = "";
            }}
          />
          <p id="photos-hint" className="text-small text-muted-foreground">
            {photos.length} of 4 selected.
          </p>
          <FieldError id="photos-error" message={errors.photos} />
          {photoNote ? (
            <p role="alert" className="text-small text-destructive">
              {photoNote}
            </p>
          ) : null}
          {photos.length > 0 ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.key} className="flex flex-col gap-2">
                  <img
                    src={photo.url}
                    alt="Selected photograph"
                    className="h-24 w-full border border-border object-cover"
                  />
                  <button type="button" className="text-small underline" onClick={() => removePhoto(photo.key)}>
                    Remove photograph
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Section>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Submitting report" : "Submit report"}
      </Button>
    </form>
  );
}
