import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CompanyBrandProvider } from "@/components/CompanyBrandProvider";

const queryClient = new QueryClient();
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/Auth"));
const ItemsPage = lazy(() => import("./pages/Items"));
const StockPage = lazy(() => import("./pages/Stock"));
const SuppliersPage = lazy(() => import("./pages/Suppliers"));
const PriceListsPage = lazy(() => import("./pages/PriceLists"));
const ImportsPage = lazy(() => import("./pages/Imports"));
const PendingPage = lazy(() => import("./pages/Pending"));
const QuotesPage = lazy(() => import("./pages/Quotes"));
const DocumentsPage = lazy(() => import("./pages/Documents"));
const CustomersPage = lazy(() => import("./pages/Customers"));
const LegacyCatalogImportPage = lazy(() => import("./pages/LegacyCatalogImport"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const CashPage = lazy(() => import("./pages/Cash"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Stock Sur</p>
        <p className="mt-3 text-base font-semibold text-foreground">Cargando modulo...</p>
        <p className="mt-2 text-sm text-muted-foreground">Estamos preparando la pantalla para seguir trabajando.</p>
      </div>
    </div>
  );
}

function AuthRedirect() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CompanyBrandProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/auth" element={<AuthRedirect />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
                <Route path="/stock" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
                <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
                <Route path="/price-lists" element={<ProtectedRoute><PriceListsPage /></ProtectedRoute>} />
                <Route path="/imports" element={<ProtectedRoute><ImportsPage /></ProtectedRoute>} />
                <Route path="/pending" element={<ProtectedRoute><PendingPage /></ProtectedRoute>} />
                <Route path="/quotes" element={<ProtectedRoute><QuotesPage /></ProtectedRoute>} />
                <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
                <Route path="/cash" element={<ProtectedRoute><CashPage /></ProtectedRoute>} />
                <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="/items/catalog/import-legacy" element={<ProtectedRoute><LegacyCatalogImportPage /></ProtectedRoute>} />
                <Route path="/legacy-catalog-import" element={<Navigate to="/items/catalog/import-legacy" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </CompanyBrandProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
