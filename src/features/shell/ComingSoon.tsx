import { EmptyState } from '@/ui';
import type { IconName } from '@/ui';

/** Màn tạm cho phần sẽ có ở bản cập nhật sau. */
export function ComingSoon({ icon = 'hammer', title }: { icon?: IconName; title: string }) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      message="Màn này đang được xây dựng và sẽ có ở bản cập nhật tới."
    />
  );
}
