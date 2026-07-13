# lmthing.store — unbuilt product ideas

> **Nothing on this page is implemented.** These are aspirational product ideas for lmthing.store,
> moved here verbatim from `store/README.md`, where they had been written as if they described shipped
> behavior. There is no marketplace, no purchase flow, no seller dashboard and no revenue plumbing in
> the code today — the store SPA is a static catalog browser (see [README.md](./README.md)).

## The agent marketplace (idea)

The agent marketplace. Creators publish agents, buyers discover and acquire them.

Store offers three distribution models for agents:

- **Free** — open download, no cost.
- **Source purchase** — one-time fee for the full agent workspace (prompts, knowledge, tools, workflows).
- **API access** — the creator hosts the agent and sets a per-token markup. Buyers call the agent through lmthing.cloud without seeing the source.

Creators publish agents built in Studio. Buyers browse, preview, and acquire agents — source purchases give the full workspace, API access routes calls through the Stripe AI Gateway.

## Routing (idea)

```mermaid
graph TD
    Root["/"] --> Browse["/browse<br/>Agent marketplace"]
    Browse --> Listing["/$agentId<br/>Agent listing"]
    Listing --> Free["/free<br/>Free download"]
    Listing --> Buy["/buy<br/>Source code purchase"]
    Listing --> API["/api<br/>API access<br/>Creator-set token markup"]
    Root --> Seller["/$username/dashboard<br/>Seller dashboard"]
    Seller --> Publish["/publish"]
    Seller --> Earnings["/earnings"]
```

## Revenue model (idea)

- **Source purchases** — lmthing takes a platform fee on one-time source code sales.
- **API access** — creators set their own per-token markup on top of provider costs. lmthing collects the standard 15% gateway markup plus any platform commission.
- **Gateway traffic** — all API-access agents route through the Stripe AI Gateway, generating per-token revenue.
