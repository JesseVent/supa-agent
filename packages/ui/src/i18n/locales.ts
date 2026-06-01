// English translations (base/reference language)
const enUS = {
	ui: {
		panel: {
			ready: 'Ready',
			thinking: 'Thinking...',
			taskInput: 'Enter new task, describe steps in detail, press Enter to submit',
			userAnswerPrompt: 'Please answer the question above, press Enter to submit',
			taskTerminated: 'Task terminated',
			taskCompleted: 'Task completed',
			userAnswer: 'User answer: {{input}}',
			question: 'Question: {{question}}',
			waitingPlaceholder: 'Waiting for task to start...',
			stop: 'Stop',
			close: 'Close',
			expand: 'Expand history',
			collapse: 'Collapse history',
			step: 'Step {{number}}',
		},
		tools: {
			clicking: 'Clicking element [{{index}}]...',
			inputting: 'Inputting text to element [{{index}}]...',
			selecting: 'Selecting option "{{text}}"...',
			scrolling: 'Scrolling page...',
			waiting: 'Waiting {{seconds}} seconds...',
			askingUser: 'Asking user...',
			done: 'Task done',
			clicked: 'click Clicked element [{{index}}]',
			inputted: 'type Inputted text "{{text}}"',
			selected: 'check Selected option "{{text}}"',
			scrolled: 'scroll Page scrolled',
			waited: 'wait Wait completed',
			executing: 'Executing {{toolName}}...',
			resultSuccess: 'success',
			resultFailure: 'failed',
			resultError: 'error',
		},
		errors: {
			elementNotFound: 'No interactive element found at index {{index}}',
			taskRequired: 'Task description is required',
			executionFailed: 'Task execution failed',
			notInputElement: 'Element is not an input or textarea',
			notSelectElement: 'Element is not a select element',
			optionNotFound: 'Option "{{text}}" not found',
		},
	},
} as const

// Type definitions generated from English base structure (but with string values)
type DeepStringify<T> = {
	[K in keyof T]: T[K] extends string ? string : T[K] extends object ? DeepStringify<T[K]> : T[K]
}

export type TranslationSchema = DeepStringify<typeof enUS>

// Utility type: Extract all nested paths from translation object
type NestedKeyOf<ObjectType extends object> = {
	[Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
		? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
		: `${Key}`
}[keyof ObjectType & (string | number)]

// Extract all possible key paths from translation structure
export type TranslationKey = NestedKeyOf<TranslationSchema>

// Parameterized translation types
export type TranslationParams = Record<string, string | number>

export const locales = {
	'en-US': enUS,
} as const

export type SupportedLanguage = keyof typeof locales
