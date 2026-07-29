import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/privacy')({
  component: Privacy,
})

/**
 * The privacy policy, and the URL the Google Play listing points at.
 *
 * Every claim here is written from what the system actually stores, not from a
 * template: the `profiles` / `push_subscriptions` / `backup_config` / `team_*` tables
 * (`cloud/migrations/`), the per-user pod that holds the workspace itself, and the
 * providers a turn reaches (LiteLLM upstreams, the search providers, Stripe, GitHub).
 * If any of those change, this page is part of the change.
 *
 * It is deliberately a public route with no auth gate — Play requires the policy to
 * be reachable by a reviewer who is not signed in.
 */

const UPDATED = '29 July 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  )
}

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-2 text-3xl font-bold">Privacy policy</h1>
      <p className="mb-12 text-sm text-muted-foreground">Last updated {UPDATED}</p>

      <Section title="What this covers">
        <p>
          This policy covers lmthing — the website at lmthing.com, the surfaces at
          lmthing.chat, lmthing.team and the other lmthing.* domains, and the LMThing
          mobile app for Android and iOS. They are one product and one account.
        </p>
      </Section>

      <Section title="What we collect">
        <p>
          <strong className="text-foreground">Your identity.</strong> You sign in with
          GitHub. We store the user id our identity provider issues you and the email
          address attached to it. We never see or store your GitHub password.
        </p>
        <p>
          <strong className="text-foreground">Your workspace.</strong> Everything you
          create in the product — conversations, projects, agents, files, installed
          spaces and any API keys you enter — is stored in a private container that
          belongs to your account and is not shared with other users.
        </p>
        <p>
          <strong className="text-foreground">Billing.</strong> If you subscribe to a
          paid plan, Stripe holds your payment details; we store only the customer
          reference Stripe gives us and which plan you are on. We never see your card
          number.
        </p>
        <p>
          <strong className="text-foreground">Usage and cost.</strong> We record the
          tokens each request consumes so we can enforce plan limits and bill
          accurately.
        </p>
        <p>
          <strong className="text-foreground">Notifications.</strong> If you allow
          them, we store the push token your device or browser issues, so we can send
          you a notification. It identifies the device, not you personally, and you can
          revoke it at any time in your system settings.
        </p>
        <p>
          <strong className="text-foreground">Teams.</strong> If you join a team, we
          store your membership and role, and who invited you. Other members of that
          team can see your email address and display name.
        </p>
        <p>
          <strong className="text-foreground">Backups, if you enable them.</strong> You
          can connect a GitHub repository to mirror your workspace. If you do, we store
          which repository and branch, and the installation reference that lets us write
          to it. This is off unless you turn it on.
        </p>
      </Section>

      <Section title="What we do not collect">
        <p>
          No advertising identifiers, no location, no contacts, no analytics or tracking
          SDKs in the mobile app, and no third-party advertising of any kind. We do not
          sell personal data, and we never have.
        </p>
      </Section>

      <Section title="Who else sees your data">
        <p>
          <strong className="text-foreground">AI model providers.</strong> Running an
          agent means sending your conversation — and whatever context that turn needs —
          to the model provider serving it. Which provider depends on the model you
          choose. They process it to return a response and are bound by their own terms;
          we do not permit them to use it to train models.
        </p>
        <p>
          <strong className="text-foreground">Search providers.</strong> When an agent
          searches the web, the search query is sent to a search provider. Only the
          query leaves, not your conversation.
        </p>
        <p>
          <strong className="text-foreground">Stripe</strong> for payments, and{' '}
          <strong className="text-foreground">GitHub</strong> for sign-in and — only if
          you enable it — workspace backup.
        </p>
        <p>
          Beyond these, we disclose data only where the law requires it. There is no
          other sharing.
        </p>
      </Section>

      <Section title="Where it is kept, and for how long">
        <p>
          Your data is held on servers we operate in the European Union. We keep it for
          as long as your account exists. When you delete your account we remove it as
          described on the{' '}
          <Link to="/delete-account" className="text-primary hover:underline">
            account deletion
          </Link>{' '}
          page. Records we are legally required to retain — invoices, chiefly — are kept
          for as long as the law requires and no longer.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can access, correct, export or delete your data, object to how we process
          it, and withdraw consent at any time. To delete your account and everything in
          it, use the{' '}
          <Link to="/delete-account" className="text-primary hover:underline">
            account deletion
          </Link>{' '}
          page. For anything else, write to us at the address below and we will answer
          within 30 days. If you are in the EU or UK and are not satisfied with our
          answer, you may complain to your local data protection authority.
        </p>
      </Section>

      <Section title="Children">
        <p>
          lmthing is not directed at children under 13, and we do not knowingly collect
          data from them. If you believe a child has given us personal data, write to us
          and we will delete it.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          If this policy changes materially, we will update the date at the top of this
          page and tell you in the product before the change takes effect.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          <a href="mailto:support@lmthing.org" className="text-primary hover:underline">
            support@lmthing.org
          </a>
        </p>
      </Section>
    </div>
  )
}
