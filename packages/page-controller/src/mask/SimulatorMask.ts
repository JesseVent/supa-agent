import { Motion } from 'ai-motion'

import { isPageDark } from './checkDarkMode'
import cursorStyles from './cursor.module.css'
import styles from './SimulatorMask.module.css'

export class SimulatorMask extends EventTarget {
	shown: boolean = false
	wrapper = document.createElement('div')
	motion: Motion | null = null

	#disposed = false

	#cursor = document.createElement('div')

	#currentCursorX = 0
	#currentCursorY = 0

	#targetCursorX = 0
	#targetCursorY = 0

	constructor() {
		super()

		this.wrapper.id = 'supa-agent-runtime_simulator-mask'
		this.wrapper.className = styles.wrapper
		this.wrapper.setAttribute('data-supa-agent-ignore', 'true')

		try {
			const motion = new Motion({
				mode: isPageDark() ? 'dark' : 'light',
				styles: { position: 'absolute', inset: '0' },
			})
			this.motion = motion
			this.wrapper.appendChild(motion.element)
			motion.autoResize(this.wrapper)

			// Override to Supabase brand green palette
			this.wrapper.style.setProperty('--color-1', 'rgb(62, 207, 142)')   // brand green #3ECF8E
			this.wrapper.style.setProperty('--color-2', 'rgb(0, 196, 100)')    // brand-link
			this.wrapper.style.setProperty('--color-3', 'rgb(128, 210, 176)')  // brand-600 (light mint)
			this.wrapper.style.setProperty('--color-4', 'rgb(0, 98, 52)')      // brand-500 (deep green)
		} catch (e) {
			console.warn('[SimulatorMask] Motion overlay unavailable:', e)
		}

		// Capture all mouse, keyboard, and wheel events
		this.wrapper.addEventListener('click', (e) => {
			e.stopPropagation()
			e.preventDefault()
		})
		this.wrapper.addEventListener('mousedown', (e) => {
			e.stopPropagation()
			e.preventDefault()
		})
		this.wrapper.addEventListener('mouseup', (e) => {
			e.stopPropagation()
			e.preventDefault()
		})
		this.wrapper.addEventListener('mousemove', (e) => {
			e.stopPropagation()
			e.preventDefault()
		})
		this.wrapper.addEventListener('wheel', (e) => {
			e.stopPropagation()
			e.preventDefault()
		})
		this.wrapper.addEventListener('keydown', (e) => {
			e.stopPropagation()
			e.preventDefault()
		})
		this.wrapper.addEventListener('keyup', (e) => {
			e.stopPropagation()
			e.preventDefault()
		})

		// Create AI cursor
		this.#createCursor()
		// this.show()

		document.body.appendChild(this.wrapper)

		this.#moveCursorToTarget()

		// global events
		// @note Mask should be isolated from the rest of the code.
		// Global events are easier to manage and cleanup.

		const movePointerToListener = (event: Event) => {
			const { x, y } = (event as CustomEvent).detail
			this.setCursorPosition(x, y)
		}
		const clickPointerListener = () => {
			this.triggerClickAnimation()
		}
		const enablePassThroughListener = () => {
			this.wrapper.style.pointerEvents = 'none'
		}
		const disablePassThroughListener = () => {
			this.wrapper.style.pointerEvents = 'auto'
		}

		window.addEventListener('SupaAgent::MovePointerTo', movePointerToListener)
		window.addEventListener('SupaAgent::ClickPointer', clickPointerListener)
		window.addEventListener('SupaAgent::EnablePassThrough', enablePassThroughListener)
		window.addEventListener('SupaAgent::DisablePassThrough', disablePassThroughListener)

		this.addEventListener('dispose', () => {
			window.removeEventListener('SupaAgent::MovePointerTo', movePointerToListener)
			window.removeEventListener('SupaAgent::ClickPointer', clickPointerListener)
			window.removeEventListener('SupaAgent::EnablePassThrough', enablePassThroughListener)
			window.removeEventListener('SupaAgent::DisablePassThrough', disablePassThroughListener)
		})
	}

	#createCursor() {
		this.#cursor.className = cursorStyles.cursor

		// Create ripple effect container
		const rippleContainer = document.createElement('div')
		rippleContainer.className = cursorStyles.cursorRipple
		this.#cursor.appendChild(rippleContainer)

		// Create filling layer
		const fillingLayer = document.createElement('div')
		fillingLayer.className = cursorStyles.cursorFilling
		this.#cursor.appendChild(fillingLayer)

		// Create border layer
		const borderLayer = document.createElement('div')
		borderLayer.className = cursorStyles.cursorBorder
		this.#cursor.appendChild(borderLayer)

		this.wrapper.appendChild(this.#cursor)
	}

	#moveCursorToTarget() {
		if (this.#disposed) return

		const newX = this.#currentCursorX + (this.#targetCursorX - this.#currentCursorX) * 0.2
		const newY = this.#currentCursorY + (this.#targetCursorY - this.#currentCursorY) * 0.2

		const xDistance = Math.abs(newX - this.#targetCursorX)
		if (xDistance > 0) {
			if (xDistance < 2) {
				this.#currentCursorX = this.#targetCursorX
			} else {
				this.#currentCursorX = newX
			}
			this.#cursor.style.left = `${this.#currentCursorX}px`
		}

		const yDistance = Math.abs(newY - this.#targetCursorY)
		if (yDistance > 0) {
			if (yDistance < 2) {
				this.#currentCursorY = this.#targetCursorY
			} else {
				this.#currentCursorY = newY
			}
			this.#cursor.style.top = `${this.#currentCursorY}px`
		}

		requestAnimationFrame(() => this.#moveCursorToTarget())
	}

	setCursorPosition(x: number, y: number) {
		if (this.#disposed) return

		this.#targetCursorX = x
		this.#targetCursorY = y
	}

	triggerClickAnimation() {
		if (this.#disposed) return

		this.#cursor.classList.remove(cursorStyles.clicking)
		// Force reflow to restart animation
		void this.#cursor.offsetHeight
		this.#cursor.classList.add(cursorStyles.clicking)
	}

	show() {
		if (this.shown || this.#disposed) return

		this.shown = true
		this.motion?.start()
		this.motion?.fadeIn()

		this.wrapper.classList.add(styles.visible)

		// Initialize cursor position
		this.#currentCursorX = window.innerWidth / 2
		this.#currentCursorY = window.innerHeight / 2
		this.#targetCursorX = this.#currentCursorX
		this.#targetCursorY = this.#currentCursorY
		this.#cursor.style.left = `${this.#currentCursorX}px`
		this.#cursor.style.top = `${this.#currentCursorY}px`
	}

	hide() {
		if (!this.shown || this.#disposed) return

		this.shown = false
		this.motion?.fadeOut()
		this.motion?.pause()

		this.#cursor.classList.remove(cursorStyles.clicking)

		setTimeout(() => {
			this.wrapper.classList.remove(styles.visible)
		}, 800) // Match the animation duration
	}

	dispose() {
		this.#disposed = true

		this.motion?.dispose()
		this.wrapper.remove()
		this.dispatchEvent(new Event('dispose'))
	}
}
