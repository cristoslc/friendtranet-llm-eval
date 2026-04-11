export const classifiedCategories = [
	{ id: 'household', label: 'Household logistics / partner ops / family PII' },
	{
		id: 'health',
		label: 'Personal health / medical / therapy / mental-health processing'
	},
	{ id: 'financial', label: 'Financial records / tax prep / legal drafts' },
	{ id: 'intimate', label: 'Intimate / relationship content' },
	{
		id: 'thirdparty',
		label: "Third-party content held in trust (friends' disclosures, community work)"
	},
	{
		id: 'creative',
		label: 'Creative work in progress considered personal/unfinished'
	},
	{
		id: 'professional',
		label: 'Research or professional work under confidentiality obligations'
	},
	{
		id: 'religious',
		label: 'Religious / spiritual / philosophical reflection'
	},
	{
		id: 'political',
		label: 'Political organizing / dissent / sensitive civic work'
	},
	{ id: 'other', label: 'Other' }
];

export interface StanceOption {
	id: string;
	label: string;
	description: string;
}

export const stanceOptions: StanceOption[] = [
	{
		id: 'topological',
		label: 'Topological sovereignty',
		description:
			'Content originating in my perimeter should stay in my perimeter.'
	},
	{
		id: 'trust',
		label: 'Trust disposition',
		description:
			"I don't want commercial entities with sensitive personal content as baseline."
	},
	{
		id: 'consent',
		label: 'Consent obligations',
		description:
			"Third parties in my pipeline didn't consent to commercial AI processing."
	},
	{
		id: 'political',
		label: 'Political/infrastructure',
		description:
			'Supporting non-commercial infrastructure is a civic act.'
	},
	{
		id: 'epistemic',
		label: 'Epistemic/learning',
		description: 'I want to understand the tech by running it.'
	},
	{
		id: 'aesthetic',
		label: 'Aesthetic/identity',
		description:
			'Aligns with who I want to be, independent of argument.'
	},
	{
		id: 'combination',
		label: 'Combination',
		description: 'Multiple stances apply.'
	},
	{
		id: 'none',
		label: 'None — risk-only',
		description:
			'My sovereignty value comes entirely from risk assessment.'
	}
];

export interface CompromiseOption {
	label: string;
	description: string;
	reduction: number;
}

export const compromiseOptions: CompromiseOption[] = [
	{
		label: 'Not at all',
		description: 'Any subset I can protect is worth protecting.',
		reduction: 0
	},
	{
		label: 'Slightly',
		description: 'Small gaps are acceptable.',
		reduction: 0.1
	},
	{
		label: 'Moderately',
		description: "I'd tolerate meaningful gaps.",
		reduction: 0.25
	},
	{
		label: 'Significantly',
		description: "If I'm already compromising, why pay for partial?",
		reduction: 0.5
	},
	{
		label: 'Substantially',
		description: "If not complete, I'd rather not bother.",
		reduction: 0.75
	}
];

export const calibrationAnchors = [
	{ label: 'Music streaming', amount: 120 },
	{ label: 'Private email', amount: 50 },
	{ label: 'Data broker deletion', amount: 200 },
	{ label: 'Cause donation', amount: 100 }
];
