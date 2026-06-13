import type { TraceTransport } from '@supa-agent/bridge-events'
import {
	Copy,
	CornerUpLeft,
	Database,
	ExternalLink,
	Eye,
	EyeOff,
	FileText,
	FoldVertical,
	HatGlasses,
	Home,
	Loader2,
	Plug,
	UnfoldVertical,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { siGithub } from 'simple-icons'
import { toast } from 'sonner'

import { DEMO_BASE_URL, DEMO_MODEL } from '@/agent/constants'
import type { ExtConfig, LanguagePreference } from '@/agent/useAgent'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import { useSupabaseConnect } from '@/hooks/useSupabaseConnect'
import { cn } from '@/lib/utils'

interface ConfigPanelProps {
	config: ExtConfig | null
	mcpStatus?: 'idle' | 'loading' | 'connected' | 'error'
	mcpError?: string | null
	onSave: (config: ExtConfig) => Promise<void>
	onClose: () => void
}

export function ConfigPanel({ config, mcpStatus, mcpError, onSave, onClose }: ConfigPanelProps) {
	const [baseURL, setBaseURL] = useState(config?.baseURL || DEMO_BASE_URL)
	const [model, setModel] = useState(config?.model || DEMO_MODEL)
	const [apiKey, setApiKey] = useState(config?.apiKey)
	const [language, setLanguage] = useState<LanguagePreference>(config?.language)
	const [maxSteps, setMaxSteps] = useState(config?.maxSteps)
	const [systemInstruction, setSystemInstruction] = useState(config?.systemInstruction ?? '')
	const [experimentalLlmsTxt, setExperimentalLlmsTxt] = useState(
		config?.experimentalLlmsTxt ?? false
	)
	const [experimentalIncludeAllTabs, setExperimentalIncludeAllTabs] = useState(
		config?.experimentalIncludeAllTabs ?? false
	)
	const [disableNamedToolChoice, setDisableNamedToolChoice] = useState(
		config?.disableNamedToolChoice ?? false
	)
	const [skillRouterUrl, setSkillRouterUrl] = useState(config?.skillRouterUrl ?? '')
	const [skillRouterKey, setSkillRouterKey] = useState(config?.skillRouterKey ?? '')
	const [skillRouterSkill, setSkillRouterSkill] = useState(config?.skillRouterSkill ?? '')
	const [supabaseMcpProjectRef, setSupabaseMcpProjectRef] = useState(
		config?.supabaseMcpProjectRef ?? ''
	)
	const [supabaseMcpProjectName, setSupabaseMcpProjectName] = useState(
		config?.supabaseMcpProjectName ?? ''
	)
	const [supabaseMcpAccessToken, setSupabaseMcpAccessToken] = useState(
		config?.supabaseMcpAccessToken ?? ''
	)
	const [allowMcpWrites, setAllowMcpWrites] = useState(config?.allowMcpWrites ?? false)
	const [allowedDomains, setAllowedDomains] = useState(config?.allowedDomains?.join(', ') ?? '')
	const [traceTransport, setTraceTransport] = useState<TraceTransport>(
		config?.traceTransport ?? 'postMessage'
	)
	const [traceSupabaseUrl, setTraceSupabaseUrl] = useState(config?.traceSupabaseUrl ?? '')
	const [traceSupabaseAnonKey, setTraceSupabaseAnonKey] = useState(
		config?.traceSupabaseAnonKey ?? ''
	)
	const [showSupabaseToken, setShowSupabaseToken] = useState(false)
	const [advancedOpen, setAdvancedOpen] = useState(false)
	const [saving, setSaving] = useState(false)
	const [userAuthToken, setUserAuthToken] = useState('')
	const [copied, setCopied] = useState(false)
	const [showToken, setShowToken] = useState(false)
	const [showApiKey, setShowApiKey] = useState(false)
	const [theme, setTheme] = useState(config?.theme ?? 'system')
	const [preserveMemory, setPreserveMemory] = useState(config?.preserveMemory ?? false)

	const [prevConfig, setPrevConfig] = useState(config)
	if (prevConfig !== config) {
		setPrevConfig(config)
		setBaseURL(config?.baseURL || DEMO_BASE_URL)
		setModel(config?.model || DEMO_MODEL)
		setApiKey(config?.apiKey)
		setLanguage(config?.language)
		setMaxSteps(config?.maxSteps)
		setSystemInstruction(config?.systemInstruction ?? '')
		setExperimentalLlmsTxt(config?.experimentalLlmsTxt ?? false)
		setExperimentalIncludeAllTabs(config?.experimentalIncludeAllTabs ?? false)
		setDisableNamedToolChoice(config?.disableNamedToolChoice ?? false)
		setSkillRouterUrl(config?.skillRouterUrl ?? '')
		setSkillRouterKey(config?.skillRouterKey ?? '')
		setSkillRouterSkill(config?.skillRouterSkill ?? '')
		setSupabaseMcpProjectRef(config?.supabaseMcpProjectRef ?? '')
		setSupabaseMcpProjectName(config?.supabaseMcpProjectName ?? '')
		setSupabaseMcpAccessToken(config?.supabaseMcpAccessToken ?? '')
		setAllowMcpWrites(config?.allowMcpWrites ?? false)
		setAllowedDomains(config?.allowedDomains?.join(', ') ?? '')
		setTraceTransport(config?.traceTransport ?? 'postMessage')
		setTraceSupabaseUrl(config?.traceSupabaseUrl ?? '')
		setTraceSupabaseAnonKey(config?.traceSupabaseAnonKey ?? '')
		setTheme(config?.theme ?? 'system')
		setPreserveMemory(config?.preserveMemory ?? false)
	}

	// Poll for user auth token every second until found
	useEffect(() => {
		let interval: NodeJS.Timeout | null = null

		const fetchToken = async () => {
			const result = await chrome.storage.local.get('SupaAgentExtUserAuthToken')
			const token = result.SupaAgentExtUserAuthToken
			if (typeof token === 'string' && token) {
				setUserAuthToken(token)
				if (interval) {
					clearInterval(interval)
					interval = null
				}
			}
		}

		fetchToken()
		interval = setInterval(fetchToken, 1000)

		return () => {
			if (interval) clearInterval(interval)
		}
	}, [])

	const handleCopyToken = async () => {
		if (userAuthToken) {
			await navigator.clipboard.writeText(userAuthToken)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		}
	}

	const handleSave = async () => {
		setSaving(true)
		try {
			await onSave({
				apiKey,
				baseURL,
				model,
				language,
				maxSteps: maxSteps || undefined,
				systemInstruction: systemInstruction || undefined,
				experimentalLlmsTxt,
				experimentalIncludeAllTabs,
				disableNamedToolChoice,
				skillRouterUrl: skillRouterUrl || undefined,
				skillRouterKey: skillRouterKey || undefined,
				skillRouterSkill: skillRouterSkill || undefined,
				supabaseMcpProjectRef: supabaseMcpProjectRef || undefined,
				supabaseMcpProjectName: supabaseMcpProjectName || undefined,
				supabaseMcpAccessToken: supabaseMcpAccessToken || undefined,
				allowMcpWrites,
				allowedDomains: allowedDomains
					? allowedDomains
							.split(',')
							.map((d) => d.trim())
							.filter((d) => d.length > 0)
					: undefined,
				traceTransport,
				traceSupabaseUrl: traceSupabaseUrl || undefined,
				traceSupabaseAnonKey: traceSupabaseAnonKey || undefined,
				theme,
				preserveMemory,
			})
		} finally {
			setSaving(false)
		}
	}

	return (
		<div className="flex flex-col gap-4 p-4 relative">
			<div className="flex items-center justify-between">
				<h2 className="text-base font-semibold">Settings</h2>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					className="absolute top-2 right-3 cursor-pointer"
					aria-label="Back"
				>
					<CornerUpLeft className="size-3.5" />
				</Button>
			</div>

			{/* User Auth Token Section */}
			<div className="flex flex-col gap-1.5 p-3 bg-muted/50 rounded-md border">
				<label
					htmlFor="user-auth-token"
					className="text-xs font-medium text-muted-foreground"
				>
					User Auth Token
				</label>
				<p className="text-[10px] text-muted-foreground mb-1">
					Give a website the ability to call this extension.
				</p>
				<div className="flex gap-2 items-center">
					<Input
						id="user-auth-token"
						readOnly
						value={
							userAuthToken
								? showToken
									? userAuthToken
									: `${userAuthToken.slice(0, 4)}${'•'.repeat(userAuthToken.length - 8)}${userAuthToken.slice(-4)}`
								: 'Loading...'
						}
						className="text-xs h-8 font-mono bg-background"
					/>
					<Button
						variant="outline"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer"
						onClick={() => setShowToken(!showToken)}
						disabled={!userAuthToken}
						aria-label={showToken ? 'Hide token' : 'Show token'}
						aria-pressed={showToken}
					>
						{showToken ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer"
						onClick={handleCopyToken}
						disabled={!userAuthToken}
						aria-label="Copy token"
					>
						{copied ? <span className="">✓</span> : <Copy className="size-3" />}
					</Button>
					<span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
						{copied ? 'Token copied' : ''}
					</span>
				</div>
			</div>

			{/* Hub link */}
			<a
				href="/hub.html"
				target="_blank"
				rel="noopener noreferrer"
				className="flex items-center justify-between p-3 rounded-md border bg-muted/50 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
			>
				Manage SupaAgent Hub
				<ExternalLink className="size-3" />
			</a>

			{/* Connect with Supabase */}
			{supabaseMcpProjectRef ? (
				<div
					className={cn(
						'flex flex-col gap-2 p-3 rounded-md border',
						mcpStatus === 'error'
							? 'bg-destructive/10 border-destructive/30'
							: mcpStatus === 'loading'
								? 'bg-amber-500/10 border-amber-500/30'
								: 'bg-emerald-500/10 border-emerald-500/30'
					)}
				>
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Database
								className={cn(
									'size-4',
									mcpStatus === 'error'
										? 'text-destructive'
										: mcpStatus === 'loading'
											? 'text-amber-400'
											: 'text-emerald-400'
								)}
							/>
							<div>
								<div
									className={cn(
										'text-sm font-medium',
										mcpStatus === 'error'
											? 'text-destructive'
											: mcpStatus === 'loading'
												? 'text-amber-300'
												: 'text-emerald-300'
									)}
								>
									{supabaseMcpProjectName || supabaseMcpProjectRef}
								</div>
								<div className="text-[10px] text-emerald-400/70 font-mono">
									{supabaseMcpProjectRef}
								</div>
							</div>
						</div>
						<span
							className={cn(
								'text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0',
								mcpStatus === 'error'
									? 'bg-destructive/20 text-destructive'
									: mcpStatus === 'loading'
										? 'bg-amber-500/20 text-amber-300'
										: 'bg-emerald-500/20 text-emerald-300'
							)}
						>
							{mcpStatus === 'error'
								? 'Tools Error'
								: mcpStatus === 'loading'
									? 'Loading…'
									: 'Connected'}
						</span>
					</div>
					{mcpStatus === 'error' && mcpError && (
						<div className="text-[10px] text-destructive/80 leading-relaxed">
							{mcpError}
						</div>
					)}
					<div className="flex gap-2">
						<SupabaseConnectDialog
							onApplyProject={({ ref, name, anonKey }) => {
								setSupabaseMcpProjectRef(ref)
								setSupabaseMcpProjectName(name)
								setTraceSupabaseUrl(`https://${ref}.supabase.co`)
								if (anonKey) setTraceSupabaseAnonKey(anonKey)
								toast.success('Project linked', { description: name })
							}}
							triggerLabel="Change project"
							triggerVariant="outline"
						/>
						<Button
							variant="ghost"
							size="sm"
							className="text-xs text-muted-foreground hover:text-destructive"
							onClick={() => {
								setSupabaseMcpProjectRef('')
								setSupabaseMcpProjectName('')
								setSupabaseMcpAccessToken('')
								setAllowMcpWrites(false)
								setTraceSupabaseUrl('')
								setTraceSupabaseAnonKey('')
								setTraceTransport('postMessage')
								toast.info('Project unlinked')
							}}
						>
							Disconnect
						</Button>
					</div>
				</div>
			) : (
				<SupabaseConnectDialog
					onApplyProject={({ ref, name, anonKey }) => {
						setSupabaseMcpProjectRef(ref)
						setSupabaseMcpProjectName(name)
						setTraceSupabaseUrl(`https://${ref}.supabase.co`)
						if (anonKey) setTraceSupabaseAnonKey(anonKey)
						toast.success('Project linked', { description: name })
					}}
				/>
			)}

			<div className="flex flex-col gap-1.5">
				<label htmlFor="base-url" className="text-xs text-muted-foreground">
					Base URL
				</label>
				<Input
					id="base-url"
					placeholder="https://openrouter.ai/api/v1"
					value={baseURL}
					onChange={(e) => setBaseURL(e.target.value)}
					className="text-xs h-8"
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="model" className="text-xs text-muted-foreground">
					Model
				</label>
				<Input
					id="model"
					placeholder="google/gemini-3.1-flash-lite"
					value={model}
					onChange={(e) => setModel(e.target.value)}
					className="text-xs h-8"
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<label htmlFor="api-key" className="text-xs text-muted-foreground">
					API Key
				</label>
				<div className="flex gap-2 items-center">
					<Input
						id="api-key"
						type={showApiKey ? 'text' : 'password'}
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						className="text-xs h-8"
					/>
					<Button
						variant="outline"
						size="icon"
						className="h-8 w-8 shrink-0 cursor-pointer"
						onClick={() => setShowApiKey(!showApiKey)}
						aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
					>
						{showApiKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
					</Button>
				</div>
			</div>

			<div className="flex flex-col gap-1.5">
				<label className="text-xs text-muted-foreground">Response Language</label>
				<select
					value={language ?? ''}
					onChange={(e) =>
						setLanguage((e.target.value || undefined) as LanguagePreference)
					}
					className="h-8 text-xs rounded-md border border-input bg-background px-2 cursor-pointer"
				>
					<option value="">System</option>
					<option value="en-US">English</option>
				</select>
			</div>
			<div className="flex flex-col gap-1.5">
				<label className="text-xs text-muted-foreground">Theme</label>
				<select
					value={theme}
					onChange={(e) => setTheme(e.target.value as 'system' | 'light' | 'dark')}
					className="h-8 text-xs rounded-md border border-input bg-background px-2 cursor-pointer"
				>
					<option value="system">System</option>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
			</div>

			{/* Advanced Config */}
			<button
				type="button"
				onClick={() => setAdvancedOpen(!advancedOpen)}
				className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer mt-1 font-bold"
			>
				Advanced
				{advancedOpen ? (
					<FoldVertical className="size-3" />
				) : (
					<UnfoldVertical className="size-3" />
				)}
			</button>

			{advancedOpen && (
				<>
					<div className="flex flex-col gap-1.5">
						<label htmlFor="max-steps" className="text-xs text-muted-foreground">
							Max Steps
						</label>
						<Input
							id="max-steps"
							type="number"
							placeholder="40"
							min={1}
							max={200}
							value={maxSteps ?? ''}
							onChange={(e) =>
								setMaxSteps(e.target.value ? Number(e.target.value) : undefined)
							}
							className="text-xs h-8 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label className="text-xs text-muted-foreground">System Instruction</label>
						<textarea
							placeholder="Additional instructions for the agent..."
							value={systemInstruction}
							onChange={(e) => setSystemInstruction(e.target.value)}
							rows={3}
							className="text-xs rounded-md border border-input bg-background px-3 py-2 resize-y min-h-[60px]"
						/>
					</div>

					<label className="flex items-center justify-between cursor-pointer">
						<span className="text-xs text-muted-foreground">
							Preserve memory across settings changes
						</span>
						<Switch checked={preserveMemory} onCheckedChange={setPreserveMemory} />
					</label>

					<label className="flex items-center justify-between cursor-pointer">
						<span className="text-xs text-muted-foreground">
							Disable named tool_choice
						</span>
						<Switch
							checked={disableNamedToolChoice}
							onCheckedChange={setDisableNamedToolChoice}
						/>
					</label>

					<label className="flex items-center justify-between cursor-pointer">
						<span className="text-xs text-muted-foreground">
							Experimental llms.txt support
						</span>
						<Switch
							checked={experimentalLlmsTxt}
							onCheckedChange={setExperimentalLlmsTxt}
						/>
					</label>

					<div className="flex flex-col gap-1.5">
						<label className="flex items-center justify-between cursor-pointer">
							<span className="text-xs text-muted-foreground">
								Experimental include all tabs
							</span>
							<Switch
								checked={experimentalIncludeAllTabs}
								onCheckedChange={setExperimentalIncludeAllTabs}
							/>
						</label>
						{experimentalIncludeAllTabs && (
							<p className="text-[10px] text-amber-500 leading-relaxed">
								⚠️ This lets the agent control all unpinned tabs. Use with caution.
							</p>
						)}
					</div>

					<div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
						<label
							htmlFor="allowed-domains"
							className="text-xs font-medium text-muted-foreground"
						>
							Allowed Domains
						</label>
						<p className="text-[10px] text-muted-foreground">
							Comma-separated list (e.g. supabase.com, github.com). Leave empty to
							allow all.
						</p>
						<Input
							id="allowed-domains"
							placeholder="supabase.com, github.com, vercel.com"
							value={allowedDomains}
							onChange={(e) => setAllowedDomains(e.target.value)}
							className="text-xs h-8"
						/>
					</div>

					<div className="flex flex-col gap-2 pt-2 border-t border-border/50">
						<span className="text-xs font-medium text-muted-foreground">
							Skill Router
						</span>
						<Input
							placeholder="https://<project>.supabase.co"
							value={skillRouterUrl}
							onChange={(e) => setSkillRouterUrl(e.target.value)}
							className="text-xs h-8"
						/>
						<Input
							type="password"
							placeholder="Anon key"
							value={skillRouterKey}
							onChange={(e) => setSkillRouterKey(e.target.value)}
							className="text-xs h-8"
						/>
						<Input
							placeholder="Skill name (e.g. supabase-postgres-best-practices)"
							value={skillRouterSkill}
							onChange={(e) => setSkillRouterSkill(e.target.value)}
							className="text-xs h-8"
						/>
					</div>

					<div className="flex flex-col gap-2 pt-2 border-t border-border/50">
						<span className="text-xs font-medium text-muted-foreground">
							Supabase MCP
						</span>
						<p className="text-[10px] text-muted-foreground">
							Lets the agent query your Supabase project from any page.
						</p>
						<Input
							placeholder="Project ref (e.g. abcdefghijklmnop)"
							value={supabaseMcpProjectRef}
							onChange={(e) => setSupabaseMcpProjectRef(e.target.value)}
							className="text-xs h-8 font-mono"
						/>
						<div className="flex gap-2 items-center">
							<Input
								type={showSupabaseToken ? 'text' : 'password'}
								placeholder="Personal access token (sbp_...)"
								value={supabaseMcpAccessToken}
								onChange={(e) => setSupabaseMcpAccessToken(e.target.value)}
								className="text-xs h-8"
							/>
							<Button
								variant="outline"
								size="icon"
								className="h-8 w-8 shrink-0 cursor-pointer"
								onClick={() => setShowSupabaseToken(!showSupabaseToken)}
								aria-label={showSupabaseToken ? 'Hide token' : 'Show token'}
							>
								{showSupabaseToken ? (
									<EyeOff className="size-3" />
								) : (
									<Eye className="size-3" />
								)}
							</Button>
						</div>

						<div className="flex flex-col gap-1.5">
							<label className="flex items-center justify-between cursor-pointer">
								<span className="text-xs text-muted-foreground">
									Allow MCP writes
								</span>
								<Switch
									checked={allowMcpWrites}
									onCheckedChange={setAllowMcpWrites}
								/>
							</label>
							<p className="text-[10px] text-amber-500 leading-relaxed">
								{allowMcpWrites
									? '⚠️ The agent can run write operations. Destructive ops (DROP/DELETE/migrations) still require explicit confirmation.'
									: 'Read-only: write and destructive MCP tools are blocked. Enable only if you need the agent to modify your project.'}
							</p>
						</div>
					</div>

					<div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
						<label
							htmlFor="trace-transport"
							className="text-xs font-medium text-muted-foreground"
						>
							Live Trace Transport
						</label>
						<p className="text-[10px] text-muted-foreground">
							Where agent trace events stream: the page in the current tab
							(postMessage), Supabase Realtime (any tab or device), or both.
						</p>
						<select
							id="trace-transport"
							value={traceTransport}
							onChange={(e) => setTraceTransport(e.target.value as TraceTransport)}
							className="h-8 text-xs rounded-md border border-input bg-background px-2 cursor-pointer"
						>
							<option value="postMessage">Current tab only (postMessage)</option>
							<option value="realtime">Supabase Realtime</option>
							<option value="both">Both</option>
						</select>
						{traceTransport !== 'postMessage' && !traceSupabaseAnonKey && (
							<p className="text-[10px] text-amber-500 leading-relaxed">
								⚠️ Realtime needs a connected project with a publishable key — use
								"Connect with Supabase" above, plus the supa_agent_trace extension
								and agent-trace-token function installed on that project.
							</p>
						)}
					</div>
				</>
			)}

			<div className="flex gap-2 mt-2">
				<Button
					variant="outline"
					onClick={onClose}
					className="flex-1 h-8 text-xs cursor-pointer"
				>
					Cancel
				</Button>
				<Button
					onClick={handleSave}
					disabled={saving}
					className="flex-1 h-8 text-xs cursor-pointer rounded-md bg-emerald-500 text-white hover:bg-emerald-600"
				>
					{saving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
				</Button>
			</div>

			{/* Footer */}
			<div className="mt-4 mb-4 pt-4 border-t border-border/50 flex gap-2 justify-between text-[10px] text-muted-foreground">
				<div className="flex flex-col justify-between">
					<span>
						Version <span className="font-mono">v{__VERSION__}</span>
					</span>

					<a
						href="https://github.com/JesseVent/supa-agent"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground"
					>
						<svg
							role="img"
							aria-label="GitHub"
							viewBox="0 0 24 24"
							className="size-3 fill-current"
						>
							<path d={siGithub.path} />
						</svg>
						<span>Source Code</span>
					</a>
				</div>

				<div className="flex flex-col items-end">
					<a
						href="https://supabase.com"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground"
					>
						<Home className="size-3" />
						<span>Supabase</span>
					</a>

					<a
						href="https://github.com/JesseVent/supa-agent/blob/main/docs/terms-and-privacy.md"
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 hover:text-foreground"
					>
						<HatGlasses className="size-3" />
						<span>Privacy</span>
					</a>
				</div>
			</div>

			{/* attribute */}
			<div className="text-[10px] text-muted-foreground bg-background fixed bottom-0 w-full flex justify-around">
				<span className="leading-loose">
					Powered by <span className="text-[#3ECF8E] font-medium">Supabase</span>
				</span>
			</div>
		</div>
	)
}

interface SupabaseConnectDialogProps {
	onApplyProject: (project: { ref: string; name: string; anonKey: string }) => void
	triggerLabel?: string
	triggerVariant?: 'default' | 'outline'
}

function SupabaseConnectDialog({
	onApplyProject,
	triggerLabel = 'Connect with Supabase',
	triggerVariant = 'default',
}: SupabaseConnectDialogProps) {
	const { mgmtConnected, disconnectManagement } = useAuth()
	const [open, setOpen] = useState(false)
	const [name, setName] = useState('')
	const [url, setUrl] = useState('')
	const [publishableKey, setPublishableKey] = useState('')
	const [secretKey, setSecretKey] = useState('')
	const [accessToken, setAccessToken] = useState('')
	const [isCreating, setIsCreating] = useState(false)

	const {
		isOAuthConnecting,
		oauthProjects,
		setOauthProjects,
		createError,
		setCreateError,
		connectWithOAuth,
		applyOAuthProject,
		prefillFromEnv,
		reset,
	} = useSupabaseConnect({
		onApplyProject: (project) => {
			onApplyProject(project)
			setOpen(false)
			reset()
		},
	})

	const handleOpenChange = (next: boolean) => {
		setOpen(next)
		if (!next) reset()
	}

	const handleManualConnect = async () => {
		setIsCreating(true)
		setCreateError(null)
		try {
			if (!name.trim() || !url.trim()) {
				throw new Error('Name and Supabase URL are required')
			}
			const ref = /https:\/\/([^.]+)\.supabase\.co/.exec(url)?.[1]
			if (ref) onApplyProject({ ref, name, anonKey: publishableKey })
			setOpen(false)
			reset()
		} catch (err) {
			setCreateError(err instanceof Error ? err.message : 'Failed to create connection')
		} finally {
			setIsCreating(false)
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				<button
					type="button"
					className={
						triggerVariant === 'outline'
							? 'flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-background text-xs font-medium text-foreground hover:bg-muted/50 hover:border-primary/40 transition-colors cursor-pointer'
							: 'flex items-center justify-between p-3 rounded-md border bg-emerald-500/10 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:border-emerald-500/40 transition-colors cursor-pointer'
					}
				>
					<span className="flex items-center gap-2">
						<svg
							role="img"
							aria-label="Supabase"
							viewBox="0 0 24 24"
							className="size-4 fill-current"
						>
							<path d="M19.944 9.052c-1.59-3.17-4.9-5.252-8.595-5.52L5.263 24h8.986c.4-.035.783-.127 1.147-.274.92-.369 1.674-1.048 2.11-1.91l3.84-7.764a.404.404 0 0 0-.402-.578h-3.84c-.264 0-.4.173-.347.435.147.73.163 1.49.04 2.24-.04.256.16.49.435.49h1.47l-2.47 5.01c-.22.455-.56.836-.98 1.1-.17.11-.354.19-.55.245a2.02 2.02 0 0 1-.52.065H8.64l5.3-10.71a.404.404 0 0 0-.402-.578h-3.84c-.264 0-.4.173-.347.435.147.73.163 1.49.04 2.24-.04.256.16.49.435.49h1.47L7.57 22.15c-.16.32-.48.512-.824.512H4.57l6.37-12.87c.16-.32.48-.512.824-.512h3.16l.39-.78a8.63 8.63 0 0 1 1.26-1.916l.14-.174a.2.2 0 0 1 .21-.072c.08.024.14.087.16.168.04.16.05.32.03.48zM15.66 5.22a9.53 9.53 0 0 0-2.79-.41c-2.64 0-5.05 1.04-6.83 2.74L.59 15.06c-.16.32-.09.71.17.96.26.25.66.28.96.09l5.59-3.61c.11-.07.24-.11.37-.11h2.5c.22 0 .4.18.4.4v2.5c0 .13-.04.26-.11.37l-3.61 5.59c-.19.3-.16.7.09.96.25.26.64.33.96.17l7.51-5.45a9.53 9.53 0 0 0 1.63-14.45z" />
						</svg>
						{triggerLabel}
						{triggerVariant === 'default' && mgmtConnected && (
							<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
								Connected
							</span>
						)}
					</span>
					{triggerVariant === 'default' && <ExternalLink className="size-3" />}
				</button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<div className="flex items-center justify-between">
						<DialogTitle>Connect to Supabase</DialogTitle>
						<Button
							variant="outline"
							size="sm"
							onClick={prefillFromEnv}
							className="gap-1.5 text-xs h-7"
						>
							<FileText className="size-3" />
							Prefill from .env
						</Button>
					</div>
					<DialogDescription>
						Sign in to your Supabase account to autofill project credentials
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-4 py-2">
					{createError && (
						<div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive">
							{createError}
						</div>
					)}

					{oauthProjects ? (
						<div className="flex flex-col gap-2">
							<p className="text-xs text-muted-foreground">
								Select a project to connect:
							</p>
							{oauthProjects.map((p) => (
								<Button
									key={p.ref}
									variant="outline"
									className="justify-start gap-2 h-auto py-2.5"
									disabled={isOAuthConnecting}
									onClick={async () => {
										const stored =
											await chrome.storage.local.get('SupaAgentMgmtToken')
										const token = stored.SupaAgentMgmtToken as
											| string
											| undefined
										if (token) await applyOAuthProject(p, token)
									}}
								>
									{isOAuthConnecting ? (
										<Loader2 className="size-3.5 shrink-0 animate-spin" />
									) : (
										<Database className="size-3.5 shrink-0" />
									)}
									<div className="text-left">
										<div className="text-sm font-medium">{p.name}</div>
										<div className="text-xs text-muted-foreground">
											{p.ref} · {p.region}
										</div>
									</div>
								</Button>
							))}
							<Button
								variant="ghost"
								size="sm"
								className="mt-1"
								onClick={() => {
									setOauthProjects(null)
								}}
							>
								← Back
							</Button>
						</div>
					) : (
						<>
							{/* Primary: OAuth */}
							<button
								type="button"
								onClick={connectWithOAuth}
								disabled={isOAuthConnecting}
								className="flex items-center justify-center w-full disabled:opacity-50 disabled:cursor-not-allowed"
								aria-label="Connect with Supabase"
							>
								{isOAuthConnecting ? (
									<div className="flex items-center gap-2 h-10 px-4 rounded-md border border-border text-sm text-muted-foreground">
										<Loader2 className="size-4 animate-spin" />
										Connecting…
									</div>
								) : (
									<>
										<img
											src="/connect-supabase-dark.svg"
											alt="Connect with Supabase"
											className="h-10 hidden dark:block"
										/>
										<img
											src="/connect-supabase-light.svg"
											alt="Connect with Supabase"
											className="h-10 block dark:hidden"
										/>
									</>
								)}
							</button>

							{/* Disconnect when connected (re-sign-in path) */}
							{mgmtConnected && (
								<Button
									variant="ghost"
									size="sm"
									onClick={disconnectManagement}
									className="text-xs text-muted-foreground"
								>
									Disconnect current account
								</Button>
							)}

							<div className="flex items-center gap-3">
								<div className="flex-1 h-px bg-border" />
								<span className="text-xs text-muted-foreground">
									or enter manually
								</span>
								<div className="flex-1 h-px bg-border" />
							</div>

							{/* Manual fallback */}
							<div className="flex flex-col gap-1.5">
								<Label>Connection Name</Label>
								<Input
									value={name}
									onChange={(e) => setName(e.target.value)}
									placeholder="My Project"
									className="text-xs h-8"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Supabase URL</Label>
								<Input
									value={url}
									onChange={(e) => setUrl(e.target.value)}
									placeholder="https://yourproject.supabase.co"
									className="text-xs h-8"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<Label>Publishable Key</Label>
								<Input
									type="password"
									value={publishableKey}
									onChange={(e) => setPublishableKey(e.target.value)}
									placeholder="sb_publishable_..."
									className="text-xs h-8"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<div className="flex items-center gap-2">
									<Label>Secret Key</Label>
									<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
										Local only
									</span>
								</div>
								<Input
									type="password"
									value={secretKey}
									onChange={(e) => setSecretKey(e.target.value)}
									placeholder="Bypasses RLS — use with caution"
									className="text-xs h-8"
								/>
							</div>
							<div className="flex flex-col gap-1.5">
								<div className="flex items-center gap-2">
									<Label>Management API Token</Label>
									<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
										Local only
									</span>
								</div>
								<Input
									type="password"
									value={accessToken}
									onChange={(e) => setAccessToken(e.target.value)}
									placeholder="sbp_..."
									className="text-xs h-8"
								/>
							</div>
							<Button
								onClick={handleManualConnect}
								disabled={isCreating}
								className="w-full"
							>
								{isCreating ? (
									<Loader2 className="mr-2 size-4 animate-spin" />
								) : (
									<Plug className="mr-2 size-4" />
								)}
								Connect
							</Button>
						</>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}
