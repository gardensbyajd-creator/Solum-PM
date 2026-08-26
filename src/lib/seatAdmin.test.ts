import { describe, expect, it } from "vitest";
import { canManageInternalSeats, isSeatInviteReady, normaliseSeatInvite } from "./seatAdmin";

describe("internal seat administration", () => {
  it("normalises controlled internal seat invitations", () => {
    expect(normaliseSeatInvite({ email: " Team.Member@Example.com ", displayName: "  Taylor Green ", roleName: "administrator" })).toEqual({
      email: "team.member@example.com",
      displayName: "Taylor Green",
      roleName: "administrator",
    });
  });

  it("only permits recognised internal roles and a valid email", () => {
    expect(isSeatInviteReady({ email: "team@example.com", roleName: "member" })).toBe(true);
    expect(isSeatInviteReady({ email: "team@example.com", roleName: "master_licence_holder" })).toBe(false);
    expect(isSeatInviteReady({ email: "not-an-email", roleName: "member" })).toBe(false);
  });

  it("keeps seat management with organisational control roles", () => {
    expect(canManageInternalSeats("master_licence_holder")).toBe(true);
    expect(canManageInternalSeats("administrator")).toBe(true);
    expect(canManageInternalSeats("member")).toBe(false);
  });
});
