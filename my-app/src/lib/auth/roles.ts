export const ROLE_CODES = [
  "CITIZEN",
  "DEPARTMENT_STAFF",
  "MODERATOR",
  "ADMINISTRATOR",
] as const;

export type RoleCode = (typeof ROLE_CODES)[number];

export const ROLE_SEEDS: readonly {
  code: RoleCode;
  name: string;
  description: string;
}[] = [
  {
    code: "CITIZEN",
    name: "Citizen",
    description: "Report civic issues and follow their own reports.",
  },
  {
    code: "DEPARTMENT_STAFF",
    name: "Department staff",
    description: "Work on issues for one active department membership.",
  },
  {
    code: "MODERATOR",
    name: "Moderator",
    description: "Review reports and moderate public discussion.",
  },
  {
    code: "ADMINISTRATOR",
    name: "Administrator",
    description: "Grant roles, manage departments, and disable accounts.",
  },
];

export function isRoleCode(value: string): value is RoleCode {
  return (ROLE_CODES as readonly string[]).includes(value);
}
