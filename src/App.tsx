import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Auth (small, always needed)
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import SignOut from "./pages/AuthPages/SignOut";
import NotFound from "./pages/OtherPage/NotFound";

// Lazy-loaded pages
const Home            = lazy(() => import("./pages/Dashboard/Home"));
const Order           = lazy(() => import("./pages/Jaonaichan/Order"));
const Bill2UnitPrices = lazy(() => import("./pages/Jaonaichan/Bill2UnitPrices"));
const BarcodePack     = lazy(() => import("./pages/Jaonaichan/BarcodePack"));
const BarcodeImport   = lazy(() => import("./pages/Jaonaichan/BarcodeImport"));
const Customers       = lazy(() => import("./pages/Jaonaichan/Customers"));
const InvoicePage     = lazy(() => import("./pages/Jaonaichan/Invoice"));
const InvoiceCreatorPage  = lazy(() => import("./pages/Jaonaichan/InvoiceCreator"));
const PromptPaySettings   = lazy(() => import("./pages/Jaonaichan/PromptPaySettings"));
const UserProfiles    = lazy(() => import("./pages/UserProfiles"));
const Calendar        = lazy(() => import("./pages/Calendar"));
const Blank           = lazy(() => import("./pages/Blank"));
const FormElements    = lazy(() => import("./pages/Forms/FormElements"));
const BasicTables     = lazy(() => import("./pages/Tables/BasicTables"));
const CustomersPage = lazy(() => import("./components/tables/DataTable/DataTableExample").then(m => ({ default: m.CustomersPage })));
const OrdersPage    = lazy(() => import("./components/tables/DataTable/DataTableExample").then(m => ({ default: m.OrdersPage })));
const Alerts          = lazy(() => import("./pages/UiElements/Alerts"));
const Avatars         = lazy(() => import("./pages/UiElements/Avatars"));
const Badges          = lazy(() => import("./pages/UiElements/Badges"));
const Buttons         = lazy(() => import("./pages/UiElements/Buttons"));
const Images          = lazy(() => import("./pages/UiElements/Images"));
const Videos          = lazy(() => import("./pages/UiElements/Videos"));
const LineChart       = lazy(() => import("./pages/Charts/LineChart"));
const BarChart        = lazy(() => import("./pages/Charts/BarChart"));

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Suspense fallback={null}>
          <Routes>
            {/* Dashboard Layout */}
            <Route element={<AppLayout />}>
              <Route index path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />

              {/* Jaonaichan */}
              <Route path="/order-jaonaichan" element={<ProtectedRoute><Order /></ProtectedRoute>} />
              <Route path="/bill2-unit-prices" element={<ProtectedRoute><Bill2UnitPrices /></ProtectedRoute>} />
              <Route path="/barcode-pack" element={<ProtectedRoute><BarcodePack /></ProtectedRoute>} />
              <Route path="/barcode-import" element={<ProtectedRoute><BarcodeImport /></ProtectedRoute>} />
              <Route path="/jaonaichan/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
              <Route path="/jaonaichan/invoice" element={<ProtectedRoute><InvoiceCreatorPage /></ProtectedRoute>} />
              <Route path="/jaonaichan/invoice/:orderId" element={<ProtectedRoute><InvoicePage /></ProtectedRoute>} />
              <Route path="/jaonaichan/settings/promptpay" element={<ProtectedRoute><PromptPaySettings /></ProtectedRoute>} />

              {/* Others Page */}
              <Route path="/profile" element={<ProtectedRoute><UserProfiles /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/blank" element={<ProtectedRoute><Blank /></ProtectedRoute>} />

              {/* Forms */}
              <Route path="/form-elements" element={<ProtectedRoute><FormElements /></ProtectedRoute>} />

              {/* Tables */}
              <Route path="/basic-tables" element={<ProtectedRoute><BasicTables /></ProtectedRoute>} />
              <Route path="/customers-tables-ex" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
              <Route path="/orders-tables-ex" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />

              {/* Ui Elements */}
              <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
              <Route path="/avatars" element={<ProtectedRoute><Avatars /></ProtectedRoute>} />
              <Route path="/badge" element={<ProtectedRoute><Badges /></ProtectedRoute>} />
              <Route path="/buttons" element={<ProtectedRoute><Buttons /></ProtectedRoute>} />
              <Route path="/images" element={<ProtectedRoute><Images /></ProtectedRoute>} />
              <Route path="/videos" element={<ProtectedRoute><Videos /></ProtectedRoute>} />

              {/* Charts */}
              <Route path="/line-chart" element={<ProtectedRoute><LineChart /></ProtectedRoute>} />
              <Route path="/bar-chart" element={<ProtectedRoute><BarChart /></ProtectedRoute>} />
            </Route>

            {/* Auth Layout */}
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/signout" element={<SignOut />} />

            {/* Fallback Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
}
