import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { LocaleProvider } from './LocaleContext'
import ProtectedRoute from './ProtectedRoute'
import SplashScreen from './SplashScreen'
import PullToRefresh from './PullToRefresh'

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ChooseUsernamePage from './pages/ChooseUsernamePage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TermsPage from './pages/TermsPage'
import UnsubscribePage from './pages/UnsubscribePage'
import PrivacyPage from './pages/PrivacyPage'
import HelpPage from './pages/HelpPage'
import MarketplacePage from './pages/MarketplacePage'
import CompaniesPage from './pages/CompaniesPage'
import CommunitiesPage from './pages/CommunitiesPage'
import AccountPage from './pages/AccountPage'
import EditProfilePage from './pages/EditProfilePage'
import EquipmentPage from './pages/EquipmentPage'
import EquipmentNewPage from './pages/EquipmentNewPage'
import EquipmentDetailsPage from './pages/EquipmentDetailsPage'
import MyEquipmentPage from './pages/MyEquipmentPage'
import SavedPage from './pages/SavedPage'
import MessagesPage from './pages/MessagesPage'
import NotificationsPage from './pages/NotificationsPage'
import NotificationSettingsPage from './pages/NotificationSettingsPage'
import FarmBotPage from './pages/FarmBotPage'
import CreatePostPage from './pages/CreatePostPage'
import PostPage from './pages/PostPage'
import VideoUploadPage from './pages/VideoUploadPage'
import VideosPage from './pages/VideosPage'
import AdminVideosPage from './admin/pages/VideosPage'
import SearchPage from './pages/SearchPage'
import CompanyDetailsPage from './pages/CompanyDetailsPage'
import CompanyRegisterPage from './pages/CompanyRegisterPage'
import CommunityDetailsPage from './pages/CommunityDetailsPage'
import FarmDeskPage from './pages/FarmDeskPage'
import FarmDeskNewPage from './pages/FarmDeskNewPage'
import FarmDeskRequestPage from './pages/FarmDeskRequestPage'
import UserProfilePage from './pages/UserProfilePage'
import WalletPage from './pages/WalletPage'
import StaffInvitePage from './pages/StaffInvitePage'
import OrdersPage from './pages/OrdersPage'
import OrderPage from './pages/OrderPage'
import PremiumPage from './pages/PremiumPage'
import MyProfilePage from './pages/MyProfilePage'
import AnalyticsPage from './pages/AnalyticsPage'
import CreateListingPage from './pages/CreateListingPage'
import ListingDetailsPage from './pages/ListingDetailsPage'
import CompanyAnalyticsPage from './company/CompanyAnalyticsPage'
import CompanyLayout from './company/CompanyLayout'
import CompanyHomePage from './company/CompanyHomePage'
import CompanyPremiumPage from './company/CompanyPremiumPage'
import CompanyFarmBotPage from './company/CompanyFarmBotPage'
import CompanyEditPage from './company/CompanyEditPage'
import CompanyInsightsPage from './company/CompanyInsightsPage'
import CompanyReportsPage from './company/CompanyReportsPage'
import CompanyFeaturedPage from './company/CompanyFeaturedPage'
import CompanyAdsPage from './company/CompanyAdsPage'
import CompanyAdNewPage from './company/CompanyAdNewPage'
import CompanyAdDetailPage from './company/CompanyAdDetailPage'
import CompanyAdVerifyPage from './company/CompanyAdVerifyPage'
import CompanyAdCampaignsPage from './company/CompanyAdCampaignsPage'
import CompanyAdPerformancePage from './company/CompanyAdPerformancePage'
import CompanyAdBillingPage from './company/CompanyAdBillingPage'
import MyAdsPage from './pages/MyAdsPage'
import PeoplePage from './pages/PeoplePage'
import MyAdNewPage from './pages/MyAdNewPage'
import MyAdDetailPage from './pages/MyAdDetailPage'
import MyAdVerifyPage from './pages/MyAdVerifyPage'
import AdminProtectedRoute from './admin/AdminProtectedRoute'
import OverviewPage from './admin/pages/OverviewPage'
import StaffPage from './admin/pages/StaffPage'
import RolesPage from './admin/pages/RolesPage'
import VerificationPage from './admin/pages/VerificationPage'
import AdminCompaniesPage from './admin/pages/CompaniesPage'
import UsersPage from './admin/pages/UsersPage'
import AdminMarketplacePage from './admin/pages/MarketplacePage'
import AdminEquipmentPage from './admin/pages/EquipmentPage'
import AdminFarmDeskPage from './admin/pages/FarmDeskPage'
import AdminFarmDeskRequestPage from './admin/pages/FarmDeskRequestPage'
import AdminWalletOrdersPage from './admin/pages/WalletOrdersPage'
import AdminWalletOrderPage from './admin/pages/WalletOrderPage'
import AdminWithdrawalsPage from './admin/pages/WithdrawalsPage'
import AdminAuditLogsPage from './admin/pages/AuditLogsPage'
import AdminHealthPage from './admin/pages/HealthPage'
import AdminCommunityPage from './admin/pages/CommunityPage'
import AdminReportsPage from './admin/pages/ReportsPage'
import AdminFarmBotAnalyticsPage from './admin/pages/FarmBotAnalyticsPage'
import AdminAnalyticsPage from './admin/pages/AnalyticsPage'
import AdminNotificationsPage from './admin/pages/NotificationsPage'
import AdminSettingsPage from './admin/pages/SettingsPage'
import AdminGroupsPage from './admin/pages/GroupsPage'
import AdminAdsPage from './admin/pages/AdsPage'
import AdminAdPricingPage from './admin/pages/AdPricingPage'
import AdminPremiumPricingPage from './admin/pages/PremiumPricingPage'
import AdminExchangeRatesPage from './admin/pages/ExchangeRatesPage'
import AdminFinanceCheckPage from './admin/pages/FinanceCheckPage'
import MaintenanceGate from './MaintenanceGate'
import PresenceTracker from './PresenceTracker'
import DesktopSidebar from './DesktopSidebar'

// The logo animation is for opening the app, not for every reload: it plays once per visit.
function splashAlreadySeen(): boolean {
  try { return sessionStorage.getItem('farmxie_splash_seen') === '1' } catch { return false }
}

function App() {
  const [showSplash, setShowSplash] = useState(() => !splashAlreadySeen())

  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <PresenceTracker />
          <DesktopSidebar />
          {showSplash && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
              <SplashScreen onFinish={() => { try { sessionStorage.setItem('farmxie_splash_seen', '1') } catch { /* ignore */ } setShowSplash(false) }} />
            </div>
          )}
          <MaintenanceGate>
          <PullToRefresh>
          {(refreshKey) => (
          <Routes key={refreshKey}>
            {/* Public routes: no session required */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route
              path="/choose-username"
              element={
                <ProtectedRoute allowPending>
                  <ChooseUsernamePage />
                </ProtectedRoute>
              }
            />
            {/* Legal pages are public so they can be read before signing up */}
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            {/* Email unsubscribe link lands here; no sign-in needed */}
            <Route path="/unsubscribe" element={<UnsubscribePage />} />

            {/* Protected routes: redirect to /login if there is no session */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketplace"
              element={
                <ProtectedRoute>
                  <MarketplacePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/companies"
              element={
                <ProtectedRoute>
                  <CompaniesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/communities"
              element={
                <ProtectedRoute>
                  <CommunitiesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <EditProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment"
              element={
                <ProtectedRoute>
                  <EquipmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment/new"
              element={
                <ProtectedRoute>
                  <EquipmentNewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment/new/:kind"
              element={
                <ProtectedRoute>
                  <EquipmentNewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment/mine"
              element={
                <ProtectedRoute>
                  <MyEquipmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment/:id/edit"
              element={
                <ProtectedRoute>
                  <EquipmentNewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/equipment/:id"
              element={
                <ProtectedRoute>
                  <EquipmentDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/help"
              element={
                <ProtectedRoute>
                  <HelpPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/saved"
              element={
                <ProtectedRoute>
                  <SavedPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <MessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <NotificationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/notifications"
              element={
                <ProtectedRoute>
                  <NotificationSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/farmbot"
              element={
                <ProtectedRoute>
                  <FarmBotPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create"
              element={
                <ProtectedRoute>
                  <CreatePostPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/videos/new"
              element={
                <ProtectedRoute>
                  <VideoUploadPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/videos"
              element={
                <ProtectedRoute>
                  <VideosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/videos/:id"
              element={
                <ProtectedRoute>
                  <VideosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/companies/new"
              element={
                <ProtectedRoute>
                  <CompanyRegisterPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/companies/:id"
              element={
                <ProtectedRoute>
                  <CompanyDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/communities/:id"
              element={
                <ProtectedRoute>
                  <CommunityDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/post/:id"
              element={
                <ProtectedRoute>
                  <PostPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/u/:username"
              element={
                <ProtectedRoute>
                  <UserProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Farm Desk (customer side). "new" must come before ":id" */}
            <Route
              path="/farm-desk"
              element={
                <ProtectedRoute>
                  <FarmDeskPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/farm-desk/new"
              element={
                <ProtectedRoute>
                  <FarmDeskNewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/farm-desk/:id"
              element={
                <ProtectedRoute>
                  <FarmDeskRequestPage />
                </ProtectedRoute>
              }
            />

            {/* Public on purpose: the invited person may not be signed in yet. The page checks the invitation itself */}
            <Route path="/staff-invite" element={<StaffInvitePage />} />

            {/* Wallet and escrow orders. The list route has no param, so order does not matter here */}
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <WalletPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <OrderPage />
                </ProtectedRoute>
              }
            />

            {/* My Ads: a person promotes their own post, listing, video or profile. "new" and "verify" come before ":id" */}
            <Route path="/people" element={<ProtectedRoute><PeoplePage /></ProtectedRoute>} />
            <Route path="/my-ads" element={<ProtectedRoute><MyAdsPage /></ProtectedRoute>} />
            <Route path="/my-ads/new" element={<ProtectedRoute><MyAdNewPage /></ProtectedRoute>} />
            <Route path="/my-ads/verify" element={<ProtectedRoute><MyAdVerifyPage /></ProtectedRoute>} />
            <Route path="/my-ads/:id" element={<ProtectedRoute><MyAdDetailPage /></ProtectedRoute>} />

            {/* My Profile: the user's own profile hub (farm, marketplace, community, FarmBot) */}
            <Route
              path="/my-profile"
              element={
                <ProtectedRoute>
                  <MyProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Marketplace: create/edit a listing and the product details page */}
            <Route
              path="/sell"
              element={
                <ProtectedRoute>
                  <CreateListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sell/:id"
              element={
                <ProtectedRoute>
                  <CreateListingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listing/:id"
              element={
                <ProtectedRoute>
                  <ListingDetailsPage />
                </ProtectedRoute>
              }
            />

            {/* Analytics (Premium users see real data, free users see a sample preview) */}
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <AnalyticsPage />
                </ProtectedRoute>
              }
            />

            {/* Premium (user). /premium/verify is where the payment page sends the user back */}
            <Route
              path="/premium"
              element={
                <ProtectedRoute>
                  <PremiumPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/premium/verify"
              element={
                <ProtectedRoute>
                  <PremiumPage />
                </ProtectedRoute>
              }
            />

            {/* Company dashboard: separate desktop-style space for company owners */}
            <Route
              path="/company"
              element={
                <ProtectedRoute>
                  <CompanyLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CompanyHomePage />} />
              <Route path="analytics" element={<CompanyAnalyticsPage />} />
              <Route path="featured" element={<CompanyFeaturedPage />} />
              <Route path="ads" element={<CompanyAdsPage />} />
              <Route path="ads/new" element={<CompanyAdNewPage />} />
              <Route path="ads/campaigns" element={<CompanyAdCampaignsPage />} />
              <Route path="ads/performance" element={<CompanyAdPerformancePage />} />
              <Route path="ads/billing" element={<CompanyAdBillingPage />} />
              <Route path="ads/verify" element={<CompanyAdVerifyPage />} />
              <Route path="ads/:id" element={<CompanyAdDetailPage />} />
              <Route path="reports" element={<CompanyReportsPage />} />
              <Route path="insights" element={<CompanyInsightsPage />} />
              <Route path="edit" element={<CompanyEditPage />} />
              <Route path="farmbot" element={<CompanyFarmBotPage />} />
              <Route path="premium" element={<CompanyPremiumPage />} />
            </Route>

            {/* Unknown routes fall back to Home (which itself redirects to /login if needed) */}
            {/* Farmxie Admin - a signed-in user still needs an active staff row to see anything here */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute>
                    <OverviewPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/staff"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="staff.view">
                    <StaffPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="roles.view">
                    <RolesPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/verification"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="companies.verify">
                    <VerificationPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/companies"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="companies.view">
                    <AdminCompaniesPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="users.view">
                    <UsersPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ads"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="ads.review">
                    <AdminAdsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/finance-check"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="wallet.view">
                    <AdminFinanceCheckPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/exchange-rates"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="wallet.view">
                    <AdminExchangeRatesPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/ads/pricing"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="ads.manage_pricing">
                    <AdminAdPricingPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/premium-pricing"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="premium.manage_pricing">
                    <AdminPremiumPricingPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/marketplace"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="marketplace.view">
                    <AdminMarketplacePage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/equipment"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="equipment.view">
                    <AdminEquipmentPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />

            {/* Old name: keeps any saved Trade Desk link working */}
            <Route path="/admin/trade-desk" element={<Navigate to="/admin/farm-desk" replace />} />
            <Route
              path="/admin/farm-desk"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="trade_desk.view">
                    <AdminFarmDeskPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/farm-desk/:id"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="trade_desk.view">
                    <AdminFarmDeskRequestPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/admin/wallet"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="wallet.view">
                    <AdminWalletOrdersPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/community"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="community.view">
                    <AdminCommunityPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reports"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="reports.view">
                    <AdminReportsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/farmbot"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="farmbot.view_analytics">
                    <AdminFarmBotAnalyticsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="analytics.view">
                    <AdminAnalyticsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/notifications"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="notifications.view">
                    <AdminNotificationsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="settings.view">
                    <AdminSettingsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/videos"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="videos.view">
                    <AdminVideosPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/groups"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="groups.view">
                    <AdminGroupsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/health"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="system.view_health">
                    <AdminHealthPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-logs"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="audit_logs.view">
                    <AdminAuditLogsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/wallet/withdrawals"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="wallet.view">
                    <AdminWithdrawalsPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/wallet/:id"
              element={
                <ProtectedRoute>
                  <AdminProtectedRoute requirePermission="wallet.view">
                    <AdminWalletOrderPage />
                  </AdminProtectedRoute>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          )}
          </PullToRefresh>
          </MaintenanceGate>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  )
}

export default App
