/**
 * A request-time snapshot of the clock for server components. React's
 * purity rule flags `Date.now()` inside a component body — rightly, on the
 * client, where a re-render would move the value. A server component
 * renders once per request, and every deadline on the page should be judged
 * against the same instant, so it takes one reading here and passes it down.
 */
export const now = (): number => Date.now();
