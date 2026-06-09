import { ArrowLeft, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { deleteSession, getSession, type SessionRecord } from '@/lib/db'

import { EventCard } from './cards'

export function HistoryDetail({
	sessionId,
	onBack,
	onRerun,
}: {
	sessionId: string
	onBack: () => void
	onRerun: (task: string) => void
}) {
	const [session, setSession] = useState<SessionRecord | null>(null)

	useEffect(() => {
		getSession(sessionId).then((s) => setSession(s ?? null))
	}, [sessionId])

	if (!session) {
		return (
			<div className="flex items-center justify-center h-screen text-xs text-muted-foreground">
				Loading...
			</div>
		)
	}

	return (
		<div className="flex flex-col h-screen bg-background">
			{/* Header */}
			<header className="flex items-center gap-2 border-b px-3 py-2">
				<Button variant="ghost" size="icon-sm" onClick={onBack} className="cursor-pointer">
					<ArrowLeft className="size-3.5" />
				</Button>
				<span className="text-sm font-medium truncate">History</span>
			</header>

			{/* Task */}
			<div className="border-b px-3 py-2 bg-muted/30">
				<div className="text-[10px] text-muted-foreground uppercase tracking-wide">
					Task
				</div>
				<div className="text-xs font-medium" title={session.task}>
					{session.task}
				</div>
				{session.configSnapshot && (
					<div className="mt-1.5 flex flex-wrap gap-1.5">
						{session.configSnapshot.projectRef && (
							<span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-mono">
								📦{' '}
								{session.configSnapshot.projectName ||
									session.configSnapshot.projectRef}
							</span>
						)}
						<span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
							🤖 {session.configSnapshot.model.split('/').pop()}
						</span>
						<span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">
							🔗 {new URL(session.configSnapshot.baseURL).hostname}
						</span>
					</div>
				)}
				<div className="mt-2 flex items-center gap-2">
					<button
						type="button"
						onClick={() => onRerun(session.task)}
						className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<RotateCcw className="size-3" />
						Run again
					</button>
					<button
						type="button"
						onClick={async () => {
							await deleteSession(sessionId)
							onBack()
						}}
						className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
					>
						<Trash2 className="size-3" />
						Delete
					</button>
				</div>
			</div>

			{/* Events (read-only) */}
			<div className="flex-1 overflow-y-auto p-3 space-y-2">
				{session.history.map((event, index) => (
					<EventCard key={index} event={event} />
				))}
			</div>
		</div>
	)
}
