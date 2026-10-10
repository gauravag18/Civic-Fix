import { Severity } from "@/generated/prisma/enums";
import {
  FIELD_CATEGORY,
  FIELD_CITY,
  FIELD_CONTROL,
  FIELD_COORDINATE_PAIR,
  FIELD_DESCRIPTION,
  FIELD_LATITUDE,
  FIELD_LOCALITY,
  FIELD_LOCATION,
  FIELD_LONGITUDE,
  FIELD_POSTAL,
  FIELD_SEVERITY,
  FIELD_TITLE,
} from "@/lib/issues/messages";
import type { SeverityValue } from "@/lib/issues/types";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COORDINATE = /^-?\d{1,3}(\.\d{1,6})?$/;
const POSTAL = /^[A-Za-z0-9 -]+$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export type IssueFieldErrors = Partial<{
  title: string;
  description: string;
  categoryId: string;
  severity: string;
  locationDescription: string;
  city: string;
  locality: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  photos: string;
}>;

export type RawIssueFields = {
  title: string;
  description: string;
  categoryId: string;
  severity: string;
  locationDescription: string;
  city: string;
  locality: string;
  postalCode: string;
  latitude: string;
  longitude: string;
};

export type ValidIssueFields = {
  title: string;
  description: string;
  categoryId: string;
  severity: SeverityValue;
  locationDescription: string;
  city: string;
  locality: string | null;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
};

function cleanLine(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
}

function coordinate(value: string, minimum: number, maximum: number): string | null {
  const trimmed = value.trim();
  if (!COORDINATE.test(trimmed)) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < minimum || numeric > maximum) return null;
  return trimmed;
}

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function validateIssueFields(
  input: RawIssueFields,
): { ok: true; value: ValidIssueFields } | { ok: false; fieldErrors: IssueFieldErrors } {
  const fieldErrors: IssueFieldErrors = {};
  const title = cleanLine(input.title);
  const description = input.description.replace(/\r\n/g, "\n").trim();
  const locationDescription = cleanLine(input.locationDescription);
  const city = cleanLine(input.city);
  const locality = cleanLine(input.locality);
  const postalCode = cleanLine(input.postalCode);
  const latitudeRaw = input.latitude.trim();
  const longitudeRaw = input.longitude.trim();

  if (CONTROL.test(input.title) || title.length < 8 || title.length > 160) {
    fieldErrors.title = CONTROL.test(input.title) ? FIELD_CONTROL : FIELD_TITLE;
  }
  if (
    CONTROL.test(input.description) ||
    description.length < 20 ||
    description.length > 5000
  ) {
    fieldErrors.description = CONTROL.test(input.description)
      ? FIELD_CONTROL
      : FIELD_DESCRIPTION;
  }
  if (!isUuid(input.categoryId.trim())) fieldErrors.categoryId = FIELD_CATEGORY;
  if (!(Object.values(Severity) as string[]).includes(input.severity)) {
    fieldErrors.severity = FIELD_SEVERITY;
  }
  if (
    CONTROL.test(input.locationDescription) ||
    locationDescription.length < 3 ||
    locationDescription.length > 500
  ) {
    fieldErrors.locationDescription = CONTROL.test(input.locationDescription)
      ? FIELD_CONTROL
      : FIELD_LOCATION;
  }
  if (CONTROL.test(input.city) || city.length < 1 || city.length > 120) {
    fieldErrors.city = CONTROL.test(input.city) ? FIELD_CONTROL : FIELD_CITY;
  }
  if (locality && (CONTROL.test(input.locality) || locality.length > 160)) {
    fieldErrors.locality = CONTROL.test(input.locality) ? FIELD_CONTROL : FIELD_LOCALITY;
  }
  if (postalCode && (CONTROL.test(input.postalCode) || !POSTAL.test(postalCode) || postalCode.length > 16)) {
    fieldErrors.postalCode = CONTROL.test(input.postalCode) ? FIELD_CONTROL : FIELD_POSTAL;
  }

  const latitude = latitudeRaw ? coordinate(latitudeRaw, -90, 90) : null;
  const longitude = longitudeRaw ? coordinate(longitudeRaw, -180, 180) : null;
  if (latitudeRaw && !latitude) fieldErrors.latitude = FIELD_LATITUDE;
  if (longitudeRaw && !longitude) fieldErrors.longitude = FIELD_LONGITUDE;
  if (Boolean(latitudeRaw) !== Boolean(longitudeRaw)) {
    fieldErrors.latitude ??= FIELD_COORDINATE_PAIR;
    fieldErrors.longitude ??= FIELD_COORDINATE_PAIR;
  }

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };

  return {
    ok: true,
    value: {
      title,
      description,
      categoryId: input.categoryId.trim(),
      severity: input.severity as SeverityValue,
      locationDescription,
      city,
      locality: locality || null,
      postalCode: postalCode || null,
      latitude,
      longitude,
    },
  };
}
