import { LEGACY_DEFAULT_PROVIDER_PROFILE_ID } from '../../utils/settings-manager';

export type ProviderNavigationIntent =
  | { action: 'select'; profileId: string }
  | { action: 'create' };

export const SETTINGS_PROVIDER_NAV_EVENT = 'aitu:settings:provider-nav';

type WindowWithProviderNavigationIntent = typeof window & {
  __aituPendingProviderNavigationIntent?: ProviderNavigationIntent;
};

export function peekPendingProviderNavigationIntent(): ProviderNavigationIntent | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return (
    (window as WindowWithProviderNavigationIntent)
      .__aituPendingProviderNavigationIntent || null
  );
}

export function consumePendingProviderNavigationIntent(): ProviderNavigationIntent | null {
  const intent = peekPendingProviderNavigationIntent();
  if (typeof window !== 'undefined') {
    (window as WindowWithProviderNavigationIntent)
      .__aituPendingProviderNavigationIntent = undefined;
  }
  return intent;
}

export function isHambaoQuickSetupIntent(
  intent: ProviderNavigationIntent | null
): boolean {
  return (
    intent?.action === 'select' &&
    intent.profileId === LEGACY_DEFAULT_PROVIDER_PROFILE_ID
  );
}
