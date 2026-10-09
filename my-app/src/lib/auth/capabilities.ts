export const Capability = {
  accountSelf: "account.self",
  departmentWork: "department.work",
  issueModerate: "issue.moderate",
  roleGrant: "role.grant",
  accountDisable: "account.disable",
} as const;

export type CapabilityName = (typeof Capability)[keyof typeof Capability];

export function capabilitiesFor(
  roleCodes: readonly string[],
  departmentId: string | null,
): ReadonlySet<CapabilityName> {
  const capabilities = new Set<CapabilityName>();
  if (roleCodes.includes("CITIZEN")) capabilities.add(Capability.accountSelf);
  if (roleCodes.includes("DEPARTMENT_STAFF") && departmentId) {
    capabilities.add(Capability.departmentWork);
  }
  if (roleCodes.includes("MODERATOR")) capabilities.add(Capability.issueModerate);
  if (roleCodes.includes("ADMINISTRATOR")) {
    capabilities.add(Capability.roleGrant);
    capabilities.add(Capability.accountDisable);
  }
  return capabilities;
}

export function hasCapability(
  capabilities: ReadonlySet<string>,
  capability: CapabilityName,
): boolean {
  return capabilities.has(capability);
}
