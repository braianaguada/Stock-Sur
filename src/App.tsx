import { Suspense, lazy, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { CompanyBrandProvider } from "@/components/CompanyBrandProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

const queryClient = new QueryClient();
const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/Auth"));
const ItemsPage = lazy(() => import("./pages/Items"));
const StockPage = lazy(() => import("./pages/Stock"));
const SuppliersPage = lazy(() => import("./pages/Suppliers"));
const PriceListsPage = lazy(() => import("./pages/PriceLists"));
const ImportsPage = lazy(() => import("./pages/Imports"));
const QuotesPage = lazy(() => import("./pages/Quotes"));
const DocumentsPage = lazy(() => import("./pages/Documents"));
const ServiceDocumentsPage = lazy(() => import("./pages/ServiceDocuments"));
const PrintServiceDocumentPage = lazy(() => import("./pages/PrintServiceDocument"));
const CustomersPage = lazy(() => import("./pages/Customers"));
const UsersPage = lazy(() => import("./pages/Users"));
const LegacyCatalogImportPage = lazy(() => import("./pages/LegacyCatalogImport"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const CashPage = lazy(() => import("./pages/Cash"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="route-loader w-full max-w-sm rounded-3xl border bg-card p-8 text-center shadow-sm">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Sistema comercial</p>
        <p className="mt-3 text-base font-semibold text-foreground">Cargando módulo...</p>
        <p className="mt-2 text-sm text-muted-foreground">Estamos preparando la pantalla para seguir trabajando.</p>
        <div className="mt-5 overflow-hidden rounded-full bg-muted/80">
          <div className="route-loader-bar h-1.5 rounded-full bg-primary/80" />
        </div>
      </div>
    </div>
  );
}

function DelayedRouteLoader() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return <RouteLoader />;
}

function AuthRedirect() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/" replace />;
  return <AuthPage />;
}

const App = () => (
  <AppErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <CompanyBrandProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Suspense fallback={<DelayedRouteLoader />}>
                <Routes>
                  <Route path="/auth" element={<AuthRedirect />} />
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/items" element={<ProtectedRoute><ItemsPage /></ProtectedRoute>} />
                  <Route path="/stock" element={<ProtectedRoute><StockPage /></ProtectedRoute>} />
                  <Route path="/suppliers" element={<ProtectedRoute><SuppliersPage /></ProtectedRoute>} />
                  <Route path="/price-lists" element={<ProtectedRoute><PriceListsPage /></ProtectedRoute>} />
                  <Route path="/imports" element={<ProtectedRoute><ImportsPage /></ProtectedRoute>} />
                  <Route path="/quotes" element={<ProtectedRoute><QuotesPage /></ProtectedRoute>} />
                  <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
                  <Route path="/services/documents" element={<ProtectedRoute><ServiceDocumentsPage /></ProtectedRoute>} />
                  <Route path="/print/service-document/:id" element={<ProtectedRoute><PrintServiceDocumentPage /></ProtectedRoute>} />
                  <Route path="/cash" element={<ProtectedRoute><CashPage /></ProtectedRoute>} />
                  <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
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
  </AppErrorBoundary>
);

export default App;
