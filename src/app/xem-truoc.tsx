import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { BranchPickerView } from '@/features/shell/BranchPickerScreen';
import { DashboardView } from '@/features/dashboard/DashboardView';
import type { DashRange, TaskType } from '@/features/dashboard/api';
import { TaskListView } from '@/features/dashboard/TaskListScreen';
import { sampleBranches, sampleDashboard, sampleTasks, sampleUser } from '@/features/preview/sample';
import { MoreView } from '@/features/shell/MoreScreen';
import { TabBar } from '@/features/shell/TabBar';
import { TAB_DEFS } from '@/features/shell/tabs';
import LoginScreen from '@/features/auth/LoginScreen';
import { ActionCard, Page, TitleHeader, toast } from '@/ui';

const SCREENS = [
  { key: 'dang-nhap', title: 'Đăng nhập' },
  { key: 'tong-quan', title: 'Tổng quan' },
  { key: 'viec', title: 'Việc cần xử lý' },
  { key: 'them', title: 'Thêm' },
  { key: 'chi-nhanh', title: 'Chọn chi nhánh' },
] as const;

const noop = () => toast.info('Chỉ là bản xem trước');
const tabs = TAB_DEFS.slice(0, 4);

function FakeTabBar({ active }: { active: string }) {
  const names = [...tabs.map((t) => t.key), 'them'];
  return (
    <TabBar
      tabs={tabs}
      state={{ index: Math.max(0, names.indexOf(active)), routes: names.map((n) => ({ key: n, name: n })) }}
      emitter={{ emit: () => ({ defaultPrevented: false }) } as never}
      navigateToTab={noop}
      descriptors={{} as never}
      insets={{ top: 0, bottom: 0, left: 0, right: 0 }}
    />
  );
}

/**
 * Trang xem trước giao diện bằng dữ liệu mẫu — CHỈ khi dev (để chụp ảnh kiểm
 * tra trên trình duyệt). Bản phát hành chuyển thẳng về trang chính.
 */
export default function PreviewScreen() {
  const { man } = useLocalSearchParams<{ man?: string }>();
  const [range, setRange] = useState<DashRange>('today');
  const [task, setTask] = useState<TaskType>('orders');

  if (!__DEV__) return <Redirect href="/" />;

  if (man === 'dang-nhap') return <LoginScreen />;
  if (man === 'tong-quan')
    return (
      <View style={{ flex: 1 }}>
        <DashboardView
          user={sampleUser}
          branchName={sampleBranches[0].name}
          range={range}
          onRangeChange={setRange}
          data={sampleDashboard}
          onOpenBranch={() => router.setParams({ man: 'chi-nhanh' })}
          onOpenAccount={() => router.setParams({ man: 'them' })}
          onOpenTask={() => router.setParams({ man: 'viec' })}
          onShortcut={noop}
        />
        <FakeTabBar active="tong-quan" />
      </View>
    );
  if (man === 'viec')
    return (
      <TaskListView
        type={task}
        onTypeChange={setTask}
        rows={task === 'orders' ? sampleTasks : []}
        counts={sampleDashboard.counts}
      />
    );
  if (man === 'them')
    return (
      <View style={{ flex: 1 }}>
        <MoreView
          user={sampleUser}
          branchName={sampleBranches[0].name}
          canSwitchBranch
          hiddenTabKeys={['bao-don']}
          onOpenBranch={() => router.setParams({ man: 'chi-nhanh' })}
          onOpen={noop}
          onSignOut={noop}
        />
        <FakeTabBar active="them" />
      </View>
    );
  if (man === 'chi-nhanh')
    return <BranchPickerView branches={sampleBranches} branchId={1} switching={null} onPick={noop} />;

  return (
    <Page header={<TitleHeader title="Xem trước giao diện" />}>
      <View style={{ gap: 10 }}>
        {SCREENS.map((s) => (
          <ActionCard
            key={s.key}
            icon="layout-grid"
            color="teal"
            title={s.title}
            subtitle="Dữ liệu mẫu"
            onPress={() => router.setParams({ man: s.key })}
          />
        ))}
      </View>
    </Page>
  );
}
