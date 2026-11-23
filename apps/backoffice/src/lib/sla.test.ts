import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  canTransition,
  computeDueDate,
  isOverdue,
  statusChangeFields,
} from "./sla";

describe("addBusinessDays", () => {
  it("skips weekends", () => {
    // Vendredi 17 juillet 2026 + 2 jours ouvrés = mardi 21 juillet
    const friday = new Date("2026-07-17T10:00:00Z");
    const result = addBusinessDays(friday, 2);
    expect(result.getDay()).toBe(2); // mardi
    expect(result.getDate()).toBe(21);
  });

  it("adds within the same week", () => {
    const monday = new Date("2026-07-13T10:00:00Z");
    const result = addBusinessDays(monday, 3);
    expect(result.getDate()).toBe(16); // jeudi
  });
});

describe("computeDueDate", () => {
  it("URGENT is sooner than LOW", () => {
    const from = new Date("2026-07-13T10:00:00Z");
    expect(computeDueDate("URGENT", from).getTime()).toBeLessThan(
      computeDueDate("LOW", from).getTime()
    );
  });
});

describe("isOverdue", () => {
  const past = new Date(Date.now() - 24 * 3600 * 1000);
  const future = new Date(Date.now() + 24 * 3600 * 1000);

  it("open ticket past due date is overdue", () => {
    expect(isOverdue({ status: "NEW", dueDate: past })).toBe(true);
    expect(isOverdue({ status: "IN_PROGRESS", dueDate: past })).toBe(true);
    expect(isOverdue({ status: "IN_DEV", dueDate: past })).toBe(true);
  });

  it("open ticket before due date is not overdue", () => {
    expect(isOverdue({ status: "IN_PROGRESS", dueDate: future })).toBe(false);
  });

  it("resolved, closed or waiting-on-client tickets are never overdue", () => {
    expect(isOverdue({ status: "RESOLVED", dueDate: past })).toBe(false);
    expect(isOverdue({ status: "CLOSED", dueDate: past })).toBe(false);
    expect(isOverdue({ status: "WAITING_ON_CLIENT", dueDate: past })).toBe(false);
  });

  it("no due date, never overdue", () => {
    expect(isOverdue({ status: "NEW", dueDate: null })).toBe(false);
  });
});

describe("canTransition", () => {
  it("admin can move NEW to IN_PROGRESS", () => {
    expect(canTransition("NEW", "IN_PROGRESS", "ADMIN")).toBe(true);
  });

  it("admin can close a resolved ticket", () => {
    expect(canTransition("RESOLVED", "CLOSED", "ADMIN")).toBe(true);
  });

  it("admin can freely reopen from CLOSED or RESOLVED", () => {
    expect(canTransition("CLOSED", "RESOLVED", "ADMIN")).toBe(true);
    expect(canTransition("CLOSED", "IN_PROGRESS", "ADMIN")).toBe(true);
    expect(canTransition("RESOLVED", "IN_PROGRESS", "ADMIN")).toBe(true);
    expect(canTransition("RESOLVED", "NEW", "ADMIN")).toBe(true);
  });

  it("no-op transition is rejected", () => {
    expect(canTransition("NEW", "NEW", "ADMIN")).toBe(false);
  });

  it("client can reopen a RESOLVED or CLOSED ticket, nothing else", () => {
    expect(canTransition("RESOLVED", "IN_PROGRESS", "CLIENT")).toBe(true);
    expect(canTransition("CLOSED", "IN_PROGRESS", "CLIENT")).toBe(true);
    expect(canTransition("NEW", "RESOLVED", "CLIENT")).toBe(false);
    expect(canTransition("IN_PROGRESS", "CLOSED", "CLIENT")).toBe(false);
  });
});

describe("statusChangeFields", () => {
  it("RESOLVED stamps resolvedAt", () => {
    const fields = statusChangeFields("RESOLVED");
    expect(fields.resolvedAt).toBeInstanceOf(Date);
    expect(fields.closedAt).toBeNull();
  });

  it("CLOSED stamps closedAt", () => {
    expect(statusChangeFields("CLOSED").closedAt).toBeInstanceOf(Date);
  });

  it("reopening clears both dates", () => {
    const fields = statusChangeFields("IN_PROGRESS");
    expect(fields.resolvedAt).toBeNull();
    expect(fields.closedAt).toBeNull();
  });
});
