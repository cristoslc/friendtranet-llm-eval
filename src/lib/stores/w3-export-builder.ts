/**
 * Serializer for the w3 block of the assessment export.
 *
 * Pure: takes dependencies (active tier descriptors) as input rather than
 * looking them up, so it is trivially unit-testable under node's TypeScript
 * strip mode.
 */
import {
	computeTierMetricsPure,
	personalMinimumTierPure,
	type TurnRatingLike,
	type EvalResultWithSkipped,
	type TierDescriptor
} from './w3-pure.ts';

export const TIER_ORDER = ['mini', 'small', 'medium', 'large', 'anchor'];

export interface W3ExportInput {
	turnRatings?: TurnRatingLike[];
	evalResults?: Record<string, EvalResultWithSkipped>;
}

export interface W3Export {
	evaluated: boolean;
	perTier?: Array<{
		tierId: string;
		tierLabel: string;
		modelId: string;
		adequacyRate: number;
		criticalFailureRate: number;
		weightedAdequacy: number;
		meetsThreshold: boolean;
		sampleSize: number;
		skippedTurns: number;
	}>;
	personalMinimumTier?: string | null;
	compromiseCost?: number;
	turnRatings?: Array<{
		conversationId: string;
		turnIndex: number;
		ratings: Record<string, number>;
	}>;
}

/** Build the w3 block of the export from persisted W3 state plus the set of
 * tiers that should be reported. Returns `{ evaluated: false }` when there
 * are no ratings. The caller is responsible for resolving tier descriptors
 * (including model overrides) before calling. */
export function buildW3Export(
	w3: W3ExportInput | null | undefined,
	tierDescriptors: TierDescriptor[]
): W3Export {
	if (!w3 || !w3.turnRatings || w3.turnRatings.length === 0) {
		return { evaluated: false };
	}

	const metrics = computeTierMetricsPure(
		w3.turnRatings,
		w3.evalResults ?? {},
		tierDescriptors
	);
	const minTier = personalMinimumTierPure(metrics, TIER_ORDER);

	return {
		evaluated: true,
		perTier: metrics.map((m) => ({
			tierId: m.tierId,
			tierLabel: m.tierLabel,
			modelId: m.modelId,
			adequacyRate: m.adequacyRate,
			criticalFailureRate: m.criticalFailureRate,
			weightedAdequacy: m.weightedAdequacy,
			meetsThreshold: m.meetsThreshold,
			sampleSize: m.sampleSize,
			skippedTurns: m.skippedTurns
		})),
		personalMinimumTier: minTier,
		turnRatings: w3.turnRatings.map((r) => ({
			conversationId: r.conversationId,
			turnIndex: r.turnIndex,
			ratings: { ...r.ratings }
		}))
	};
}
