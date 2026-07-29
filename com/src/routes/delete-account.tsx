import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/AuthProvider'

export const Route = createFileRoute('/delete-account')({
  component: DeleteAccount,
})

/**
 * The URL Google Play's Data safety form calls the "account deletion" link.
 *
 * Play requires it to be reachable WITHOUT signing in and without installing the app,
 * which is why this is a top-level public route rather than a child of `/account` —
 * that one bounces a signed-out visitor to `/login`, and a reviewer would never see
 * the page.
 *
 * There is no self-service delete endpoint on the gateway yet, so this page states the
 * request path honestly rather than showing a button that does nothing. A signed-in
 * visitor gets their identifiers filled into the request for them, because the first
 * thing the reply would otherwise ask for is "which account?".
 */

const SUPPORT = 'support@lmthing.org'

function Item({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="text-sm text-muted-foreground">{children}</span>
    </li>
  )
}

function DeleteAccount() {
  const { user, loading } = useAuth()

  const subject = encodeURIComponent('Delete my lmthing account')
  const body = encodeURIComponent(
    [
      'Please delete my lmthing account and all data associated with it.',
      '',
      `Account email: ${user?.email ?? '(the email you sign in with)'}`,
      '',
      'I understand this cannot be undone.',
    ].join('\n'),
  )

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-3 text-3xl font-bold">Delete your account</h1>
      <p className="mb-12 text-sm leading-relaxed text-muted-foreground">
        You can ask us to delete your lmthing account at any time, for any reason, and
        we will not ask you to justify it. This page explains exactly what happens.
      </p>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">How to request deletion</h2>
        <div className="rounded-lg border border-border p-6">
          {loading ? null : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                {user
                  ? 'Send us the request below. It is already filled in with the account you are signed in as.'
                  : 'Send us the request below from the email address you sign in with, so we can confirm the account is yours.'}
              </p>
              <a
                href={`mailto:${SUPPORT}?subject=${subject}&body=${body}`}
                className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Request account deletion
              </a>
              <p className="mt-4 text-sm text-muted-foreground">
                Or write to{' '}
                <a href={`mailto:${SUPPORT}`} className="text-primary hover:underline">
                  {SUPPORT}
                </a>
                . We confirm every request within 7 days and complete the deletion
                within 30 days.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">What gets deleted</h2>
        <ul className="flex flex-col gap-4">
          <Item title="Your workspace, in full">
            Every conversation, project, agent, space, file and API key you stored in
            it. The container it lives in is destroyed along with its storage.
          </Item>
          <Item title="Your account">
            Your sign-in identity, your email address, and your profile record.
          </Item>
          <Item title="Your devices">
            Every push notification token registered to you.
          </Item>
          <Item title="Your team memberships">
            You are removed from every team you belong to. Messages you sent in a team
            channel belong to that team's workspace and stay there, attributed to a
            deleted user — we cannot delete another organisation's records on your
            behalf. Teams you own are transferred or closed; we will agree which with
            you before proceeding.
          </Item>
          <Item title="Your backup connection">
            The link to your GitHub backup repository. The repository itself is yours
            and stays in your GitHub account — delete it there if you want it gone.
          </Item>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">What we keep, and why</h2>
        <ul className="flex flex-col gap-4">
          <Item title="Invoices and payment records">
            Tax law requires us to keep these, and for how long. Stripe holds the
            payment records; you can ask Stripe to delete them once that period ends.
          </Item>
          <Item title="Aggregate usage totals">
            Token counts with no link back to you, kept for capacity planning. They
            cannot be used to identify you.
          </Item>
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Nothing else survives deletion. Backups that still contain your data are
          rotated out within 30 days.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Before you go</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Deletion cannot be undone, and we cannot restore a deleted workspace. If you
          want a copy of your work first, enable workspace backup to a GitHub repository
          and let it run once — that mirror is yours and survives deletion. See the{' '}
          <Link to="/privacy" className="text-primary hover:underline">
            privacy policy
          </Link>{' '}
          for what we hold and why.
        </p>
      </section>
    </div>
  )
}
