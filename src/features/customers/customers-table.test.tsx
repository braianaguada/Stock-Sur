import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomersDataTable } from "./components/CustomersDataTable";
import type { Customer } from "./types";

describe("customers table", () => {
  it("does not allow editing legacy occasional customers from Clientes", () => {
    const customers: Customer[] = [{
      id: "legacy-occasional",
      company_id: "company-1",
      name: "Cliente ocasional / Consumidor Final",
      cuit: null,
      email: null,
      phone: null,
      is_occasional: true,
      fiscal_profile: null,
    }];

    render(
      <CustomersDataTable
        customers={customers}
        isLoading={false}
        onViewAccount={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Sistema legacy")).toBeInTheDocument();
    expect(screen.getByLabelText("Cliente ocasional no se edita desde Clientes")).toBeDisabled();
    expect(screen.getByLabelText("El cliente ocasional no tiene cuenta corriente")).toBeDisabled();
    expect(screen.getByLabelText("Cliente ocasional no se elimina desde Clientes")).toBeDisabled();
  });
});
