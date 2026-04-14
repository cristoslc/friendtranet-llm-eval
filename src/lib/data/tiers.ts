export interface HardwareTier {
	id: string;
	label: string;
	config: string;
	upfront: number;
	annualTCO: number;
	capabilityCeiling: string;
}

export const hardwareTiers: HardwareTier[] = [
	{
		id: 'entry',
		label: 'Entry',
		config: 'Mac mini M4 Pro 64GB 2TB',
		upfront: 2400,
		annualTCO: 984,
		capabilityCeiling: 'Qwen3-Next-80B-A3B (tight)'
	},
	{
		id: 'mid',
		label: 'Mid',
		config: 'Mac Studio M4 Max 128GB 2TB',
		upfront: 4500,
		annualTCO: 1680,
		capabilityCeiling: 'GPT-OSS-120B comfortable'
	},
	{
		id: 'high',
		label: 'High',
		config: 'Mac Studio M3 Ultra 256GB 2TB',
		upfront: 7899,
		annualTCO: 2808,
		capabilityCeiling: 'Qwen3-235B-A22B comfortable'
	},
	{
		id: 'max',
		label: 'Max',
		config: 'Mac Studio M3 Ultra 512GB (secondary market)',
		upfront: 14000,
		annualTCO: 4848,
		capabilityCeiling: 'Qwen3.5-397B / GLM-5.1 / MiniMax M2.7'
	}
];

export interface ModelTier {
	id: string;
	label: string;
	modelId: string;
	isAnchor: boolean;
	/** Default-on when starting a fresh evaluation. Tiers whose ZDR
	 * endpoints are often unavailable on OpenRouter default to off
	 * so users aren't surprised by 404s. */
	defaultSelected: boolean;
	/** User-facing note about availability caveats. */
	note?: string;
	/** Override the shared default output budget (8192) for this model.
	 * Use for reasoning-capable models that consume significant tokens
	 * before emitting visible content, or for providers with non-obvious
	 * effective caps. Omit to inherit the shared default. */
	maxTokens?: number;
}

/**
 * Native context-window ceiling per model ID keyed by the OpenRouter model
 * slug. Used by SPEC-013 to cap max_tokens at min(userChoice, nativeMax).
 * Qwen 3.5 family reports 256K native but the spec caps them at 128K for the
 * "Target 128K" preset — the caller applies min() before this table is
 * relevant only for smaller-native models (e.g., gpt-oss-120b at 128K).
 */
export const MODEL_NATIVE_MAX_CONTEXT: Record<string, number> = {
	'qwen/qwen3.5-9b': 131072,
	'qwen/qwen3.5-35b-a3b': 131072,
	'openai/gpt-oss-120b': 128000,
	'qwen/qwen3.5-122b-a10b': 131072,
	'qwen/qwen3.5-397b-a17b': 131072,
	'anthropic/claude-opus-4-6': 200000
};

/** Fallback native max for model IDs not in MODEL_NATIVE_MAX_CONTEXT. */
export const DEFAULT_NATIVE_MAX_CONTEXT = 131072;

export const modelTiers: ModelTier[] = [
	{
		id: 'mini',
		label: 'Mini',
		modelId: 'qwen/qwen3.5-9b',
		isAnchor: false,
		defaultSelected: true,
		note: '9B dense. Fits any tier. Qwen 3.5 generation (Mar 2026). Reasoning-capable — bumped budget (16k) prevents empty-response truncation on long turns.',
		maxTokens: 16384
	},
	{
		id: 'small',
		label: 'Small',
		modelId: 'qwen/qwen3.5-35b-a3b',
		isAnchor: false,
		defaultSelected: true,
		note: '35B total / 3B active MoE. Fits Entry tier comfortably.'
	},
	{
		id: 'medium',
		label: 'Medium',
		modelId: 'openai/gpt-oss-120b',
		isAnchor: false,
		defaultSelected: true,
		note: '120B dense. Fits Mid tier. Strong ZDR availability via OpenAI-gateway providers.'
	},
	{
		id: 'large',
		label: 'Large',
		modelId: 'qwen/qwen3.5-122b-a10b',
		isAnchor: false,
		defaultSelected: true,
		note: '122B total / 10B active MoE (Feb 2026). Drop-in replacement for qwen3-235b-a22b which frequently lacks ZDR endpoints. If this one also fails, try qwen/qwen3.5-397b-a17b or qwen/qwen3-235b-a22b-thinking-2507 via the override below.'
	},
	{
		id: 'anchor',
		label: 'Anchor',
		modelId: 'anthropic/claude-opus-4-6',
		isAnchor: true,
		defaultSelected: true,
		note: 'Frontier baseline. Anthropic has strong ZDR support.'
	}
];
