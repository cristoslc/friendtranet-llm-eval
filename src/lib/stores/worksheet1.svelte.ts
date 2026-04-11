import { dbGet, dbSet } from './db';

export interface ThreatResponse {
	probabilityIndex: number | null;
	impactSelections: Record<string, number | null>;
	hwMitigation: number;
}

export interface W1State {
	responses: Record<number, ThreatResponse>;
	riskAversionRows: number[];
	riskAversionMultipliers: Record<number, number>;
}

const DEFAULT_STATE: W1State = {
	responses: {},
	riskAversionRows: [],
	riskAversionMultipliers: {}
};

let state = $state<W1State>({ ...DEFAULT_STATE });
let loaded = $state(false);

export function getW1State() {
	return state;
}

export function isW1Loaded() {
	return loaded;
}

export async function loadW1() {
	const saved = await dbGet<W1State>('worksheets', 'w1');
	if (saved) {
		state.responses = saved.responses ?? {};
		state.riskAversionRows = saved.riskAversionRows ?? [];
		state.riskAversionMultipliers = saved.riskAversionMultipliers ?? {};
	}
	loaded = true;
}

export async function saveW1() {
	await dbSet('worksheets', 'w1', JSON.parse(JSON.stringify({
		responses: state.responses,
		riskAversionRows: state.riskAversionRows,
		riskAversionMultipliers: state.riskAversionMultipliers
	})));
}

export function setThreatProbability(threatId: number, probabilityIndex: number) {
	if (!state.responses[threatId]) {
		state.responses[threatId] = {
			probabilityIndex: null,
			impactSelections: {},
			hwMitigation: 0
		};
	}
	state.responses[threatId].probabilityIndex = probabilityIndex;
	saveW1();
}

export function setThreatImpact(threatId: number, scaleName: string, levelIndex: number) {
	if (!state.responses[threatId]) {
		state.responses[threatId] = {
			probabilityIndex: null,
			impactSelections: {},
			hwMitigation: 0
		};
	}
	state.responses[threatId].impactSelections[scaleName] = levelIndex;
	saveW1();
}

export function setHwMitigation(threatId: number, value: number) {
	if (!state.responses[threatId]) {
		state.responses[threatId] = {
			probabilityIndex: null,
			impactSelections: {},
			hwMitigation: value
		};
	}
	state.responses[threatId].hwMitigation = value;
	saveW1();
}

export function setRiskAversionRows(rows: number[]) {
	state.riskAversionRows = rows.slice(0, 2);
	saveW1();
}

export function setRiskAversionMultiplier(threatId: number, multiplier: number) {
	state.riskAversionMultipliers[threatId] = multiplier;
	saveW1();
}

import { threats, probabilityOptions, impactScales } from '$lib/data/threats';

export function computeThreatLoss(threatId: number): number {
	const resp = state.responses[threatId];
	if (!resp || resp.probabilityIndex === null) return 0;

	const prob = probabilityOptions[resp.probabilityIndex].midpoint;

	let maxImpact = 0;
	for (const scale of impactScales) {
		const idx = resp.impactSelections[scale.name];
		if (idx !== null && idx !== undefined && scale.levels[idx]) {
			maxImpact = Math.max(maxImpact, scale.levels[idx].dollar);
		}
	}
	if (maxImpact === 0) return 0;

	const threat = threats.find((t) => t.id === threatId);
	const mitigation = resp.hwMitigation !== undefined ? resp.hwMitigation : (threat?.hwPrevents ?? 0);

	return prob * maxImpact * mitigation;
}

export function computeBaseLoss(): number {
	return threats.reduce((sum, t) => sum + computeThreatLoss(t.id), 0);
}

export function computePremium(): number {
	let premium = 0;
	for (const rowId of state.riskAversionRows) {
		const base = computeThreatLoss(rowId);
		const mult = state.riskAversionMultipliers[rowId] ?? 1;
		premium += base * (mult - 1);
	}
	return premium;
}

export function computeTotalLoss(): number {
	return computeBaseLoss() + computePremium();
}

export function completedRowCount(): number {
	let count = 0;
	for (const t of threats) {
		const resp = state.responses[t.id];
		if (resp && resp.probabilityIndex !== null) {
			const hasImpact = Object.values(resp.impactSelections).some(
				(v) => v !== null && v !== undefined
			);
			if (hasImpact) count++;
		}
	}
	return count;
}
