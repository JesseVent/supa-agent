import type { AgentStatus } from '@supa-agent/core'
import {
	ArrowLeftRight,
	BookOpen,
	Database,
	Globe,
	PauseCircle,
	Play,
	Sparkles,
	Square,
	X,
} from 'lucide-react'
import { siGithub } from 'simple-icons'

import { Button } from '@/components/ui/button'
import { TypingAnimation } from '@/components/ui/typing-animation'
import { cn } from '@/lib/utils'

// Status dot indicator — kept for potential reuse elsewhere
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
				className={cn(
					'size-2 rounded-full',
					colorClass,
					status === 'running' && 'animate-pulse'
				)}
			/>
			<span className="text-xs text-muted-foreground">{label}</span>
		</div>
	)
}

/**
 * Header identity + status for the chat view.
 *
 * - Shows the connected Supabase project name (or "Disconnected")
 * - While running: shows a stop button instead of the status pill
 * - While idle: shows "Ready" (has API key) or "No Model" (missing key)
 */
export function HeaderStatus({
	status,
	projectName,
	hasModel,
	onStop,
	onHome,
}: {
	status: AgentStatus
	projectName?: string
	hasModel: boolean
	onStop: () => void
	onHome?: () => void
}) {
	const isRunning = status === 'running'

	return (
		<div className="flex items-center gap-2 min-w-0">
			{/* Project identity — click to return to home */}
			<button
				type="button"
				onClick={onHome}
				disabled={!onHome}
				className="text-sm font-medium truncate max-w-[160px] text-left cursor-pointer hover:text-muted-foreground transition-colors disabled:cursor-default disabled:hover:text-foreground"
				title={onHome ? `${projectName || 'Disconnected'} — go home` : projectName}
			>
				{projectName || 'Disconnected'}
			</button>

			{/* Status / stop */}
			{isRunning ? (
				<button
					type="button"
					onClick={onStop}
					className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 border border-destructive/40 rounded px-1.5 py-0.5 transition-colors cursor-pointer shrink-0"
					title="Stop task"
					aria-label="Stop task"
				>
					<Square className="size-2.5" />
					<span>Stop</span>
				</button>
			) : (
				<span
					className={cn(
						'flex items-center gap-1 text-xs rounded px-1.5 py-0.5 shrink-0',
						hasModel
							? 'text-emerald-600 dark:text-emerald-400'
							: 'text-muted-foreground'
					)}
				>
					<span
						className={cn(
							'size-1.5 rounded-full',
							hasModel ? 'bg-emerald-500' : 'bg-muted-foreground/50'
						)}
					/>
					{hasModel ? 'Ready' : 'No Model'}
				</span>
			)}
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

const EXAMPLE_PROMPTS = [
	{
		icon: Sparkles,
		label: 'List tables in my Supabase project',
		task: 'List all tables in my Supabase project using MCP',
	},
	{
		icon: Database,
		label: 'Check my project logs',
		task: 'Show me the latest logs from my Supabase project',
	},
	{
		icon: ArrowLeftRight,
		label: 'Harden my Data API',
		task:
			'1. Navigate to the Supabase dashboard for my connected project. ' +
			'2. Open the Integrations section. ' +
			'3. Select "Data API". ' +
			'4. Click the "Settings" tab inside Data API. ' +
			'5. Scroll down to the "Harden Data API" section. ' +
			'6. Click the button in that section. ' +
			'7. Expand the "Option 1" accordion. ' +
			'8. Copy the SQL shown inside that accordion. ' +
			'9. Navigate back to this chat and paste the SQL here.',
	},
	{
		icon: PauseCircle,
		label: 'Pause a project',
		task:
			'1. Navigate to https://supabase.com/dashboard for the current project. ' +
			'2. Click on the organisation selector (the up/down arrows) and select "JesseVents Org". ' +
			'3. Click on the "bragg-book" project, then click on "Project Settings". ' +
			'4. Scroll down until you see the "Pause project" button. ' +
			'5. Click the "Pause project" button.',
	},
]

interface EmptyStateProps {
	conversationTurnCount?: number
	onClearConversation?: () => void
	onExample?: (task: string) => void
}

export function EmptyState({
	conversationTurnCount = 0,
	onClearConversation,
	onExample,
}: EmptyStateProps) {
	const hasSession = conversationTurnCount > 0

	return (
		<div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
			{/* Logo */}
			<div className="relative select-none pointer-events-none">
				<div className="absolute inset-0 -m-6 rounded-full bg-emerald-500/10 blur-2xl" />
				<Logo className="relative size-20 opacity-90" />
			</div>

			{/* Title + typing */}
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

			{/* Session continuation banner */}
			{hasSession && (
				<div className="w-full max-w-xs rounded-lg border border-dashed border-emerald-500/30 bg-emerald-500/5 px-3 py-2 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 text-left">
						<Play className="size-3 text-emerald-400 shrink-0" />
						<span className="text-xs text-emerald-300">
							Session active · {conversationTurnCount} prior{' '}
							{conversationTurnCount === 1 ? 'task' : 'tasks'}
						</span>
					</div>
					{onClearConversation && (
						<button
							type="button"
							onClick={onClearConversation}
							className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
							title="Clear session"
							aria-label="Clear session"
						>
							<X className="size-3" />
						</button>
					)}
				</div>
			)}

			{/* Example prompts */}
			{onExample && (
				<div className="w-full max-w-xs flex flex-col gap-1.5 mt-1">
					<span className="text-[10px] text-muted-foreground uppercase tracking-wide text-left">
						Try an example
					</span>
					<div className="flex flex-wrap gap-1.5">
						{EXAMPLE_PROMPTS.map((ex) => (
							<Button
								key={ex.label}
								variant="outline"
								size="sm"
								className="h-auto py-1 px-2 text-[10px] leading-tight text-left gap-1 cursor-pointer"
								onClick={() => onExample(ex.task)}
							>
								<ex.icon className="size-2.5 shrink-0 text-muted-foreground" />
								{ex.label}
							</Button>
						))}
					</div>
				</div>
			)}

			{/* Footer links */}
			<div className="flex items-center gap-3 mt-1 text-muted-foreground">
				<a
					href="https://github.com/JesseVent/supa-agent"
					target="_blank"
					rel="noopener noreferrer"
					className="hover:text-foreground transition-colors"
					title="GitHub"
				>
					<svg
						role="img"
						aria-label="GitHub"
						viewBox="0 0 24 24"
						className="size-4 fill-current"
					>
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
