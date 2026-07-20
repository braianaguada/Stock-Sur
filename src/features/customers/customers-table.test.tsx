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
    expect(screen.getByText("Cliente ocasional / Consumidor Final")).toHaveClass("font-medium");
    expect(screen.getByLabelText("Cliente ocasional no se edita desde Clientes")).toBeDisabled();
    expect(screen.getByLabelText("El cliente ocasional no tiene cuenta corriente")).toBeDisabled();
    expect(screen.getByLabelText("Cliente ocasional no se elimina desde Clientes")).toBeDisabled();
  });

  it("exposes accessible names for every icon-only row action", () => {
    const customers: Customer[] = [{
      id: "customer-1",
      company_id: "company-1",
      name: "Cliente registrado",
      cuit: "20-12345678-9",
      email: "cliente@example.com",
      phone: null,
      is_occasional: false,
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

    expect(screen.getByRole("button", { name: "Ver cuenta corriente" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Editar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
  });
});
