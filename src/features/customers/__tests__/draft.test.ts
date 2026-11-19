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

  it('chỉ giữ hàm báo "đã lưu" cho đúng lần mở form đó', () => {
    const onSaved = () => undefined;
    startCustomerDraft(newCustomerForm(), 5, 'customers', onSaved);
    expect(useCustomerDraft.getState().onSaved).toBe(onSaved);

    startCustomerDraft(newCustomerForm(), 5);
    expect(useCustomerDraft.getState().onSaved).toBeNull();
  });
});
