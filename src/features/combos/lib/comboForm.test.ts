import { describe, expect, it } from "vitest";
import { buildComboFormFromData, buildEmptyComboForm } from "./comboForm";

describe("comboForm", () => {
  it("builds an empty form without a selected combo", () => {
    const form = buildEmptyComboForm();
    expect(form.id).toBeNull();
    expect(form.name).toBe("");
    expect(form.lines).toHaveLength(1);
    expect(form.lines[0].clientId).toBeTruthy();
  });

  it("maps combo data into a stable editable form", () => {
    const form = buildComboFormFromData(
      {
        id: "combo-1",
        company_id: "company-1",
        name: "Kit",
        description: null,
        is_active: true,
        created_at: "2026-05-08T00:00:00Z",
        updated_at: "2026-05-08T00:00:00Z",
        created_by: null,
      },
      [
        { id: "line-2", combo_id: "combo-1", item_id: "item-2", quantity: 2, line_order: 2, notes: null, created_at: "2026-05-08T00:00:00Z" },
        { id: "line-1", combo_id: "combo-1", item_id: "item-1", quantity: 1, line_order: 1, notes: "note", created_at: "2026-05-08T00:00:00Z" },
      ],
    );

    expect(form.id).toBe("combo-1");
    expect(form.lines).toHaveLength(2);
    expect(form.lines[0].clientId).toBe("line-1");
    expect(form.lines[0].item_id).toBe("item-1");
    expect(form.lines[1].clientId).toBe("line-2");
  });
});
