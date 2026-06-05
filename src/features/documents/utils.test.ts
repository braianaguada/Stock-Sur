import { describe, expect, it } from "vitest";
import {
  buildDocumentCustomerSnapshot,
  getCustomerDisplayName,
  OCCASIONAL_CUSTOMER_DISPLAY_NAME,
} from "./utils";

describe("document customer helpers", () => {
  it("uses customer_id null as the occasional customer rule", () => {
    expect(getCustomerDisplayName({ customer_id: null, customer_name: "Snapshot viejo" })).toBe(
      OCCASIONAL_CUSTOMER_DISPLAY_NAME,
    );
  });

  it("uses the registered customer name when customer_id is present", () => {
    expect(getCustomerDisplayName({
      customer_id: "customer-1",
      customer_name: "Snapshot",
      customers: { name: "Cliente SA" },
    })).toBe("Cliente SA");
  });

  it("clears occasional customer snapshot when a registered customer is selected", () => {
    expect(buildDocumentCustomerSnapshot({
      customerId: "customer-1",
      manualCustomerName: OCCASIONAL_CUSTOMER_DISPLAY_NAME,
      pickedCustomer: { id: "customer-1", name: "Cliente SA", cuit: "20409378472" },
      manualTaxId: "",
      manualTaxCondition: "",
    })).toEqual({
      customer_id: "customer-1",
      customer_name: "Cliente SA",
      customer_tax_id: "20409378472",
      customer_tax_condition: null,
    });
  });
});
