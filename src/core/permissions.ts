import { canDo, isAdminRole } from './can';
import { useSession } from './session';

export { canDo } from './can';

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
  return isAdminRole(user);
}
