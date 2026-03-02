import { useGithub } from '@/lib/github/GithubContext'

export function GithubLoginButton() {
    const { login, logout, isAuthenticated, isLoadingAuth, user, deviceCodePrompt } = useGithub()

    if (isLoadingAuth) {
        return <button disabled className="px-4 py-2 bg-slate-200 text-slate-500 rounded-md">Loading...</button>
    }

    if (isAuthenticated && user) {
        return (
            <div className="flex items-center gap-3">
                <img src={user.avatar_url} alt={user.login} className="w-8 h-8 rounded-full" />
                <span className="text-sm font-medium">{user.login}</span>
                <button
                    onClick={logout}
                    className="px-3 py-1.5 text-xs text-red-600 border border-red-200 hover:bg-red-50 rounded"
                >
                    Logout
                </button>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-start gap-4">
            {deviceCodePrompt ? (
                <div className="p-4 bg-violet-50 border border-violet-200 rounded-md">
                    <p className="text-sm text-violet-800 mb-2">Please go to:</p>
                    <a
                        href={deviceCodePrompt.verificationUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-600 font-bold hover:underline mb-4 inline-block"
                    >
                        {deviceCodePrompt.verificationUri}
                    </a>
                    <p className="text-sm text-violet-800 mb-2">And enter code:</p>
                    <div className="text-2xl font-mono p-2 bg-white border border-violet-100 rounded text-center tracking-widest">
                        {deviceCodePrompt.userCode}
                    </div>
                    <p className="text-xs text-violet-600 mt-3 flex items-center gap-2">
                        <span className="animate-spin inline-block w-3 h-3 border-2 border-violet-600 border-t-transparent rounded-full" />
                        Waiting for authorization...
                    </p>
                </div>
            ) : (
                <button
                    onClick={() => login().catch(console.error)}
                    className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-md shadow flex items-center gap-2"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                    LOGIN
                </button>
            )}
        </div>
    )
}
