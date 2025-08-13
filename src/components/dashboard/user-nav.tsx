
"use client";

import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { LogOut, User as UserIcon, Shield, UserCog, UserSearch, ShieldAlert } from 'lucide-react';
import type { UserRole } from '@/types';

const RoleAvatar = ({ role, className }: { role: UserRole; className?: string }) => {
  const iconProps = { className: `h-5 w-5 ${className}` };
  switch (role) {
    case 'admin':
      return <Shield {...iconProps} />;
    case 'super':
        return <ShieldAlert {...iconProps} />;
    case 'update':
      return <UserCog {...iconProps} />;
    case 'inquiry':
      return <UserSearch {...iconProps} />;
    case 'individual':
      return <UserIcon {...iconProps} />;
    default:
      return <UserIcon {...iconProps} />;
  }
};


export function UserNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return null;
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
             <div className="flex h-full w-full items-center justify-center rounded-full bg-muted text-muted-foreground">
                <RoleAvatar role={user.role} />
             </div>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled>
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
