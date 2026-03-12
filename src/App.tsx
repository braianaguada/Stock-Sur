import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import ItemsPage from "./pages/Items";
import StockPage from "./pages/Stock";
import SuppliersPage from "./pages/Suppliers";
import PriceListsPage from "./pages/PriceLists";
import ImportsPage from "./pages/Imports";
import PendingPage from "./pages/Pending";
import QuotesPage from "./pages/Quotes";
import DocumentsPage from "./pages/Documents";
import CustomersPage from "./pages/Customers";
import LegacyCatalogImportPage from "./pages/LegacyCatalogImport";
import SettingsPage from "./pages/Settings";
import CashPage from "./pages/Cash";
import NotFound from "./pages/NotFound";
import { CompanyBrandProvider } from "@/components/CompanyBrandProvider";

const queryClient = new QueryClient();

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
          </BrowserRouter>
        </CompanyBrandProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
