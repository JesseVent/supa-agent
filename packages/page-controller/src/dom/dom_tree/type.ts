// FlatDomTree: Flattened DOM tree structure for efficient storage and traversal of page structure.
// Each node is indexed via map, supporting text nodes and element nodes, with fields distinguishing between undefined and false.

export interface FlatDomTree {
	rootId: string
	map: Record<string, DomNode>
}

export type DomNode = TextDomNode | ElementDomNode | InteractiveElementDomNode

export interface TextDomNode {
	type: 'TEXT_NODE'
	text: string
	isVisible: boolean
	// other optional fields
	[key: string]: unknown
}

export interface ElementDomNode {
	tagName: string
	attributes?: Record<string, string>
	xpath?: string
	children?: string[]
	isVisible?: boolean
	isTopElement?: boolean
	isInViewport?: boolean
	isNew?: boolean
	isInteractive?: false
	highlightIndex?: number
	extra?: Record<string, any>
	// other optional fields
	[key: string]: unknown
}

export interface InteractiveElementDomNode {
	tagName: string
	attributes?: Record<string, string>
	xpath?: string
	children?: string[]
	isVisible?: boolean
	isTopElement?: boolean
	isInViewport?: boolean
	isInteractive: true
	highlightIndex: number
	/**
	 * DOM reference for interactive elements
	 */
	ref: HTMLElement
	// other optional fields
	[key: string]: unknown
}
