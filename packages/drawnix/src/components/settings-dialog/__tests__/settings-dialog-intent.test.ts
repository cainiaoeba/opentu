import { afterEach, describe, expect, it } from 'vitest';
import {
  consumePendingProviderNavigationIntent,
  isHambaoQuickSetupIntent,
  peekPendingProviderNavigationIntent,
  type ProviderNavigationIntent,
} from '../provider-navigation-intent';
import { LEGACY_DEFAULT_PROVIDER_PROFILE_ID } from '../../../utils/settings-manager';

type WindowWithProviderIntent = typeof window & {
  __aituPendingProviderNavigationIntent?: ProviderNavigationIntent;
};

function intentWindow(): WindowWithProviderIntent {
  return window as WindowWithProviderIntent;
}

afterEach(() => {
  intentWindow().__aituPendingProviderNavigationIntent = undefined;
});

describe('settings dialog provider navigation intent', () => {
  it('keeps the quick-setup intent available through repeated render peeks', () => {
    const intent: ProviderNavigationIntent = {
      action: 'select',
      profileId: LEGACY_DEFAULT_PROVIDER_PROFILE_ID,
    };
    intentWindow().__aituPendingProviderNavigationIntent = intent;

    expect(peekPendingProviderNavigationIntent()).toEqual(intent);
    expect(peekPendingProviderNavigationIntent()).toEqual(intent);
    expect(isHambaoQuickSetupIntent(peekPendingProviderNavigationIntent())).toBe(
      true
    );

    expect(consumePendingProviderNavigationIntent()).toEqual(intent);
    expect(peekPendingProviderNavigationIntent()).toBeNull();
  });

  it('does not use the modal quick setup for unrelated navigation intents', () => {
    expect(isHambaoQuickSetupIntent({ action: 'create' })).toBe(false);
    expect(
      isHambaoQuickSetupIntent({ action: 'select', profileId: 'other' })
    ).toBe(false);
  });
});
