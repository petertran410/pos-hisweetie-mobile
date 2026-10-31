import { useSession, type Profile } from './session';

/** Quyền dạng "resource:action", Super Admin có mọi quyền (giống web). */
export function canDo(user: Profile | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.roles?.includes('Super Admin')) return true;
  return user.permissions?.includes(permission) ?? false;
}

export function useCan(resource: string, action: string): boolean {
  const user = useSession((s) => s.user);
  return canDo(user, `${resource}:${action}`);
}

/** Có ít nhất 1 trong các quyền. */
export function useCanAny(permissions: string[]): boolean {
  const user = useSession((s) => s.user);
  return permissions.some((p) => canDo(user, p));
}

export function useIsAdmin(): boolean {
  const user = useSession((s) => s.user);
  return !!user?.roles?.some((r) => r === 'Super Admin' || r === 'Admin');
}
