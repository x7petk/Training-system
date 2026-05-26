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
const DdsActionsPage = lazy(() => import('./pages/DdsActionsPage').then((m) => ({ default: m.DdsActionsPage })))
const DdsProcessAdminLayout = lazy(() =>
  import('./components/DdsProcessAdminLayout').then((m) => ({ default: m.DdsProcessAdminLayout })),
)
const DdsAdminKpiGroupsPage = lazy(() =>
  import('./pages/DdsAdminKpiGroupsPage').then((m) => ({ default: m.DdsAdminKpiGroupsPage })),
)
const DdsAdminKpisPage = lazy(() => import('./pages/DdsAdminKpisPage').then((m) => ({ default: m.DdsAdminKpisPage })))
const DdsAdminKpiSetupPage = lazy(() =>
  import('./pages/DdsAdminKpiSetupPage').then((m) => ({ default: m.DdsAdminKpiSetupPage })),
)
const DdsAdminP2pStandardPage = lazy(() =>
  import('./pages/DdsAdminP2pStandardPage').then((m) => ({ default: m.DdsAdminP2pStandardPage })),
)
const DdsAdminP2pSoftPointsPage = lazy(() =>
  import('./pages/DdsAdminP2pSoftPointsPage').then((m) => ({ default: m.DdsAdminP2pSoftPointsPage })),
)
const DdsP2pSetupPage = lazy(() => import('./pages/DdsP2pSetupPage').then((m) => ({ default: m.DdsP2pSetupPage })))
const DdsP2pPage = lazy(() => import('./pages/DdsP2pPage').then((m) => ({ default: m.DdsP2pPage })))
const DdsP2pSummaryPage = lazy(() =>
  import('./pages/DdsP2pSummaryPage').then((m) => ({ default: m.DdsP2pSummaryPage })),
)
const ShiftDdsPage = lazy(() => import('./pages/ShiftDdsPage').then((m) => ({ default: m.ShiftDdsPage })))
const LineDdsPage = lazy(() => import('./pages/LineDdsPage').then((m) => ({ default: m.LineDdsPage })))
const PlantDdsPage = lazy(() => import('./pages/PlantDdsPage').then((m) => ({ default: m.PlantDdsPage })))
const SiteDdsPage = lazy(() => import('./pages/SiteDdsPage').then((m) => ({ default: m.SiteDdsPage })))
const LineCompliancePage = lazy(() =>
  import('./pages/LineCompliancePage').then((m) => ({ default: m.LineCompliancePage })),
)
const SiteCompliancePage = lazy(() =>
  import('./pages/SiteCompliancePage').then((m) => ({ default: m.SiteCompliancePage })),
)
const DdsTriggersPage = lazy(() => import('./pages/DdsTriggersPage').then((m) => ({ default: m.DdsTriggersPage })))
const DdsAdminTriggersPage = lazy(() =>
  import('./pages/DdsAdminTriggersPage').then((m) => ({ default: m.DdsAdminTriggersPage })),
)
const DdsAdminRewardRecognitionPage = lazy(() =>
  import('./pages/DdsAdminRewardRecognitionPage').then((m) => ({ default: m.DdsAdminRewardRecognitionPage })),
)
const DdsAdminTopLossesPage = lazy(() =>
  import('./pages/DdsAdminTopLossesPage').then((m) => ({ default: m.DdsAdminTopLossesPage })),
)
const EPlanPage = lazy(() => import('./pages/EPlanPage').then((m) => ({ default: m.EPlanPage })))
const DdsAdminEPlanSetupPage = lazy(() =>
  import('./pages/DdsAdminEPlanSetupPage').then((m) => ({ default: m.DdsAdminEPlanSetupPage })),
)
const WdsPage = lazy(() => import('./pages/WdsPage').then((m) => ({ default: m.WdsPage })))
const PdcaPage = lazy(() => import('./pages/PdcaPage').then((m) => ({ default: m.PdcaPage })))
const DdsAdminWdsKpisPage = lazy(() =>
  import('./pages/DdsAdminWdsKpisPage').then((m) => ({ default: m.DdsAdminWdsKpisPage })),
)

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
import { AgentsLayout } from './components/AgentsLayout'
import { AgentsToolPage } from './pages/AgentsToolPage'
import { UxUiExpertPage } from './pages/UxUiExpertPage'
const RoadMapBuilderPage = lazy(() =>
  import('./pages/RoadMapBuilderPage').then((m) => ({ default: m.RoadMapBuilderPage })),
)
const KpiCascadePage = lazy(() =>
  import('./pages/KpiCascadePage').then((m) => ({ default: m.KpiCascadePage })),
)
const StandardWorkProcessPage = lazy(() =>
  import('./pages/StandardWorkProcessPage').then((m) => ({ default: m.StandardWorkProcessPage })),
)
import { DdsAdminRoute } from './components/DdsAdminRoute'
import { DdsProcessLayout } from './components/DdsProcessLayout'
import { ProblemSolveAdminRoute } from './components/ProblemSolveAdminRoute'
import { ProblemSolveLayout } from './components/ProblemSolveLayout'
import { ProblemSolvePlaceholderPage } from './pages/ProblemSolvePlaceholderPage'

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
            <Route path="dds-actions" element={<DdsActionsPage />} />
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
            path="agents"
            element={
              <SectionAccessRoute section="agents">
                <AgentsLayout />
              </SectionAccessRoute>
            }
          >
            <Route index element={<Navigate to="problem-solve-advisor" replace />} />
            <Route path="problem-solve-advisor" element={<AgentsToolPage title="Problem solve advisor" />} />
            <Route path="planner" element={<AgentsToolPage title="Planner" />} />
            <Route path="road-map-builder" element={<RoadMapBuilderPage />} />
            <Route path="kpi-cascade" element={<KpiCascadePage />} />
            <Route path="standard-work-process" element={<StandardWorkProcessPage />} />
            <Route path="ux-ui-expert" element={<UxUiExpertPage />} />
            <Route path="q-and-a" element={<AgentsToolPage title="Q&A" />} />
            <Route path="reliability-engineer" element={<AgentsToolPage title="Reliability Engineer" />} />
            <Route path="flex-trends" element={<AgentsToolPage title="Flex trends" />} />
            <Route path="data-sciencer" element={<AgentsToolPage title="Data Sciencer" />} />
            <Route path="vision-detection" element={<AgentsToolPage title="Vision Detection" />} />
            <Route path="comms-generator" element={<AgentsToolPage title="Comms generator" />} />
            <Route path="sop-optimiser" element={<AgentsToolPage title="SOP optimiser" />} />
            <Route path="staff-calculator" element={<AgentsToolPage title="Staff Calculator" />} />
            <Route path="kpi-consultant" element={<AgentsToolPage title="KPI consultant" />} />
          </Route>

          <Route
            path="dds-process"
            element={
              <SectionAccessRoute section="dds">
                <DdsProcessLayout />
              </SectionAccessRoute>
            }
          >
            <Route index element={<Navigate to="plan-24" replace />} />
            <Route path="plan-24" element={<Plan24Page />} />
            <Route path="dds-actions" element={<DdsActionsPage />} />
            <Route path="p2p" element={<DdsP2pPage />} />
            <Route path="p2p-summary" element={<DdsP2pSummaryPage />} />
            <Route path="triggers" element={<DdsTriggersPage />} />
            <Route path="shift-dds" element={<ShiftDdsPage />} />
            <Route path="line-compliance" element={<LineCompliancePage />} />
            <Route path="line-dds" element={<LineDdsPage />} />
            <Route path="plant-dds" element={<PlantDdsPage />} />
            <Route path="site-compliance" element={<SiteCompliancePage />} />
            <Route path="site-dds" element={<SiteDdsPage />} />
            <Route path="wds" element={<WdsPage />} />
            <Route path="e-plan" element={<EPlanPage />} />
            <Route path="pdca" element={<PdcaPage />} />
            <Route
              path="admin"
              element={
                <DdsAdminRoute>
                  <DdsProcessAdminLayout />
                </DdsAdminRoute>
              }
            >
              <Route index element={<Navigate to="kpi-groups" replace />} />
              <Route path="kpi-groups" element={<DdsAdminKpiGroupsPage />} />
              <Route path="kpis" element={<DdsAdminKpisPage />} />
              <Route path="kpi-setup" element={<DdsAdminKpiSetupPage />} />
              <Route path="p2p-standard" element={<DdsAdminP2pStandardPage />} />
              <Route path="p2p-soft-points" element={<DdsAdminP2pSoftPointsPage />} />
              <Route path="p2p-setup" element={<DdsP2pSetupPage />} />
              <Route path="reward-recognition" element={<DdsAdminRewardRecognitionPage />} />
              <Route path="top-losses" element={<DdsAdminTopLossesPage />} />
              <Route path="triggers" element={<DdsAdminTriggersPage />} />
              <Route path="e-plan-setup" element={<DdsAdminEPlanSetupPage />} />
              <Route path="wds-kpis" element={<DdsAdminWdsKpisPage />} />
            </Route>
          </Route>

          <Route
            path="problem-solve"
            element={
              <SectionAccessRoute section="problem-solve">
                <ProblemSolveLayout />
              </SectionAccessRoute>
            }
          >
            <Route index element={<Navigate to="plan-24" replace />} />
            <Route path="plan-24" element={<Plan24Page />} />
            <Route path="dds-actions" element={<DdsActionsPage />} />
            <Route path="ips" element={<ProblemSolvePlaceholderPage title="IPS" />} />
            <Route path="ups" element={<ProblemSolvePlaceholderPage title="UPS" />} />
            <Route path="w-w" element={<ProblemSolvePlaceholderPage title="W-W" />} />
            <Route path="bde" element={<ProblemSolvePlaceholderPage title="BDE" />} />
            <Route path="ida" element={<ProblemSolvePlaceholderPage title="IDA" />} />
            <Route path="safety" element={<ProblemSolvePlaceholderPage title="Safety" />} />
            <Route path="quality" element={<ProblemSolvePlaceholderPage title="Quality" />} />
            <Route
              path="admin"
              element={
                <ProblemSolveAdminRoute>
                  <ProblemSolvePlaceholderPage title="Admin" />
                </ProblemSolveAdminRoute>
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
