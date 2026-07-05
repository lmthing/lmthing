import React from 'react';
import type { CareContact } from '@app/types';

export function ContactCard({ contact }: { contact: CareContact }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-foreground">{contact.name}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold uppercase text-muted-foreground">
          {contact.role}
        </span>
      </div>
      {contact.organization ? <p className="text-sm text-muted-foreground">{contact.organization}</p> : null}
      {contact.phone ? <p className="text-sm text-foreground">{contact.phone}</p> : null}
      {contact.email ? <p className="text-sm text-foreground">{contact.email}</p> : null}
      {contact.note ? <p className="text-sm text-muted-foreground">{contact.note}</p> : null}
    </div>
  );
}

export default ContactCard;
