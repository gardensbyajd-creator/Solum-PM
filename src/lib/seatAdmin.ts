export type InternalSeatRole = "administrator" | "member";

export const internalSeatRoles: Array<{ value: InternalSeatRole; label: string }> = [
  { value: "administrator", label: "Administrator" },
  { value: "member", label: "Member" },
];

export function normaliseSeatInvite(input: { email: string; displayName: string; roleName: InternalSeatRole }) {
  return {
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    roleName: input.roleName,
  };
}

export function canManageInternalSeats(role?: string) {
  return role === "master_licence_holder" || role === "administrator";
}

export function isSeatInviteReady(input: { email: string; roleName: string }) {
  return /^\S+@\S+\.\S+$/.test(input.email.trim()) && (input.roleName === "administrator" || input.roleName === "member");
}
