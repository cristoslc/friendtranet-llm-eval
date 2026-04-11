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
}

export interface ImpactScale {
	name: string;
	levels: ImpactLevel[];
}

export const impactScales: ImpactScale[] = [
	{
		name: 'Monetary',
		levels: [
			{ label: 'Negligible', dollar: 50 },
			{ label: 'Minor', dollar: 550 },
			{ label: 'Moderate', dollar: 5500 },
			{ label: 'Major', dollar: 55000 },
			{ label: 'Severe', dollar: 150000 }
		]
	},
	{
		name: 'Psychological-relational',
		levels: [
			{ label: 'Mild discomfort', dollar: 125 },
			{ label: 'Real distress', dollar: 1250 },
			{ label: 'Violation', dollar: 6000 },
			{ label: 'Betrayal', dollar: 30000 },
			{ label: 'Trauma', dollar: 75000 }
		]
	},
	{
		name: 'Third-party harm',
		levels: [
			{ label: 'None', dollar: 0 },
			{ label: 'Minor', dollar: 1250 },
			{ label: 'Real harm', dollar: 27500 },
			{ label: 'Severe harm', dollar: 75000 }
		]
	}
];
