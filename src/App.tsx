import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import GuestRoute from "./components/auth/GuestRoute";

// Auth (small, always needed)
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import SignOut from "./pages/AuthPages/SignOut";
import NotFound from "./pages/OtherPage/NotFound";

// Lazy-loaded pages
const Home = lazy(() => import("./pages/Dashboard/Home"));
const Order = lazy(() => import("./pages/Jaonaichan/Order"));
const Bill2UnitPrices = lazy(() => import("./pages/Jaonaichan/Bill2UnitPrices"));
const BarcodePack = lazy(() => import("./pages/Jaonaichan/BarcodePack"));
const BarcodeImport = lazy(() => import("./pages/Jaonaichan/BarcodeImport"));
const BarcodeManagement = lazy(() => import("./pages/Jaonaichan/BarcodeManagement"));
const Customers = lazy(() => import("./pages/Jaonaichan/Customers"));
const InvoicePage = lazy(() => import("./pages/Jaonaichan/Invoice"));
const InvoiceCreatorPage = lazy(() => import("./pages/Jaonaichan/InvoiceCreator"));
const InvoiceListPage = lazy(() => import("./pages/Jaonaichan/InvoiceList"));
const PromptPaySettings = lazy(() => import("./pages/Jaonaichan/PromptPaySettings"));
const SocialLoginSettings = lazy(() => import("./pages/Jaonaichan/SocialLoginSettings"));
const UserProfiles = lazy(() => import("./pages/UserProfiles"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Blank = lazy(() => import("./pages/Blank"));
const FormElements = lazy(() => import("./pages/Forms/FormElements"));
const BasicTables = lazy(() => import("./pages/Tables/BasicTables"));
const CustomersPage = lazy(() => import("./components/tables/DataTable/DataTableExample").then(m => ({ default: m.CustomersPage })));
const OrdersPage = lazy(() => import("./components/tables/DataTable/DataTableExample").then(m => ({ default: m.OrdersPage })));
const Alerts = lazy(() => import("./pages/UiElements/Alerts"));
const Avatars = lazy(() => import("./pages/UiElements/Avatars"));
const Badges = lazy(() => import("./pages/UiElements/Badges"));
const Buttons = lazy(() => import("./pages/UiElements/Buttons"));
const Images = lazy(() => import("./pages/UiElements/Images"));
const Videos = lazy(() => import("./pages/UiElements/Videos"));
const LineChart = lazy(() => import("./pages/Charts/LineChart"));
const BarChart = lazy(() => import("./pages/Charts/BarChart"));

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Suspense fallback={null}>
          <Routes>
            {/* Dashboard Layout — ProtectedRoute คลุม AppLayout ทั้งหมด
                เพื่อให้ Header/NotificationDropdown render หลัง auth confirmed เท่านั้น */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index path="/" element={<Home />} />

              {/* Jaonaichan */}
              <Route path="/order-jaonaichan" element={<Order />} />
              <Route path="/bill2-unit-prices" element={<Bill2UnitPrices />} />
              <Route path="/barcode-pack" element={<BarcodePack />} />
              <Route path="/barcode-import" element={<BarcodeImport />} />
              <Route path="/barcode-management" element={<BarcodeManagement />} />
              <Route path="/jaonaichan/customers" element={<Customers />} />
              <Route path="/jaonaichan/invoices" element={<InvoiceListPage />} />
              <Route path="/jaonaichan/invoice" element={<InvoiceCreatorPage />} />
              <Route path="/jaonaichan/invoice/:orderId" element={<InvoicePage />} />
              <Route path="/jaonaichan/settings/promptpay" element={<PromptPaySettings />} />
              <Route path="/jaonaichan/settings/social-login" element={<SocialLoginSettings />} />

              {/* Others Page */}
              <Route path="/profile" element={<UserProfiles />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/blank" element={<Blank />} />

              {/* Forms */}
              <Route path="/form-elements" element={<FormElements />} />

              {/* Tables */}
              <Route path="/basic-tables" element={<BasicTables />} />
              <Route path="/customers-tables-ex" element={<CustomersPage />} />
              <Route path="/orders-tables-ex" element={<OrdersPage />} />

              {/* Ui Elements */}
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/avatars" element={<Avatars />} />
              <Route path="/badge" element={<Badges />} />
              <Route path="/buttons" element={<Buttons />} />
              <Route path="/images" element={<Images />} />
              <Route path="/videos" element={<Videos />} />

              {/* Charts */}
              <Route path="/line-chart" element={<LineChart />} />
              <Route path="/bar-chart" element={<BarChart />} />
            </Route>

            {/* Auth Layout */}
            <Route path="/signin" element={<GuestRoute><SignIn /></GuestRoute>} />
            <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />
            <Route path="/signout" element={<SignOut />} />

            {/* Fallback Route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </>
  );
}
