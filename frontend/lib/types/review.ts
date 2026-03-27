export type Verdict = 'Likely True' | 'Mixed Evidence' | 'Unclear' | 'Likely False';

export type SourceType = 'Official' | 'Press' | 'Social' | 'Analysis';

export interface EvidenceSnippet {
  id: string;
  sourceId: string;
  content: string;
  isVerified: boolean;
}

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  logoUrl?: string;
  publishTime: string;
  url: string;
  snippet: string;
  reliability: 'High' | 'Medium' | 'Low';
  reliabilityLabel: string;
}

export interface Review {
  id: string;
  claim: string;
  verdict: Verdict;
  confidence: number;
  status: 'completed' | 'loading' | 'error';
  interpretation: string;
  uncertainty: string;
  sources: Source[];
  consensusLevel: 'High' | 'Medium' | 'Low';
  consensusLabel: string;
  distribution: {
    official: number;
    press: number;
    social: number;
  };
}
