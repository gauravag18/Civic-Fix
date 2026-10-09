// Reviewed starter categories. The seed script upserts these by code.
// It does not create users, issues, or departments.
export const CATEGORY_SEEDS: readonly {
  code: string;
  name: string;
  sortOrder: number;
}[] = [
  { code: "ROADS", name: "Roads and pavements", sortOrder: 10 },
  { code: "LIGHTING", name: "Street lighting", sortOrder: 20 },
  { code: "DRAINAGE", name: "Drainage and flooding", sortOrder: 30 },
  { code: "WATER", name: "Water supply", sortOrder: 40 },
  { code: "SANITATION", name: "Sanitation and waste", sortOrder: 50 },
  { code: "PARKS", name: "Parks and public spaces", sortOrder: 60 },
  { code: "PUBLIC_SAFETY", name: "Public safety hazards", sortOrder: 70 },
  { code: "OTHER", name: "Other civic issue", sortOrder: 80 },
];
