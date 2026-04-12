export interface Threat {
	id: number;
	shortLabel: string;
	description: string;
	hwPrevents: number;
}

export const threats: Threat[] = [
	{
		id: 1,
		shortLabel: 'ZDR retention breach',
		description:
			'Persistent-retention breach at ZDR provider — ZDR claim fails, data leaks.',
		hwPrevents: 1.0
	},
	{
		id: 2,
		shortLabel: 'Employee access',
		description: 'Provider employee unauthorized access during session.',
		hwPrevents: 0.95
	},
	{
		id: 3,
		shortLabel: 'Legal interception',
		description: 'Legal compulsion for live interception targeted at user.',
		hwPrevents: 0.9
	},
	{
		id: 4,
		shortLabel: 'Policy reversal',
		description:
			'Provider policy reversal — starts retaining or training on user data.',
		hwPrevents: 1.0
	},
	{
		id: 5,
		shortLabel: 'Hostile acquisition',
		description: 'Provider acquisition with less-trusted owner.',
		hwPrevents: 1.0
	},
	{
		id: 6,
		shortLabel: 'Metadata exposure',
		description:
			'Aggregate metadata exposure — usage patterns, billing, timing.',
		hwPrevents: 0.6
	},
	{
		id: 7,
		shortLabel: 'Session profiling',
		description: 'Correlation and profiling across sessions.',
		hwPrevents: 0.8
	},
	{
		id: 8,
		shortLabel: 'Supply-chain compromise',
		description:
			'Supply-chain compromise (cloud-specific). Affects both cloud and local equally.',
		hwPrevents: 0.0
	},
	{
		id: 9,
		shortLabel: 'Cross-tenant leak',
		description:
			'Cross-tenant data leak from provider infrastructure bug.',
		hwPrevents: 1.0
	},
	{
		id: 10,
		shortLabel: 'Nation-state insider',
		description: 'Insider nation-state compromise of provider.',
		hwPrevents: 1.0
	}
];

export interface ProbabilityOption {
	label: string;
	description: string;
	midpoint: number;
}

export const probabilityOptions: ProbabilityOption[] = [
	{
		label: 'Effectively never',
		description: "I'd be shocked if this happened",
		midpoint: 0.0005
	},
	{
		label: 'Very rare',
		description: 'Happens to someone like me once a career',
		midpoint: 0.005
	},
	{
		label: 'Rare',
		description: 'Happens to someone I know once a decade',
		midpoint: 0.03
	},
	{
		label: 'Occasional',
		description: 'Happens in my social circle every few years',
		midpoint: 0.1
	},
	{
		label: 'Common',
		description: "I know people it's happened to recently",
		midpoint: 0.25
	},
	{
		label: 'Frequent',
		description: "I've had near-misses or direct experience",
		midpoint: 0.5
	}
];

export interface ImpactLevel {
	label: string;
	dollar: number;
	example: string;
}

export interface ImpactScale {
	name: string;
	description: string;
	levels: ImpactLevel[];
}

export const impactScales: ImpactScale[] = [
	{
		name: 'Monetary',
		description: 'Direct financial cost to recover, replace, or absorb the damage.',
		levels: [
			{
				label: 'Negligible',
				dollar: 50,
				example: 'The cost of a few lost subscriptions or a small fraud charge you dispute and recover.'
			},
			{
				label: 'Minor',
				dollar: 550,
				example: 'A weekend trip you have to cancel, or a month of identity-monitoring service.'
			},
			{
				label: 'Moderate',
				dollar: 5500,
				example: 'A major appliance replacement, a medical deductible, or a credit-freeze / legal consult cycle.'
			},
			{
				label: 'Major',
				dollar: 55000,
				example: 'A used car or a year of mortgage payments — a setback that reshapes your budget.'
			},
			{
				label: 'Severe',
				dollar: 150000,
				example: 'Catastrophic: a child\u2019s college fund, a down payment, or recovery from serious fraud.'
			}
		]
	},
	{
		name: 'Psychological-relational',
		description:
			'Emotional and relational toll — the distress, shame, or damage to trust this would cause.',
		levels: [
			{
				label: 'Mild discomfort',
				dollar: 125,
				example: 'The cringe of reading your own old posts in public. Uncomfortable but forgotten in a week.'
			},
			{
				label: 'Real distress',
				dollar: 1250,
				example: 'A few weeks of bad sleep and intrusive thoughts. You\u2019d pay to undo it.'
			},
			{
				label: 'Violation',
				dollar: 6000,
				example: 'Like finding out someone read your journal. Months of processing; trust is shaken.'
			},
			{
				label: 'Betrayal',
				dollar: 30000,
				example: 'A close relationship ending over it. Therapy, damaged identity, long recovery.'
			},
			{
				label: 'Trauma',
				dollar: 75000,
				example:
					'Years-long impact on how you relate to others. Hypervigilance, foreclosed intimacy.'
			}
		]
	},
	{
		name: 'Third-party harm',
		description:
			'Harm to other people whose data flows through your AI pipeline (friends, family, clients).',
		levels: [
			{
				label: 'None',
				dollar: 0,
				example: 'Only your own content is involved — no third parties in scope.'
			},
			{
				label: 'Minor',
				dollar: 1250,
				example:
					'A friend\u2019s embarrassing story gets an awkward retelling. They\u2019re annoyed, not injured.'
			},
			{
				label: 'Real harm',
				dollar: 27500,
				example:
					'Someone\u2019s medical, financial, or legal privacy meaningfully breached. Real consequences for them.'
			},
			{
				label: 'Severe harm',
				dollar: 75000,
				example:
					'Someone\u2019s safety, livelihood, or relationship actually damaged by the exposure.'
			}
		]
	}
];

export interface MitigationAnchor {
	value: number;
	label: string;
	example: string;
}

export const mitigationAnchors: MitigationAnchor[] = [
	{
		value: 0,
		label: '0% — No protection',
		example:
			'Hardware doesn\u2019t help here. The threat affects cloud and local equally (e.g. supply-chain compromise).'
	},
	{
		value: 0.25,
		label: '25% — Light protection',
		example:
			'Some exposure paths close, but the main attack vector remains. Most metadata still leaks.'
	},
	{
		value: 0.5,
		label: '50% — Partial protection',
		example:
			'Content stays local, but timing, billing, or network metadata still reveal meaningful patterns.'
	},
	{
		value: 0.75,
		label: '75% — Strong protection',
		example:
			'Most of the threat surface gone. A determined adversary could still infer some things from side channels.'
	},
	{
		value: 1.0,
		label: '100% — Full prevention',
		example:
			'Content never leaves your perimeter. The threat vector is closed for local inference.'
	}
];
