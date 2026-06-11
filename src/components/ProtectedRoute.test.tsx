import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRole } from "@/lib/permissions";

let roles: AppRole[] = [];

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    session: { user: { id: "user-1" } },
    loading: false,
    roles,
  }),
}));

import { ProtectedRoute } from "./ProtectedRoute";

function renderSuperadminRoute() {
  return render(
    <MemoryRouter initialEntries={["/users"]}>
      <Routes>
        <Route path="/" element={<div>inicio</div>} />
        <Route
          path="/users"
          element={(
            <ProtectedRoute requiresSuperadmin>
              <div>usuarios</div>
            </ProtectedRoute>
          )}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    roles = [];
  });

  it("redirects company admins away from superadmin routes", async () => {
    roles = ["admin"];
    renderSuperadminRoute();

    expect(await screen.findByText("inicio")).toBeInTheDocument();
    expect(screen.queryByText("usuarios")).not.toBeInTheDocument();
  });

  it("allows superadmins into superadmin routes", async () => {
    roles = ["superadmin"];
    renderSuperadminRoute();

    expect(await screen.findByText("usuarios")).toBeInTheDocument();
  });
});
