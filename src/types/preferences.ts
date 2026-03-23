export interface PreferenceVector {
  culture: Record<string, number>;
  classification: Record<string, number>;
  century: Record<string, number>;
  medium: Record<string, number>;
  totalInteractions: number;
}

export type InteractionType = 'like' | 'view' | 'detail' | 'share' | 'skip';

export const INTERACTION_WEIGHTS: Record<InteractionType, number> = {
  like: 1.0,
  share: 0.8,
  detail: 0.5,
  view: 0.3,
  skip: -0.2,
};
