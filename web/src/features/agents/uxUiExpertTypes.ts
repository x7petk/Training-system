export type UxUiAssetInput = {
  label: string
  mimeType: string
  dataUrl: string
}

export type UxUiExpertRequest = {
  assetA: UxUiAssetInput
  assetB?: UxUiAssetInput | null
  companyStandardText?: string
  companyStandardImage?: UxUiAssetInput | null
  contextNotes?: string
}

export type UxUiCategoryScore = {
  category: string
  score: number
  feedback: string
  strengths: string[]
  risks: string[]
}

export type UxUiRecommendation = {
  priority: 'high' | 'medium' | 'low'
  title: string
  action: string
  expectedImpact: string
}

export type UxUiComparison = {
  betterAsset: 'A' | 'B' | 'Tie'
  summary: string
  biggestDifferences: string[]
}

export type UxUiExpertResult = {
  model: string
  overallScore: number
  verdict: 'good' | 'mixed' | 'poor'
  executiveSummary: string
  categories: UxUiCategoryScore[]
  comparison?: UxUiComparison
  recommendations: UxUiRecommendation[]
  standardsApplied: string
}
