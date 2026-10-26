# Social-feed restoration, 26 October 2026

The latest production source was `199ab12`. Its homepage returned the marketing-only
`WelcomeHero` for every signed-out visitor, and its middleware did not allow `/signup`.
The earlier feed-oriented home history includes `0ccd6ac` (14 April: core feed navigation,
post detail pages and real-time updates), followed by the May feed/repost/auth fixes.

This is a forward restoration of that social product, not a destructive branch reset:
retain the newest OAuth, credentials, repost and webhook fixes while making the real
community feed the homepage again. No demo posts, invented users or engagement metrics
are inserted. Public read access does not grant post/reaction/follow permissions.

The updated shell restores desktop navigation and a responsive feed, working guest
sign-up/sign-in links, feed filters, the existing composer and release composer, and
an explicit database-error state. Guest sessions do not poll authenticated endpoints.
Keyboard focus, skip navigation and reduced-motion preferences are respected.

Verification: `node --test tests/feed-state.test.mjs`, TypeScript/build checks, and
real-browser desktop/mobile navigation checks. See the deployment record for results.
