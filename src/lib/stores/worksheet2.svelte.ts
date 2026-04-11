import { dbGet, dbSet } from './db';
import { hardwareTiers } from '$lib/data/tiers';

export interface W2State {
	selectedCategories: string[];
	otherText: string;
	stance: string | null;
	combinationText: string;
	wtpAmount: number;
	compromiseIndex: number | null;
	sanityConfirmed: boolean;
}

const DEFAULT_STATE: W2State = {
	selectedCategories: [],
	otherText: '',
	stance: null,
	combinationText: '',
	wtpAmount: 0,
	compromiseIndex: null,
	sanityConfirmed: false
};

let state = $state<W2State>({ ...DEFAULT_STATE });
let loaded = $state(false);

export function getW2State() {
	return state;
}

export function isW2Loaded() {
	return loaded;
}

export async function loadW2() {
	const saved = await dbGet<W2State>('worksheets', 'w2');
	if (saved) {
		Object.assign(state, saved);
	}
	loaded = true;
}

export async function saveW2() {
	await dbSet('worksheets', 'w2', { ...state });
}

export function toggleCategory(id: string) {
	const idx = state.selectedCategories.indexOf(id);
	if (idx >= 0) {
		state.selectedCategories.splice(idx, 1);
	} else {
		state.selectedCategories.push(id);
	}
	saveW2();
}

export function setOtherText(text: string) {
	state.otherText = text;
	saveW2();
}

export function setStance(id: string) {
	state.stance = id;
	if (id === 'none') {
		state.wtpAmount = 0;
	}
	saveW2();
}

export function setCombinationText(text: string) {
	state.combinationText = text;
	saveW2();
}

export function setWtpAmount(amount: number) {
	state.wtpAmount = amount;
	saveW2();
}

export function setCompromiseIndex(index: number) {
	state.compromiseIndex = index;
	saveW2();
}

export function confirmSanity(confirmed: boolean) {
	state.sanityConfirmed = confirmed;
	saveW2();
}

import { compromiseOptions } from '$lib/data/principles';

export function computeAdjustedWtp(): number {
	if (state.compromiseIndex === null) return state.wtpAmount;
	const reduction = compromiseOptions[state.compromiseIndex].reduction;
	return state.wtpAmount * (1 - reduction);
}

export function computeMonthlyWtp(): number {
	return computeAdjustedWtp() / 12;
}

export function getJustifiedTiers(combinedTotal: number) {
	return hardwareTiers.filter((t) => combinedTotal >= t.annualTCO);
}
