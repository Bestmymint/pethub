import { Badge } from '@/components/ui/badge';
import { AdminShell } from '@/features/admin/admin-shell';
import { UserAction } from '@/features/admin/user-action';
import { prisma } from '@/lib/prisma';

export default async function UsersPage() {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return (
    <AdminShell
      title="จัดการผู้ใช้"
      description="ระงับบัญชีจะ revoke session ทั้งหมดทันที และ protected API ตรวจซ้ำฝั่ง server"
    >
      <div className="overflow-x-auto rounded-2xl border bg-[var(--surface)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-[var(--sage)]">
            <tr>
              <th className="p-4">ผู้ใช้</th>
              <th>อีเมล</th>
              <th>Role</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-[var(--border)]">
                <td className="p-4 font-bold">{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <Badge tone={user.role === 'ADMIN' ? 'coral' : 'neutral'}>
                    {user.role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ใช้'}
                  </Badge>
                </td>
                <td>
                  <Badge tone={user.suspendedAt ? 'red' : 'emerald'}>
                    {user.suspendedAt ? 'ถูกระงับ' : 'ใช้งานอยู่'}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <UserAction id={user.id} suspended={Boolean(user.suspendedAt)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
