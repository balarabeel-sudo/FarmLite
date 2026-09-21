import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import { LocaleProvider } from './LocaleContext'
import ProtectedRoute from './ProtectedRoute'

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import MarketplacePage from './pages/MarketplacePage'
import CompaniesPage from './pages/CompaniesPage'
import CommunitiesPage from './pages/CommunitiesPage'
import ProfilePage from './pages/ProfilePage'
import EquipmentPage from './pages/EquipmentPage'
import SavedPage from './pages/SavedPage'
import MessagesPage from './pages/MessagesPage'
import NotificationsPage from './pages/NotificationsPage'
import FarmBotPage from './pages/FarmBotPage'
import CreatePostPage from './pages/CreatePostPage'
import SearchPage from './pages/SearchPage'
import CompanyDetailsPage from './pages/CompanyDetailsPage'
import CommunityDetailsPage from './pages/CommunityDetailsPage'
import UserProfilePage from './pages/UserProfilePage'

function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <Routes>
            {/* Public routes: no session required */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

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
                  <ProfilePage />
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
              path="/search"
              element={
                <ProtectedRoute>
                  <SearchPage />
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
              path="/u/:username"
              element={
                <ProtectedRoute>
                  <UserProfilePage />
                </ProtectedRoute>
              }
            />

            {/* Unknown routes fall back to Home (which itself redirects to /login if needed) */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  )
}

export default App
