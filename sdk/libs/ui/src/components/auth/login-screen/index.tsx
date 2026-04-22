'use client'

import { useAuth } from '@/lib/auth'

import '@lmthing/css/components/auth/index.css'
import '@lmthing/css/elements/forms/button/index.css'
import { CozyThingText } from '@lmthing/ui/elements/branding/cozy-text'

export function LoginScreen() {
  const { login } = useAuth()

  return (
    <div className="login-screen">
      <div className="login-screen__container">
        <div className="login-screen__branding">
          <h1 className="login-screen__title">
            <CozyThingText text="lmthing" />
          </h1>
          <p className="login-screen__subtitle">
            Sign in to continue
          </p>
        </div>

        <button
          type="button"
          className="btn btn--primary login-screen__submit"
          onClick={() => login()}
        >
          Sign in
        </button>
      </div>
    </div>
  )
}
