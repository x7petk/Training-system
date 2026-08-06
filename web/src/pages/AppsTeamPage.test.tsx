import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('uses a single-column stacked layout without side-by-side grid columns', () => {
    const { container } = render(<AppsTeamPage />)
    const grid = container.querySelector('[class*="lg:grid-cols"]')
    expect(grid).toBeNull()

    const stack = container.querySelector('.flex.w-full.flex-col.gap-6')
    expect(stack).not.toBeNull()
    expect(stack?.children.length).toBe(3)
  })

  it('shows Information placeholder when no ticket is selected', () => {
    render(<AppsTeamPage />)
    const infoSection = screen.getByRole('heading', { name: 'Information' }).closest('section')
    expect(infoSection).not.toBeNull()
    expect(
      within(infoSection as HTMLElement).getByText(
        'Select a ticket to see requirements, agent log, and status.',
      ),
    ).toBeTruthy()
  })
})
