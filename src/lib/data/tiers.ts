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
		id: 'nvidia-spark',
		label: 'DGX Spark',
		config: 'NVIDIA DGX Spark GB10 128GB 4TB',
		upfront: 4699,
		annualTCO: 1649,
		capabilityCeiling: '~200B FP4; 70B FP16 comfortable'
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

export interface ModelTierAlternative {
	modelId: string;
	peakRamGB: number;
	note: string;
}

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
	/** Peak unified-memory footprint: 5 concurrent users × 128K context, 4-bit MLX.
	 * 0 for cloud-only tiers (Anchor). Source: trove apple-silicon-model-tier-ram@d681e07. */
	peakRamGB: number;
	/** Minimum hardware tier ID that can sustain this load. References hardwareTiers.
	 * 'cloud' for cloud-only tiers. */
	minHardwareTierId: string;
	/** Higher hardware tier where this model runs comfortably (not tight on RAM).
	 * null for cloud-only tiers or tiers where min is already comfortable. */
	comfortableHardwareTierId: string | null;
	/** Cross-family alternatives at a similar RAM envelope. */
	alternatives: ModelTierAlternative[];
	/** Fixed cloud quantization for models where OpenRouter has no band choice.
	 * 'mxfp4' — model is natively MXFP4 (local and cloud match).
	 * 'fp8'   — all cloud providers serve fp8 only; local MLX runs int4.
	 * Omit for models that respect the active precision band. */
	cloudQuantization?: 'mxfp4' | 'fp8';
}

/**
 * Native context-window ceiling per model ID keyed by the OpenRouter model
 * slug. Used by SPEC-013 to cap max_tokens at min(userChoice, nativeMax).
 * Qwen 3.5 family reports 256K native but the spec caps them at 128K for the
 * "Target 128K" preset — the caller applies min() before this table is
 * relevant only for smaller-native models (e.g., gpt-oss-120b at 128K).
 * Source: trove apple-silicon-model-tier-ram@d681e07.
 */
export const MODEL_NATIVE_MAX_CONTEXT: Record<string, number> = {
	'qwen/qwen3.5-9b': 131072,
	'qwen/qwen3.5-35b-a3b': 131072,
	'openai/gpt-oss-120b': 128000,
	'qwen/qwen3.5-122b-a10b': 131072,
	'qwen/qwen3.5-397b-a17b': 131072,
	'z-ai/glm-4.6': 204800,
	'meta/llama-4-maverick': 131072,
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
		maxTokens: 16384,
		peakRamGB: 34,
		minHardwareTierId: 'entry',
		comfortableHardwareTierId: 'entry',
		alternatives: [
			{
				modelId: 'openai/gpt-oss-20b',
				peakRamGB: 34,
				note: 'MXFP4 native; 3.6B active MoE; hybrid attention.'
			},
			{
				modelId: 'google/gemma-4-e4b',
				peakRamGB: 17,
				note: 'PLE architecture; sub-Mini footprint.'
			}
		]
	},
	{
		id: 'small',
		label: 'Small',
		modelId: 'qwen/qwen3.5-35b-a3b',
		isAnchor: false,
		defaultSelected: true,
		note: '35B total / 3B active MoE. Fits Entry tier comfortably.',
		peakRamGB: 40,
		minHardwareTierId: 'entry',
		comfortableHardwareTierId: 'entry',
		alternatives: [
			{
				modelId: 'google/gemma-4-26b-a4b',
				peakRamGB: 35,
				note: '3.8B active MoE; hybrid + shared KV cache.'
			},
			{
				modelId: 'google/gemma-4-31b-dense',
				peakRamGB: 43,
				note: 'Dense 31B; sliding-window attention.'
			}
		]
	},
	{
		id: 'medium',
		label: 'Medium',
		modelId: 'openai/gpt-oss-120b',
		isAnchor: false,
		defaultSelected: true,
		note: '120B dense. Fits Mid tier. Strong ZDR availability via OpenAI-gateway providers.',
		cloudQuantization: 'mxfp4',
		peakRamGB: 91,
		minHardwareTierId: 'mid',
		comfortableHardwareTierId: 'high',
		alternatives: [
			{
				modelId: 'meta/llama-4-scout',
				peakRamGB: 106,
				note: '17B active × 16 experts MoE; weight size unverified.'
			}
		]
	},
	{
		id: 'large',
		label: 'Large',
		modelId: 'qwen/qwen3.5-122b-a10b',
		isAnchor: false,
		defaultSelected: true,
		note: '122B total / 10B active MoE (Feb 2026). Drop-in replacement for qwen3-235b-a22b which frequently lacks ZDR endpoints. If this one also fails, try qwen/qwen3.5-397b-a17b or qwen/qwen3-235b-a22b-thinking-2507 via the override below.',
		peakRamGB: 92,
		minHardwareTierId: 'mid',
		comfortableHardwareTierId: 'high',
		alternatives: []
	},
	{
		id: 'xl',
		label: 'XL',
		modelId: 'z-ai/glm-4.6',
		isAnchor: false,
		defaultSelected: false,
		note: '~200B dense. Requires Mac Studio M3 Ultra 256 GB (High, very tight) or 512 GB (Max, comfortable). OpenRouter serves fp8 only via SiliconFlow — local MLX runs at int4 (~230–245 GB). Same fp8/int4 caveat as Max tier.',
		cloudQuantization: 'fp8',
		peakRamGB: 238,
		minHardwareTierId: 'high',
		comfortableHardwareTierId: 'max',
		alternatives: []
	},
	{
		id: 'max',
		label: 'Max',
		modelId: 'meta/llama-4-maverick',
		isAnchor: false,
		defaultSelected: false,
		note: '17B active × 128 experts MoE. Requires Mac Studio M3 Ultra 512 GB (~$14K secondary market). OpenRouter serves fp8 only — local MLX runs at int4 (226 GB). Conversational quality gap is modest (~0.6 pp MMLU-Pro); technical-domain gap is material (up to 8 pp HumanEval). W3 precision badge documents the fp8/int4 delta.',
		cloudQuantization: 'fp8',
		peakRamGB: 251,
		minHardwareTierId: 'max',
		comfortableHardwareTierId: 'max',
		alternatives: []
	},
	{
		id: 'anchor',
		label: 'Anchor',
		modelId: 'anthropic/claude-opus-4-6',
		isAnchor: true,
		defaultSelected: true,
		note: 'Frontier baseline. Anthropic has strong ZDR support.',
		peakRamGB: 0,
		minHardwareTierId: 'cloud',
		comfortableHardwareTierId: null,
		alternatives: []
	}
];

