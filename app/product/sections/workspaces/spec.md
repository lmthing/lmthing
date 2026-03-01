# Workspaces Specification

## Overview
A user and permission management interface for administrators to manage workspace members. Provides role-based access control (Admin, Editor, Viewer) with a sidebar navigation listing all users and a main detail panel for viewing and editing individual user profiles and permissions.

## User Flows
- View all users in the workspace via the sidebar list
- Click a user in the sidebar to view their profile, status, and role in the main panel
- Edit a user's role (Admin, Editor, or Viewer) from the detail panel
- Add a new user by entering their email and assigning an initial role
- Remove a user from the workspace
- Filter or search for users by name or email

## UI Requirements
- Two-panel layout: fixed sidebar on the left with user list, expandable detail panel on the right
- Sidebar shows user avatars, names, email, and status indicators (active, invited, pending)
- Detail panel displays user profile (name, email, avatar, status, join date)
- Role selector with three options: Admin (full access), Editor (can edit but not manage users), Viewer (read-only)
- Save and cancel buttons when editing user permissions
- Search/filter input at top of sidebar
- Visual status badges for user state (active, invited, pending)
- Confirmation dialog before removing users

## Configuration
- shell: true
