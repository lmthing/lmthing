---
title: Chat
description: Personal THING interface for direct conversations
order: 2
---

# lmthing.chat

Your personal THING interface for direct, one-on-one conversations with AI. Chat provides a clean, focused environment for interacting with language models without the complexity of the full Studio.

## What It Does

Chat gives you a streamlined conversational interface with model selection, conversation history, and configurable preferences. Choose between free and premium models, set your preferred interaction mode, and maintain multiple conversation threads.

## Key Features

- **Multi-turn conversations** — Maintain context across long conversation threads
- **Model selection** — Switch between models based on your task and subscription tier
- **Conversation history** — Review and continue previous conversations
- **Chat modes** — Casual, focused, or creative interaction styles
- **Tier-based access** — Free tier with basic models, Pro tier with full model catalog

## When to Use

Use Chat when you want a direct conversation without building agents first. It's perfect for quick questions, brainstorming sessions, research tasks, and creative writing. Think of it as your personal AI assistant that's always available.

## How It Connects

Chat uses the same LLM proxy as Studio (via the generate-ai edge function and Stripe token billing). Your usage counts toward your subscription tier limits. Authentication flows through the same SSO system as all lmthing services.
