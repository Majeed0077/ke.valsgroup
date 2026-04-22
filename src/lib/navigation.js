"use client";

import { announceNavigationStart } from "@/components/NavigationProgress";

export function navigateWithTransition(router, href, options = {}) {
  if (!router || !href) return;
  announceNavigationStart({ href, replace: Boolean(options.replace) });
  if (options.replace) {
    router.replace(href);
    return;
  }
  router.push(href);
}
