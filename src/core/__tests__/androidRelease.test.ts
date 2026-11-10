import { describe, expect, it } from '@jest/globals';
import appConfig from '../../../app.json';
import easConfig from '../../../eas.json';
import manifest from '../../../package.json';

describe('Android preview release', () => {
  it('builds an internally distributed APK with EAS-managed signing', () => {
    expect(easConfig.build.preview).toMatchObject({
      distribution: 'internal',
      channel: 'preview',
      environment: 'preview',
      android: { buildType: 'apk', credentialsSource: 'remote' },
    });
    expect(easConfig.build.preview.android).not.toHaveProperty('abiFilters');
  });

  it('builds the preview APK for ARM64 phones only', () => {
    expect(appConfig.expo.plugins).toContainEqual([
      'expo-build-properties',
      { android: { buildArchs: ['arm64-v8a'] } },
    ]);
  });

  it('verifies the app before building or publishing Android preview updates', () => {
    expect(manifest.scripts['build:preview:android']).toBe(
      'yarn verify && npx eas-cli build -p android --profile preview',
    );
    expect(manifest.scripts['update:preview:android']).toBe(
      'yarn verify && npx eas-cli update -p android --channel preview --environment preview --auto',
    );
  });

  it('preserves iOS release commands and local preview signing', () => {
    expect(manifest.scripts).toMatchObject({
      'update:preview': 'yarn verify && npx eas-cli update -p ios --channel preview --environment preview --auto',
      'update:prod': 'yarn verify && npx eas-cli update -p ios --channel production --environment production --auto',
      'build:preview': 'yarn verify && npx eas-cli build -p ios --profile preview',
      'build:prod': 'yarn verify && npx eas-cli build -p ios --profile production',
      'build:prod:submit': 'yarn verify && npx eas-cli build -p ios --profile production --auto-submit',
      submit: 'npx eas-cli submit -p ios --profile production --latest',
    });
    expect(easConfig.build.preview.ios).toEqual({
      resourceClass: 'm-medium',
      credentialsSource: 'local',
    });
  });

  it('keeps fingerprint-based update compatibility', () => {
    expect(appConfig.expo.runtimeVersion).toEqual({ policy: 'fingerprint' });
    expect(appConfig.expo.updates.url).toBe(`https://u.expo.dev/${appConfig.expo.extra.eas.projectId}`);
  });
});
