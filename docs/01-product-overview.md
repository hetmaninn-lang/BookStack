# Product overview — discovery notes

First discovery pass. Everything below was observed on the local test instance; nothing is taken
from documentation alone. Items not yet examined are listed at the end.

| | |
| --- | --- |
| System under test | BookStack v26.09.3 (`lscr.io/linuxserver/bookstack:version-v26.09.3`) |
| Database | MariaDB 11 |
| Environment | Docker Compose, `http://localhost:6875`, fresh install with no content |
| Explored as | Default administrator account |

## Content model

Shelves → Books → Chapters → Pages. Pages carry revisions, images, attachments and comments.

## Users and roles on a fresh install

Two users exist: `Admin` (role Admin) and `Guest` (role Public). Guest represents visitors who are
not logged in.

| Role | Description shown in the app | Permissions | Users |
| --- | --- | --- | --- |
| Admin | Administrator of the whole application | 62 | 1 |
| Editor | User can edit Books, Chapters & Pages | 40 | 0 |
| Viewer | User can view books & their content behind authentication | 10 | 0 |
| Public | The role given to public visitors if allowed | 10 | 1 |

A user can hold several roles; the app states that privileges stack.

## Permission model

**System permissions** (per role):

- Manage all book, chapter & page permissions
- Manage permissions on own book, chapter & pages
- Manage page templates
- Access system API
- Export content
- Import content
- Change page editor
- Receive & manage notifications
- Manage app settings
- Manage users
- Manage roles & role permissions

The app itself warns that the last three allow a user to alter their own or others' privileges.
A role can also require multi-factor authentication.

**Asset permissions** (per role): Create / View / Edit / Delete, each scoped to *Own* or *All*, for
Shelves, Books, Chapters and Pages. Images, Attachments and Comments have Create / Edit / Delete,
with viewing controlled by the item they belong to. Revisions have their own permissions.

**Content-level permissions**: the role form states that permissions set on individual Books,
Chapters and Pages override the role's asset permissions.

Side effects the app discloses in footnotes: several permissions (managing content permissions,
comments) also make users and roles visible and searchable; and image files may be reachable
regardless of permissions, depending on the image storage option.

## Settings relevant to access control

- **Public access** — lets visitors who are not logged in see content, governed by the Guest user.
- **Higher security image uploads** — the app states all images are public "for performance
  reasons" and this option only adds a hard-to-guess string to image URLs.
- **Registration** — self sign-up with a configurable default role (the list offers every role,
  including Admin), optional email-domain restriction and email confirmation.
- **Disable comments** — global switch.

Admin area sections: Settings, Maintenance, Audit Log, Users, Roles, Webhooks.

## REST API

Built-in documentation at `/api/docs`. Resource groups: Pages, Chapters, Books, Shelves,
Attachments, Audit-Log, Comments, Content-Permissions, Image-Gallery, Imports, Recycle-Bin, Roles,
Search, System, Tags, Users. Access is gated by the "Access system API" role permission.

## Early risk observations

To be assessed properly in the risk assessment; listed here so they are not lost.

1. Three layers decide access (role asset permissions, Own vs All scope, per-item overrides), and
   roles stack. The combinations are where access-control defects are most likely.
2. Images are documented as publicly reachable; attachments are permission-controlled. Worth
   confirming both behave as stated.
3. Registration can assign any role by default, including Admin — a configuration risk.
4. The API exposes Users, Roles, Content-Permissions and Audit-Log, so every UI access rule needs
   an equivalent check through the API.

## Not yet examined

- Behaviour as Editor, Viewer and Guest (no such users or content exist yet)
- Default state of public access and registration
- Page editor, revisions, attachments, search, export/import, recycle bin
- Multi-factor authentication, webhooks, audit log contents
- API authentication (tokens) and rate limiting
