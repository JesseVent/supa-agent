/**
 * js 语法高亮组件，适合在文章中演示代码片段
 */
import React from 'react'

import styles from './HighlightSyntax.module.css'

interface HighlightSyntaxProps {
	code: string
}

// JavaScript/TypeScript keywords
const keywords =
	'async|await|function|const|let|var|if|else|for|while|return|try|catch|finally|class|extends|from|import|export|default|undefined|throw|break|continue|switch|case|do|with|yield|delete|typeof|void|static|get|set|super|debugger'

// TypeScript-specific keywords
const tsKeywords =
	'interface|type|enum|namespace|module|declare|abstract|implements|public|private|protected|readonly|as|satisfies|infer|keyof|is'

// Boolean values and null
const literals = 'true|false|null|undefined|NaN|Infinity'

// TypeScript built-in types
const tsTypes =
	'string|number|boolean|any|unknown|never|void|object|symbol|bigint|Array|Promise|Record|Partial|Required|Readonly|Pick|Omit|Exclude|Extract|NonNullable|ReturnType|Parameters|ConstructorParameters|InstanceType|ThisType|Uppercase|Lowercase|Capitalize|Uncapitalize'

// Helper function: escape HTML special characters
function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Syntax highlighting function, extract tokens then escape and highlight
function highlightSyntax(code: string): string {
	// Build regex pattern with more token types (match on original text)
	const pattern = new RegExp(
		'(' +
			// 1. 字符串（双引号、单引号、模板字符串）
			'"([^"\\\\]|\\\\.)*"|' +
			"'([^'\\\\]|\\\\.)*'|" +
			'`([^`\\\\]|\\\\.)*`|' +
			// 2. 注释（单行和多行）
			'//[^\\n]*|' +
			'/\\*[\\s\\S]*?\\*/|' +
			// 3. 装饰器
			'@[a-zA-Z_$][\\w$]*|' +
			// 4. 数字（包括小数、十六进制、科学计数法）
			'\\b0[xX][0-9a-fA-F]+\\b|' +
			'\\b\\d+\\.?\\d*(?:[eE][+-]?\\d+)?\\b|' +
			// 5. TypeScript/JavaScript 关键字
			'\\b(?:' +
			keywords +
			'|' +
			tsKeywords +
			'|' +
			literals +
			')\\b|' +
			// 6. TypeScript 内置类型
			'\\b(?:' +
			tsTypes +
			')\\b|' +
			// 7. 箭头函数
			'=>|' +
			// 8. 函数调用（函数名后跟括号）
			'\\b[a-zA-Z_$][\\w$]*(?=\\()|' +
			// 9. 属性访问
			'\\.[a-zA-Z_$][\\w$]*|' +
			// 10. 运算符和特殊符号
			'[+\\-*/%&|^!~<>=?:]+|' +
			'[{}\\[\\]();,.]' +
			')',
		'g'
	)

	const tokens: string[] = []
	let lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = pattern.exec(code)) !== null) {
		if (match.index > lastIndex) {
			const gap = code.slice(lastIndex, match.index)
			// Split gaps by whitespace, preserve whitespace
			tokens.push(...gap.split(/(\s+)/))
		}
		tokens.push(match[0])
		lastIndex = pattern.lastIndex
	}
	if (lastIndex < code.length) {
		tokens.push(...code.slice(lastIndex).split(/(\s+)/))
	}

	const highlighted = tokens
		.map((token) => {
			// 空白符直接返回
			if (/^\s+$/.test(token)) {
				return token
			}

			// 1. 注释（单行和多行）
			if (/^\/\/.*$/.test(token) || /^\/\*[\s\S]*?\*\/$/.test(token)) {
				return `<span class="${styles.comment}">${escapeHtml(token)}</span>`
			}

			// 2. 字符串
			if (
				/^"([^"\\]|\\.)*"$/.test(token) ||
				/^'([^'\\]|\\.)*'$/.test(token) ||
				/^`([^`\\]|\\.)*`$/.test(token)
			) {
				return `<span class="${styles.string}">${escapeHtml(token)}</span>`
			}

			// 3. 数字
			if (/^(0[xX][0-9a-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?)$/.test(token)) {
				return `<span class="${styles.number}">${escapeHtml(token)}</span>`
			}

			// 4. 布尔值和特殊字面量
			if (new RegExp(`^(?:${literals})$`).test(token)) {
				return `<span class="${styles.literal}">${escapeHtml(token)}</span>`
			}

			// 5. JavaScript/TypeScript 关键字
			if (new RegExp(`^(?:${keywords})$`).test(token)) {
				return `<span class="${styles.keyword}">${escapeHtml(token)}</span>`
			}

			// 6. TypeScript 特定关键字
			if (new RegExp(`^(?:${tsKeywords})$`).test(token)) {
				return `<span class="${styles.tsKeyword}">${escapeHtml(token)}</span>`
			}

			// 7. TypeScript 内置类型
			if (new RegExp(`^(?:${tsTypes})$`).test(token)) {
				return `<span class="${styles.type}">${escapeHtml(token)}</span>`
			}

			// 8. 装饰器
			if (/^@[a-zA-Z_$][\w$]*$/.test(token)) {
				return `<span class="${styles.decorator}">${escapeHtml(token)}</span>`
			}

			// 9. 箭头函数
			if (token === '=>') {
				return `<span class="${styles.arrow}">${escapeHtml(token)}</span>`
			}

			// 10. 函数调用和标识符
			if (/^[a-zA-Z_$][\w$]*$/.test(token)) {
				return `<span class="${styles.identifier}">${escapeHtml(token)}</span>`
			}

			// 11. 属性访问
			if (/^\.[a-zA-Z_$][\w$]*$/.test(token)) {
				return `<span class="${styles.property}">${escapeHtml(token)}</span>`
			}

			// 12. 运算符
			if (/^[+\-*/%&|^!~<>=?:]+$/.test(token)) {
				return `<span class="${styles.operator}">${escapeHtml(token)}</span>`
			}

			// 13. 其他符号，需要转义
			return escapeHtml(token)
		})
		.join('')

	return highlighted
}

const HighlightSyntaxClient: React.FC<HighlightSyntaxProps> = ({ code }) => {
	const htmlContent = highlightSyntax(code)

	return <code className={styles.syntax} dangerouslySetInnerHTML={{ __html: htmlContent }} />
}

export default HighlightSyntaxClient
