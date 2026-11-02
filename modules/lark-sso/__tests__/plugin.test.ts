import { describe, expect, it } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-require-imports */
const { addLarkPod, addLarkPlist } = require('../app.plugin.js') as {
  addLarkPod: (contents: string) => string;
  addLarkPlist: (plist: Record<string, unknown>, appId: string) => Record<string, unknown>;
};

const PODFILE = `platform :ios, '15.1'

target 'HiSweetiePOS' do
  use_expo_modules!

  config = use_native_modules!(config_command)
end
`;

describe('lark-sso config plugin', () => {
  it('adds the LarkSSOSDK pod from Lark source right after use_expo_modules!, once', () => {
    const once = addLarkPod(PODFILE);
    expect(once).toContain(
      "  use_expo_modules!\n  # Đăng nhập bằng app Lark: pod nằm ở nguồn riêng của Lark.\n  pod 'LarkSSOSDK', '1.2.0', :source => 'https://github.com/volcengine/volcengine-specs.git'",
    );
    expect(addLarkPod(once)).toBe(once);
  });

  it('fails loudly when the Podfile has no use_expo_modules!', () => {
    expect(() => addLarkPod("target 'X' do\nend\n")).toThrow('use_expo_modules!');
  });

  it('lets the app ask for the Lark app and registers the return scheme (App ID without underscores)', () => {
    const plist = addLarkPlist(
      { LSApplicationQueriesSchemes: ['tel'], CFBundleURLTypes: [{ CFBundleURLSchemes: ['hisweetiepos'] }] },
      'cli_A0988c0add',
    );
    expect(plist.LSApplicationQueriesSchemes).toEqual(['tel', 'lark']);
    expect(plist.CFBundleURLTypes).toEqual([{ CFBundleURLSchemes: ['hisweetiepos'] }, { CFBundleURLSchemes: ['clia0988c0add'] }]);
    expect(addLarkPlist(plist, 'cli_A0988c0add').CFBundleURLTypes).toHaveLength(2);
  });

  it('without an App ID: no return scheme (the app keeps the web login)', () => {
    const plist = addLarkPlist({}, '');
    expect(plist.LSApplicationQueriesSchemes).toEqual(['lark']);
    expect(plist.CFBundleURLTypes).toBeUndefined();
  });
});
