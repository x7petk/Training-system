import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APPS_TEAM_STACK_CLASS } from '../features/agents/appsTeam/AppsTeamStackedLayout'
import { AppsTeamPage } from './AppsTeamPage'

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'test-token' },
  }),
}))

vi.mock('../features/agents/appsTeam/useAppsTeam', () => ({
  useAppsTeam: () => ({
    tickets: [],
    messages: [],
    events: [],
    loading: false,
    error: null,
    load: vi.fn(),
    addMessage: vi.fn(),
    createTicketFromDraft: vi.fn(),
    applyOrchestration: vi.fn(),
    deleteTicket: vi.fn(),
  }),
}))

vi.mock('../lib/appsTeamProxy', () => ({
  invokeAppsTeamAdvance: vi.fn(),
  invokeAppsTeamChat: vi.fn(),
  invokeAppsTeamSync: vi.fn(),
}))

afterEach(() => {
  cleanup()
})

function sectionOrder(root: HTMLElement): string[] {
  const headings = within(root).getAllByRole('heading', { level: 2 })
  return headings.map((h) => h.textContent?.trim() ?? '')
}

describe('AppsTeamPage layout', () => {
  it('renders Chat, Live Board, and Information in stacked order', () => {
    const { container } = render(<AppsTeamPage />)
    expect(sectionOrder(container)).toEqual(['Product Manager', 'Live board', 'Information'])
  })

  it('uses a single-column stacked layout without legacy side-by-side grid columns', () => {
    const { container } = render(<AppsTeamPage />)
    expect(container.querySelector('[class*="lg:grid-cols"]')).toBeNull()
    expect(container.querySelector('[class*="340px"]')).toBeNull()

    const stack = container.querySelector(`[data-apps-team-layout="stacked"]`)
    expect(stack).not.toBeNull()
    expect(stack?.className).toContain(APPS_TEAM_STACK_CLASS)
    expect(stack?.children.length).toBe(3)
  })

  it('keeps Live Board blue theme classes on the wrapper', () => {
    const { container } = render(<AppsTeamPage />)
    const liveBoardSection = container.querySelector('[class*="apps-team-live-board"]')
    expect(liveBoardSection).not.toBeNull()
    expect(liveBoardSection?.className).toContain('border-sky-200')
    expect(liveBoardSection?.className).toContain('bg-sky-50/70')
  })

  it('shows Information placeholder when no ticket is selected', () => {
    render(<AppsTeamPage />)
    const infoSection = screen.getByRole('heading', { name: 'Information' }).closest('section')
    expect(infoSection).not.toBeNull()
    expect(
      within(infoSection as HTMLElement).getByText(
        'Select a ticket to see requirements and handoffs.',
      ),
    ).toBeTruthy()
  })
})
