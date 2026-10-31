/** Người dùng tối thiểu để kiểm quyền (tránh phụ thuộc vòng với session). */
export interface PermissionHolder {
  roles?: string[];
  permissions?: string[];
}

/** Quyền dạng "resource:action", Super Admin có mọi quyền (giống web). */
export function canDo(user: PermissionHolder | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.roles?.includes('Super Admin')) return true;
  return user.permissions?.includes(permission) ?? false;
}
