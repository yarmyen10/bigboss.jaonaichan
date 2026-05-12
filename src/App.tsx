import { BrowserRouter as Router, Routes, Route } from "react-router";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import SignOut from "./pages/AuthPages/SignOut";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import Videos from "./pages/UiElements/Videos";
import Images from "./pages/UiElements/Images";
import Alerts from "./pages/UiElements/Alerts";
import Badges from "./pages/UiElements/Badges";
import Avatars from "./pages/UiElements/Avatars";
import Buttons from "./pages/UiElements/Buttons";
import LineChart from "./pages/Charts/LineChart";
import BarChart from "./pages/Charts/BarChart";
import Calendar from "./pages/Calendar";
import BasicTables from "./pages/Tables/BasicTables";
import FormElements from "./pages/Forms/FormElements";
import Blank from "./pages/Blank";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import Order from "./pages/Jaonaichan/Order";
import Bill2UnitPrices from "./pages/Jaonaichan/Bill2UnitPrices";
import { CustomersPage, OrdersPage } from "./components/tables/DataTable/DataTableExample";

export default function App() {
  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Dashboard Layout */}
          <Route element={<AppLayout />}>
            <Route index path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />

            {/* Jaonaichan */}
            <Route path="/order-jaonaichan" element={<ProtectedRoute><Order /></ProtectedRoute>} />
            <Route path="/bill2-unit-prices" element={<ProtectedRoute><Bill2UnitPrices /></ProtectedRoute>} />

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
      </Router>
    </>
  );
}
