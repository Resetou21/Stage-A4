import { createFileRoute, Outlet } from '@tanstack/react-router';

// Shared layout for every page. `_app` is a pathless layout route — it adds NO URL segment, it just
// wraps all pages under src/generated/routes/_app/. For a multi-page app, put your persistent
// sidebar / nav / header here around <Outlet />; the matched page renders in place of <Outlet />.
// The default is a passthrough so single-page apps (which only touch @generated/App) render cleanly.
export const Route = createFileRoute('/_app')({
  component: AppLayout,
});

function AppLayout() {
  return <Outlet />;
}
