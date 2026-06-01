import type { PageController } from '../PageController'

const clearFunctions = [] as (() => void)[]

/**
 * Ant Design's select component uses a div wrapping an input structure, with all information on the input tag,
 * but the input is invisible and won't appear in the cleaned tree, so we elevate it here
 */
function fixAntdSelect() {
	const selects = [...document.querySelectorAll('input[role="combobox"]')]
	// for (const select of selects) {}
}

export function patchAntd(pageController: PageController) {
	pageController.addEventListener('beforeUpdate', fixAntdSelect)
	pageController.addEventListener('afterUpdate', () => {
		for (const fn of clearFunctions) fn()
		clearFunctions.length = 0
	})
}
