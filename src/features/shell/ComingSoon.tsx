import { Appear, EmptyState, Page, TitleHeader, type AccentName, type IconName } from '@/ui';

/** Màn tạm cho phần sẽ có ở bản cập nhật sau. */
export function ComingSoon({ icon = 'hammer', color = 'teal', title }: { icon?: IconName; color?: AccentName; title: string }) {
  return (
    <Page header={<TitleHeader title={title} />} scroll={false}>
      <Appear style={{ flex: 1 }}>
        <EmptyState
          icon={icon}
          color={color}
          title="Đang xây dựng"
          message="Màn này đang được làm và sẽ có ở bản cập nhật tới."
        />
      </Appear>
    </Page>
  );
}
