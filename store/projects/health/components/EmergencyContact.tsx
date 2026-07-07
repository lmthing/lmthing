import React from 'react';
import { useApi, Link } from '@app/runtime';
import { PhoneIcon, AlertIcon } from './icons';

interface CareContact {
  id: string;
  name: string;
  role: string;
  phone?: string;
}

/**
 * A persistent "call your care contact / emergency" affordance, sourced from
 * care_contacts with role 'emergency' (falling back to primary_care). Shown on
 * safety-critical surfaces so help is always one tap away. `emphatic` renders it as a
 * loud banner (for urgent/emergency triage), otherwise a quiet inline row.
 */
export function EmergencyContact({ emphatic = false }: { emphatic?: boolean }) {
  const { data } = useApi<CareContact[]>('listContacts', {});
  const contacts = data ?? [];
  const emergency =
    contacts.find((c) => c.role === 'emergency') ??
    contacts.find((c) => c.role === 'primary_care');

  if (emphatic) {
    return (
      <div className="space-y-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-destructive">
          <AlertIcon className="h-4 w-4" /> If this is severe or worsening, seek care now.
        </p>
        {emergency?.phone ? (
          <a
            href={`tel:${emergency.phone}`}
            className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90"
          >
            <PhoneIcon className="h-4 w-4" /> Call {emergency.name} · {emergency.phone}
          </a>
        ) : (
          <p className="text-sm text-destructive">
            Call your local emergency number.{' '}
            <Link href="/contacts" className="underline">
              Add an emergency contact
            </Link>{' '}
            for one-tap access.
          </p>
        )}
      </div>
    );
  }

  if (!emergency?.phone) return null;
  return (
    <a
      href={`tel:${emergency.phone}`}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-muted"
    >
      <PhoneIcon className="h-3.5 w-3.5" /> Call {emergency.name}
    </a>
  );
}

export default EmergencyContact;
