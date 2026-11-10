import { describe, expect, it, jest } from '@jest/globals';
import { arrangeTabNavigation } from '../tabNavigation';
import { splitTabs, TAB_DEFS } from '../tabs';

jest.mock('@/core/session', () => ({ useSession: jest.fn() }));

const keys = (tabs: { key: string }[]) => tabs.map((tab) => tab.key);

function navigation(user: Parameters<typeof splitTabs>[0]) {
  const { visible, overflow } = splitTabs(user);
  return arrangeTabNavigation([...visible, ...overflow]);
}

describe('bottom tab navigation', () => {
  it('shows packing in the fourth slot and customers in More for an admin', () => {
    const { visible, overflow } = navigation({ roles: ['Super Admin'], permissions: [] });
    expect(keys(visible)).toEqual(['tong-quan', 'ban-hang', 'don-hang', 'bao-don']);
    expect(keys(overflow)).toEqual(['khach-hang', 'phieu-kho']);
  });

  it('keeps customers in More even when the bottom bar has free slots', () => {
    const { visible, overflow } = navigation({
      roles: ['Sale'],
      permissions: ['invoices:create', 'invoices:view', 'customers:view', 'packing_slips:create'],
    });
    expect(keys(visible)).toEqual(['ban-hang', 'don-hang', 'bao-don']);
    expect(keys(overflow)).toEqual(['khach-hang']);
  });

  it('keeps existing driver destinations without adding customer access', () => {
    const { visible, overflow } = navigation({
      roles: ['Lái xe'],
      permissions: ['invoices:view', 'packing_loadings:create', 'vehicles:create'],
    });
    expect(keys(visible)).toEqual(['don-hang', 'bao-don', 'phieu-kho']);
    expect(overflow).toEqual([]);
  });

  it('does not add a packing tab when packing is not allowed', () => {
    const { visible, overflow } = navigation({
      roles: ['Sale'],
      permissions: ['dashboard:view', 'orders:create', 'orders:view', 'customers:view'],
    });
    expect(keys(visible)).toEqual(['tong-quan', 'ban-hang', 'don-hang']);
    expect(keys(overflow)).toEqual(['khach-hang']);
  });

  it('keeps a customer-only account reachable through More', () => {
    const { visible, overflow } = navigation({ roles: [], permissions: ['customers:view'] });
    expect(visible).toEqual([]);
    expect(keys(overflow)).toEqual(['khach-hang']);
  });

  it('returns no destinations for a signed-out account', () => {
    expect(navigation(null)).toEqual({ visible: [], overflow: [] });
  });

  it('preserves the original definitions and every allowed destination exactly once', () => {
    const originalKeys = keys(TAB_DEFS);
    const { visible, overflow } = arrangeTabNavigation(TAB_DEFS);
    expect(keys(TAB_DEFS)).toEqual(originalKeys);
    expect(visible.length).toBe(4);
    expect([...visible, ...overflow]).toHaveLength(TAB_DEFS.length);
    expect(new Set(keys([...visible, ...overflow]))).toEqual(new Set(originalKeys));
    for (const tab of [...visible, ...overflow]) {
      expect(TAB_DEFS.find((definition) => definition.key === tab.key)).toBe(tab);
    }
  });
});
