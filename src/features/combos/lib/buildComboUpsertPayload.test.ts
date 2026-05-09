import { describe, expect, it } from "vitest";
import { buildComboUpsertPayload } from "./buildComboUpsertPayload";

describe("buildComboUpsertPayload", () => {
  it("trims and serializes combo lines for rpc", () => {
    const payload = buildComboUpsertPayload({
      companyId: "company-1",
      comboId: null,
      name: " Combo ",
      description: " Desc ",
      isActive: true,
      lines: [
        { item_id: "item-1", quantity: 2, line_order: 1, notes: " note " },
        { item_id: "", quantity: 1, line_order: 2, notes: "" },
      ],
    });

    expect(payload).toEqual({
      p_company_id: "company-1",
      p_combo_id: null,
      p_name: "Combo",
      p_description: "Desc",
      p_is_active: true,
      p_lines: [{ item_id: "item-1", quantity: 2, line_order: 1, notes: "note" }],
    });
  });
});
