import { describe, expect, it } from '@jest/globals';
import { startCustomerDraft, useCustomerDraft } from '../draft';
import { newCustomerForm } from '../form';

describe('customer draft origin', () => {
  it('ghi nhớ form được mở từ giỏ hàng và reset về luồng khách hàng ở lần mở sau', () => {
    startCustomerDraft(newCustomerForm(), null, 'sale');
    expect(useCustomerDraft.getState().origin).toBe('sale');

    startCustomerDraft(newCustomerForm());
    expect(useCustomerDraft.getState().origin).toBe('customers');
  });
});
