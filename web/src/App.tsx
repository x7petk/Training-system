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
import { RttAdminRoute } from './components/RttAdminRoute'

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
const HcListPage = lazy(() => import('./pages/HcListPage').then((m) => ({ default: m.HcListPage })))
const HcNewPage = lazy(() => import('./pages/HcNewPage').then((m) => ({ default: m.HcNewPage })))
const HcRecordPage = lazy(() => import('./pages/HcRecordPage').then((m) => ({ default: m.HcRecordPage })))
const HcReportPage = lazy(() => import('./pages/HcReportPage').then((m) => ({ default: m.HcReportPage })))
const SosListPage = lazy(() => import('./pages/ObsListPage').then((m) => ({ default: m.SosListPage })))
const SosNewPage = lazy(() => import('./pages/ObsNewPage').then((m) => ({ default: m.SosNewPage })))
const QosNewPage = lazy(() => import('./pages/ObsNewPage').then((m) => ({ default: m.QosNewPage })))
const PpoNewPage = lazy(() => import('./pages/ObsNewPage').then((m) => ({ default: m.PpoNewPage })))
const SosRecordPage = lazy(() => import('./pages/ObsRecordPage').then((m) => ({ default: m.SosRecordPage })))
const QosRecordPage = lazy(() => import('./pages/ObsRecordPage').then((m) => ({ default: m.QosRecordPage })))
const PpoRecordPage = lazy(() => import('./pages/ObsRecordPage').then((m) => ({ default: m.PpoRecordPage })))
const SosReportPage = lazy(() => import('./pages/ObsReportPage').then((m) => ({ default: m.SosReportPage })))
import { RttSystemsSectionPage } from './pages/RttSystemsSectionPage'

const Plan24Page = lazy(() => import('./pages/Plan24Page').then((m) => ({ default: m.Plan24Page })))

const RttSystemsUserGuidePage = lazy(() =>
  import('./pages/RttSystemsUserGuidePage').then((m) => ({ default: m.RttSystemsUserGuidePage })),
)
const RttSystemsAdminPage = lazy(() =>
  import('./pages/RttSystemsAdminPage').then((m) => ({ default: m.RttSystemsAdminPage })),
)
const DhDefectHandlingPage = lazy(() =>
  import('./pages/DhDefectHandlingPage').then((m) => ({ default: m.DhDefectHandlingPage })),
)
const DeviationsPage = lazy(() => import('./pages/DeviationsPage').then((m) => ({ default: m.DeviationsPage })))
const QualityFailsPage = lazy(() => import('./pages/QualityFailsPage').then((m) => ({ default: m.QualityFailsPage })))
const RttChecksListViewPage = lazy(() => import('./pages/RttChecksListViewPage').then((m) => ({ default: m.RttChecksListViewPage })))
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
            <Route path="health-checks/report" element={<HcReportPage />} />
            <Route path="health-checks/new" element={<HcNewPage />} />
            <Route path="health-checks/:recordId" element={<HcRecordPage />} />
            <Route path="health-checks" element={<HcListPage />} />
            <Route path="sos/report" element={<SosReportPage />} />
            <Route path="sos/new" element={<SosNewPage />} />
            <Route path="sos/:recordId" element={<SosRecordPage />} />
            <Route path="sos" element={<SosListPage />} />
            <Route path="qos/report" element={<Navigate to="/ldr-tools/sos/report?tab=qos" replace />} />
            <Route path="qos/new" element={<QosNewPage />} />
            <Route path="qos/:recordId" element={<QosRecordPage />} />
            <Route path="qos" element={<Navigate to="/ldr-tools/sos?tab=qos" replace />} />
            <Route path="ppo/report" element={<Navigate to="/ldr-tools/sos/report?tab=ppo" replace />} />
            <Route path="ppo/new" element={<PpoNewPage />} />
            <Route path="ppo/:recordId" element={<PpoRecordPage />} />
            <Route path="ppo" element={<Navigate to="/ldr-tools/sos?tab=ppo" replace />} />
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
            <Route index element={<Navigate to="plan-24" replace />} />
            <Route path="plan-24" element={<Plan24Page />} />
            <Route path="my-plan" element={<RttSystemsSectionPage title="My Plan" />} />
            <Route path="list-view" element={<RttChecksListViewPage />} />
            <Route path="deviations" element={<DeviationsPage />} />
            <Route path="defect-handling" element={<DhDefectHandlingPage />} />
            <Route path="quality-fails" element={<QualityFailsPage />} />
            <Route path="user-guide" element={<RttSystemsUserGuidePage />} />
            <Route
              path="admin"
              element={
                <RttAdminRoute>
                  <RttSystemsAdminPage />
                </RttAdminRoute>
              }
            />
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
