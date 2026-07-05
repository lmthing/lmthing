import React, { useState } from 'react';
import type { CareContact } from '@app/types';
import { useApi, useApiMutation } from '@app/runtime';
import { ContactCard } from '../components/ContactCard';
import { Spinner } from '../components/Spinner';

export default function Contacts() {
  const { data: contacts, isLoading, error } = useApi<CareContact[]>('listContacts', {});

  const addContact = useApiMutation<CareContact>('addContact', {
    invalidates: ['listContacts'],
  });

  const [name, setName] = useState('');
  const [role, setRole] = useState('other');
  const [organization, setOrganization] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addContact.mutate({
        name: name.trim(),
        role,
        organization: organization.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });
      setName('');
      setRole('other');
      setOrganization('');
      setPhone('');
      setEmail('');
    } catch {
      // surfaced via addContact.error below
    }
  };

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-xl font-bold text-foreground">Care team</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Add a contact</h2>
        <form onSubmit={onAdd} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name (e.g. Dr. Priya Rao)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-40 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            >
              <option value="primary_care">Primary care</option>
              <option value="specialist">Specialist</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="emergency">Emergency</option>
              <option value="other">Other</option>
            </select>
          </div>
          <input
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Organization (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
          />
          <div className="flex gap-3">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (optional)"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
            />
          </div>
          <button
            type="submit"
            disabled={addContact.isPending || !name.trim()}
            className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
          >
            {addContact.isPending ? 'Adding…' : 'Add contact'}
          </button>
          {addContact.error ? (
            <p className="text-sm text-destructive">
              {(addContact.error as { message?: string })?.message ?? 'Failed to add contact.'}
            </p>
          ) : null}
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase text-muted-foreground">Your care team</h2>

        {isLoading ? <Spinner /> : null}

        {error ? (
          <div className="rounded-lg border border-destructive p-4 text-sm text-destructive">
            Failed to load contacts.
          </div>
        ) : null}

        {!isLoading && !error && (contacts ?? []).length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
            No contacts yet.
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {(contacts ?? []).map((c) => (
            <ContactCard key={c.id} contact={c} />
          ))}
        </div>
      </section>
    </main>
  );
}
