import { dbGet } from './db';
import type { W1State } from './worksheet1.svelte';
import type { W2State } from './worksheet2.svelte';
import { threats, probabilityOptions, impactScales } from '$lib/data/threats';
import { compromiseOptions } from '$lib/data/principles';
import { hardwareTiers } from '$lib/data/tiers';

export interface ExportData {
	version: 1;
	displayName: string;
	exportedAt: string;
	w1: {
		perThreat: Array<{
			threatId: number;
			expectedLoss: number;
		}>;
		baseLoss: number;
		riskAversionPremium: number;
		totalLoss: number;
	};
	w2: {
		selectedCategories: string[];
		stance: string | null;
		rawWtp: number;
		compromiseReduction: number;
		adjustedWtp: number;
	};
	w3: {
		evaluated: boolean;
		perTier?: Array<{
			tierId: string;
			adequacyRate: number;
			criticalFailureRate: number;
			weightedAdequacy: number;
		}>;
		personalMinimumTier?: string | null;
		compromiseCost?: number;
	};
	combined: {
		riskValue: number;
		principleValue: number;
		totalValue: number;
		justifiedTiers: string[];
	};
}

export async function generateExport(displayName: string): Promise<ExportData> {
	const w1 = await dbGet<W1State>('worksheets', 'w1');
	const w2 = await dbGet<W2State>('worksheets', 'w2');

	let baseLoss = 0;
	let premium = 0;
	const perThreat: ExportData['w1']['perThreat'] = [];

	if (w1) {
		for (const t of threats) {
			const resp = w1.responses[t.id];
			let loss = 0;
			if (resp && resp.probabilityIndex !== null) {
				const prob = probabilityOptions[resp.probabilityIndex].midpoint;
				let maxImpact = 0;
				for (const scale of impactScales) {
					const idx = resp.impactSelections[scale.name];
					if (idx !== null && idx !== undefined && scale.levels[idx]) {
						maxImpact = Math.max(maxImpact, scale.levels[idx].dollar);
					}
				}
				const mitigation =
					resp.hwMitigation !== undefined ? resp.hwMitigation : t.hwPrevents;
				loss = prob * maxImpact * mitigation;
			}
			baseLoss += loss;
			perThreat.push({ threatId: t.id, expectedLoss: loss });
		}

		for (const rowId of w1.riskAversionRows ?? []) {
			const rowLoss = perThreat.find((p) => p.threatId === rowId)?.expectedLoss ?? 0;
			const mult = w1.riskAversionMultipliers?.[rowId] ?? 1;
			premium += rowLoss * (mult - 1);
		}
	}

	const totalLoss = baseLoss + premium;

	let rawWtp = 0;
	let compromiseReduction = 0;
	let adjustedWtp = 0;
	if (w2) {
		rawWtp = w2.wtpAmount;
		compromiseReduction =
			w2.compromiseIndex !== null
				? compromiseOptions[w2.compromiseIndex].reduction
				: 0;
		adjustedWtp = rawWtp * (1 - compromiseReduction);
	}

	const totalValue = totalLoss + adjustedWtp;
	const justifiedTiers = hardwareTiers
		.filter((t) => totalValue >= t.annualTCO)
		.map((t) => t.id);

	return {
		version: 1,
		displayName,
		exportedAt: new Date().toISOString(),
		w1: { perThreat, baseLoss, riskAversionPremium: premium, totalLoss },
		w2: {
			selectedCategories: w2?.selectedCategories ?? [],
			stance: w2?.stance ?? null,
			rawWtp,
			compromiseReduction,
			adjustedWtp
		},
		w3: { evaluated: false },
		combined: {
			riskValue: totalLoss,
			principleValue: adjustedWtp,
			totalValue,
			justifiedTiers
		}
	};
}

export function downloadExport(data: ExportData) {
	const json = JSON.stringify(data, null, 2);
	const blob = new Blob([json], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `sovereignty-assessment-${data.displayName.toLowerCase().replace(/\s+/g, '-')}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

export function validateImport(data: unknown): data is ExportData {
	if (typeof data !== 'object' || data === null) return false;
	const d = data as Record<string, unknown>;
	return d.version === 1 && typeof d.displayName === 'string' && d.w1 !== undefined && d.w2 !== undefined;
}
