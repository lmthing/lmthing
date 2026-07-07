import React from 'react';
import { Chat } from '@app/runtime';
import { ChatIcon } from '../components/icons';

/**
 * Full-screen Health Assistant — the same care/assistant agent as the header "Ask"
 * dock, given room for a longer conversation. The assistant reads across the whole
 * record, logs safe user data with confirmation, and routes clinical work to the
 * specialists.
 */
export default function AssistantPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center gap-2">
        <span className="text-agent">
          <ChatIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-xl font-bold text-foreground">Health Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask about your record, log measurements, or start a specialist's work — in plain language.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-agent/20 bg-agent/5 p-3 text-sm text-muted-foreground">
        The assistant confirms before changing anything and never diagnoses — clinical questions are
        routed to the interpreter, pharmacist, or triage nurse. Not medical advice.
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <Chat agent="care/assistant" />
      </div>
    </main>
  );
}
