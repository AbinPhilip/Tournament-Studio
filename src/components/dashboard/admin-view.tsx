"use client";

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { mockUsers, mockTeams } from '@/lib/mock-data';
import type { User, UserRole, Team } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { MoreHorizontal, Trash2, UserPlus, Users as TeamsIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

function RoleBadge({ role }: { role: UserRole }) {
    const variant: BadgeProps["variant"] = {
        admin: "destructive",
        update: "default",
        inquiry: "secondary",
        individual: "outline"
    }[role]
    return <Badge variant={variant} className="capitalize">{role}</Badge>
}

const userFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  username: z.string().min(1, { message: "Username is required." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phoneNumber: z.string().regex(/^\d{10}$/, { message: 'Please enter a valid 10-digit phone number.' }),
  role: z.enum(['individual', 'update', 'admin', 'inquiry']),
});

const teamFormSchema = z.object({
  type: z.enum(['singles', 'mens_doubles', 'mixed_doubles']),
  player1Name: z.string().min(2, "Player 1 name is required."),
  player2Name: z.string().optional(),
  genderP1: z.enum(['male', 'female']).optional(),
  organization: z.string().min(2, "Organization name is required."),
}).refine(data => {
    if (data.type === 'mens_doubles' || data.type === 'mixed_doubles') {
        return !!data.player2Name && data.player2Name.length >= 2;
    }
    return true;
}, {
    message: "Player 2 name is required for doubles.",
    path: ["player2Name"],
}).refine(data => {
    if (data.type === 'mixed_doubles') {
        return !!data.genderP1;
    }
    return true;
}, {
    message: "Gender is required for Mixed Doubles.",
    path: ["genderP1"],
});


export default function AdminView() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>(mockUsers);
  const [teams, setTeams] = useState<Team[]>(mockTeams);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);

  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: '',
      username: '',
      email: '',
      phoneNumber: '',
      role: 'individual',
    },
  });

  const teamForm = useForm<z.infer<typeof teamFormSchema>>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: {
        type: 'singles',
        player1Name: '',
        player2Name: '',
        organization: '',
    },
  });

  const teamType = teamForm.watch('type');

  const handleDeleteUser = () => {
    if(!userToDelete) return;
    setUsers(users.filter(u => u.id !== userToDelete.id));
    setUserToDelete(null);
  }

  const handleAddUser = (values: z.infer<typeof userFormSchema>) => {
    const newUser: User = {
      id: (users.length + 1).toString(),
      ...values,
      role: values.role as UserRole,
    };
    setUsers([...users, newUser]);
    toast({
      title: 'User Created',
      description: `User "${newUser.name}" has been added.`,
    });
    setIsAddUserOpen(false);
    userForm.reset();
  };
  
  const handleAddTeam = (values: z.infer<typeof teamFormSchema>) => {
    const newTeam: Team = {
      id: (teams.length + 1).toString(),
      type: values.type,
      player1Name: values.player1Name,
      player2Name: values.type !== 'singles' ? values.player2Name : undefined,
      genderP1: values.type === 'mixed_doubles' ? values.genderP1 : undefined,
      organization: values.organization,
    };
    setTeams([...teams, newTeam]);
    toast({
      title: 'Team Registered',
      description: `Team "${newTeam.player1Name}${newTeam.player2Name ? ' & ' + newTeam.player2Name : ''}" has been registered.`,
    });
    setIsAddTeamOpen(false);
    teamForm.reset();
  };

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Administrator Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.name}. Manage users, teams, and system settings.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Team Management</CardTitle>
            <CardDescription>Register and manage badminton teams.</CardDescription>
          </div>
          <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
            <DialogTrigger asChild>
              <Button>
                <TeamsIcon className="mr-2 h-4 w-4" />
                Register Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Register New Team</DialogTitle>
                <DialogDescription>
                  Enter the details for the new team.
                </DialogDescription>
              </DialogHeader>
              <Form {...teamForm}>
                <form onSubmit={teamForm.handleSubmit(handleAddTeam)} className="space-y-4">
                   <FormField
                    control={teamForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Event Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select an event type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="singles">Singles</SelectItem>
                            <SelectItem value="mens_doubles">Men's Doubles</SelectItem>
                            <SelectItem value="mixed_doubles">Mixed Doubles</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={teamForm.control}
                    name="player1Name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{teamType === 'singles' ? 'Player Name' : 'Player 1 Name'}</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {(teamType === 'mens_doubles' || teamType === 'mixed_doubles') && (
                     <FormField
                        control={teamForm.control}
                        name="player2Name"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Player 2 Name</FormLabel>
                            <FormControl>
                            <Input placeholder="Partner's Name" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  )}
                  {teamType === 'mixed_doubles' && (
                     <FormField
                        control={teamForm.control}
                        name="genderP1"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Player 1 Gender</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select Player 1's gender" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                  )}
                  <FormField
                    control={teamForm.control}
                    name="organization"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Organization</FormLabel>
                        <FormControl>
                          <Input placeholder="Team/Club Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Register Team</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Players</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium capitalize">{t.type.replace('_', ' ')}</TableCell>
                  <TableCell>{t.player1Name}{t.player2Name ? ` & ${t.player2Name}`: ''}</TableCell>
                  <TableCell>{t.organization}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem disabled>Edit team</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <CardDescription>View, edit, and remove users from the system.</CardDescription>
          </div>
          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Enter the details for the new user account.
                </DialogDescription>
              </DialogHeader>
              <Form {...userForm}>
                <form onSubmit={userForm.handleSubmit(handleAddUser)} className="space-y-4">
                  <FormField
                    control={userForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={userForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="johndoe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={userForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="john.doe@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={userForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="1234567890" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={userForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="individual">Individual</SelectItem>
                            <SelectItem value="update">Update User</SelectItem>
                            <SelectItem value="inquiry">Inquiry User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button type="submit">Create User</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Role</TableHead>
                <TableHead><span className="sr-only">Actions</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.phoneNumber}</TableCell>
                  <TableCell><RoleBadge role={u.role} /></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={u.id === user?.id}>
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem disabled>Edit user</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={() => setUserToDelete(u)}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the user account for <span className="font-semibold">{userToDelete?.name}</span>.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete User
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader>
          <CardTitle>System Settings</CardTitle>
          <CardDescription>Global application settings.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex items-center space-x-4 rounded-md border p-4">
                <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">Maintenance Mode</p>
                    <p className="text-sm text-muted-foreground">
                        Temporarily disable access to the app for non-admin users.
                    </p>
                </div>
                <Switch 
                    checked={maintenanceMode} 
                    onCheckedChange={setMaintenanceMode}
                    aria-label="Toggle maintenance mode"
                />
            </div>
        </CardContent>
      </Card>
    </div>
  );
}
