import { lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminRoute } from './components/AdminRoute'
import { SkillMatrixLayout } from './components/SkillMatrixLayout'
import { SkillMatrixAccessRoute } from './components/SkillMatrixAccessRoute'
import { SectionAccessRoute } from './components/SectionAccessRoute'
import { LoginAccountsAccessRoute } from './components/LoginAccountsAccessRoute'
import { LdrToolsLayout } from './components/LdrToolsLayout'
import { RttSystemsLayout } from './components/RttSystemsLayout'
import { HomeRoute } from './components/HomeRoute'
import { GuestRoute } from './components/GuestRoute'
import { StaffRoute } from './components/StaffRoute'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AdminPage } from './pages/AdminPage'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { MySkillsPage } from './pages/MySkillsPage'
import { ReportPage } from './pages/ReportPage'
import { RegisterPage } from './pages/RegisterPage'
import { UserGuidePage } from './pages/UserGuidePage'
import { MatrixPage } from './pages/MatrixPage'
import { LdrAdminRoute } from './components/LdrAdminRoute'

const LdrCalendarPage = lazy(() =>
  import('./pages/LdrCalendarPage').then((m) => ({ default: m.LdrCalendarPage })),
)
const LeadershipRosterPage = lazy(() =>
  import('./pages/LeadershipRosterPage').then((m) => ({ default: m.LeadershipRosterPage })),
)
const LdrAdminPage = lazy(() => import('./pages/LdrAdminPage').then((m) => ({ default: m.LdrAdminPage })))
const LdrToolsUserGuidePage = lazy(() =>
  import('./pages/LdrToolsUserGuidePage').then((m) => ({ default: m.LdrToolsUserGuidePage })),
)
import { RttSystemsPage } from './pages/RttSystemsPage'
import { LoginAccountsPage } from './pages/LoginAccountsPage'
import { SuperAdminRoute } from './components/SuperAdminRoute'
import { MasterDataLayout } from './components/MasterDataLayout'
import { MasterDataStructurePage } from './pages/MasterDataStructurePage'
import { MasterDataPeoplePage } from './pages/MasterDataPeoplePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route index element={<HomeRoute />} />

          <Route
            path="login-accounts"
            element={
              <LoginAccountsAccessRoute>
                <LoginAccountsPage />
              </LoginAccountsAccessRoute>
            }
          />

          <Route element={<SkillMatrixAccessRoute />}>
            <Route element={<SkillMatrixLayout />}>
              <Route
                path="matrix"
                element={
                  <StaffRoute>
                    <MatrixPage />
                  </StaffRoute>
                }
              />
              <Route
                path="dashboard"
                element={
                  <StaffRoute>
                    <DashboardPage />
                  </StaffRoute>
                }
              />
              <Route
                path="report"
                element={
                  <StaffRoute>
                    <ReportPage />
                  </StaffRoute>
                }
              />
              <Route path="my-skills" element={<MySkillsPage />} />
              <Route
                path="admin"
                element={
                  <AdminRoute>
                    <AdminPage />
                  </AdminRoute>
                }
              />
              <Route
                path="user-guide"
                element={
                  <AdminRoute>
                    <UserGuidePage />
                  </AdminRoute>
                }
              />
            </Route>
          </Route>

          <Route
            path="ldr-tools"
            element={
              <SectionAccessRoute section="ldr">
                <LdrToolsLayout />
              </SectionAccessRoute>
            }
          >
            <Route index element={<Navigate to="calendar" replace />} />
            <Route path="calendar" element={<LdrCalendarPage />} />
            <Route path="roster" element={<LeadershipRosterPage />} />
            <Route path="user-guide" element={<LdrToolsUserGuidePage />} />
            <Route
              path="admin"
              element={
                <LdrAdminRoute>
                  <LdrAdminPage />
                </LdrAdminRoute>
              }
            />
          </Route>

          <Route
            path="rtt-systems"
            element={
              <SectionAccessRoute section="rtt">
                <RttSystemsLayout />
              </SectionAccessRoute>
            }
          >
            <Route index element={<RttSystemsPage />} />
          </Route>

          <Route
            path="master-data"
            element={
              <SuperAdminRoute>
                <MasterDataLayout />
              </SuperAdminRoute>
            }
          >
            <Route index element={<Navigate to="structure" replace />} />
            <Route path="structure" element={<MasterDataStructurePage />} />
            <Route path="people" element={<MasterDataPeoplePage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
