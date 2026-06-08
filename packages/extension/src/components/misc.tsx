import type { AgentStatus } from '@supa-agent/core'
import { BookOpen, Globe } from 'lucide-react'
import { siGithub } from 'simple-icons'

import { TypingAnimation } from '@/components/ui/typing-animation'
import { cn } from '@/lib/utils'

// Status dot indicator
export function StatusDot({ status }: { status: AgentStatus }) {
	const colorClass = {
		idle: 'bg-muted-foreground',
		running: 'bg-amber-400',
		completed: 'bg-emerald-500',
		error: 'bg-destructive',
	}[status]

	const label = {
		idle: 'Ready',
		running: 'Running',
		completed: 'Done',
		error: 'Error',
	}[status]

	return (
		<div className="flex items-center gap-1.5 mr-2">
			<span
				className={cn('size-2 rounded-full', colorClass, status === 'running' && 'animate-pulse')}
			/>
			<span className="text-xs text-muted-foreground">{label}</span>
		</div>
	)
}

export function Logo({ className }: { className?: string }) {
	return <img src="/assets/supa-agent-256.webp" alt="SupaAgent" className={cn('', className)} />
}

/**
 * Active border indicator — shown only while the agent is running.
 * Subtle emerald edge to indicate activity without decorative neon effects.
 */
export function NeonGlowOverlay({ active }: { active: boolean }) {
	if (!active) return null

	return (
		<div className="pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[inherit]">
			{/* Top edge */}
			<div className="absolute -top-px left-0 right-0 h-[2px] bg-emerald-500 animate-[neon-slide_3s_ease-in-out_infinite]" />
			{/* Bottom edge */}
			<div className="absolute -bottom-px left-0 right-0 h-[2px] bg-emerald-500 animate-[neon-slide_3s_ease-in-out_infinite_reverse]" />
			{/* Left edge */}
			<div className="absolute top-0 bottom-0 -left-px w-[2px] bg-emerald-500 animate-[neon-slide-v_3s_ease-in-out_infinite]" />
			{/* Right edge */}
			<div className="absolute top-0 bottom-0 -right-px w-[2px] bg-emerald-500 animate-[neon-slide-v_3s_ease-in-out_infinite_reverse]" />
		</div>
	)
}

// Keep MotionOverlay as an alias for backward compat
export const MotionOverlay = NeonGlowOverlay

// Empty state with logo
export function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
			<div className="relative select-none pointer-events-none">
				<div className="absolute inset-0 -m-6 rounded-full bg-emerald-500/10 blur-2xl" />
				<Logo className="relative size-20 opacity-90" />
			</div>
			<div>
				<h2 className="text-base font-medium text-foreground mb-1">SupaAgent</h2>
				<TypingAnimation
					className="text-sm text-muted-foreground"
					words={[
						'Enter a task to automate this page',
						'Execute multi-page tasks',
						'Call this extension from your web page',
						'Use this extension in your own agents',
					]}
					cursorStyle="underscore"
					loop
					startOnView={false}
					typeSpeed={20}
					deleteSpeed={10}
					pauseDelay={3000}
				/>
			</div>
			<div className="flex items-center gap-3 mt-1 text-muted-foreground">
				<a
					href="https://github.com/JesseVent/supa-agent"
					target="_blank"
					rel="noopener noreferrer"
					className="hover:text-foreground transition-colors"
					title="GitHub"
				>
					<svg role="img" viewBox="0 0 24 24" className="size-4 fill-current">
						<path d={siGithub.path} />
					</svg>
				</a>
				<a
					href="https://supabase.com/docs"
					target="_blank"
					rel="noopener noreferrer"
					className="hover:text-foreground transition-colors"
					title="Documentation"
				>
					<BookOpen className="size-4" />
				</a>
				<a
					href="https://supabase.com"
					target="_blank"
					rel="noopener noreferrer"
					className="hover:text-foreground transition-colors"
					title="Website"
				>
					<Globe className="size-4" />
				</a>
			</div>
		</div>
	)
}
