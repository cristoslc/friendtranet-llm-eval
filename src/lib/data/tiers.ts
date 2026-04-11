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
}

export const modelTiers: ModelTier[] = [
	{ id: 'mini', label: 'Mini', modelId: 'qwen/qwen3-30b-a3b', isAnchor: false },
	{
		id: 'small',
		label: 'Small',
		modelId: 'qwen/qwen3-next-80b-a3b-instruct',
		isAnchor: false
	},
	{ id: 'medium', label: 'Medium', modelId: 'openai/gpt-oss-120b', isAnchor: false },
	{ id: 'large', label: 'Large', modelId: 'qwen/qwen3-235b-a22b', isAnchor: false },
	{
		id: 'anchor',
		label: 'Anchor',
		modelId: 'anthropic/claude-opus-4-6',
		isAnchor: true
	}
];
