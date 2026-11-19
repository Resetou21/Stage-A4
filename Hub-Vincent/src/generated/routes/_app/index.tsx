import { createFileRoute } from '@tanstack/react-router';
import App from '@generated/App';

// Home route ('/'). By default it renders @generated/App, so single-page apps work with zero routing
// changes. For a multi-page app, replace the component with your home page and add sibling pages
// under src/generated/routes/_app/ (e.g. counterparties.tsx -> /counterparties).
export const Route = createFileRoute('/_app/')({
  component: App,
});
