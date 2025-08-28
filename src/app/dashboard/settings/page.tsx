
"use client";

import { useState, useEffect, useCallback } from 'react';
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
import type { User, UserRole } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { MoreHorizontal, Trash2, UserPlus, Edit, CheckCircle, ArrowLeft, Database, Loader2, Save, GitBranch, Trophy, Users, Building, ListOrdered, Shield, Cog, LayoutDashboard, Settings, MonitorPlay, HeartHandshake } from 'lucide-react';
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
  AlertDialogTrigger,
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
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where, updateDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { mockUsers, mockOrganizations, mockTeams } from '@/lib/mock-data';


function RoleBadge({ role }: { role: UserRole }) {
    const variant: BadgeProps["variant"] = {
        admin: "destructive",
        super: "destructive",
        update: "default",
        inquiry: "secondary",
        individual: "outline",
        court: 'default',
    }[role]
    return <Badge variant={variant} className="capitalize">{role}</Badge>
}

const userFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  username: z.string().min(1, { message: "Username is required." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  phoneNumber: z.string().regex(/^\d{10}$/, { message: 'Please enter a valid 10-digit phone number.' }),
  role: z.enum(['individual', 'update', 'admin', 'inquiry', 'super']),
});

const userRoles: UserRole[] = ['super', 'admin', 'update', 'inquiry', 'individual'];

const appModules = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tournament', label: 'Tournament Setup', icon: Cog },
    { id: 'organizations', label: 'Organizations', icon: Building },
    { id: 'teams', label: 'Teams', icon: Users },
    { id: 'sponsors', label: 'Sponsors', icon: HeartHandshake },
    { id: 'scheduler', label: 'Scheduler', icon: ListOrdered },
    { id: 'umpire', label: 'Umpire View', icon: Shield },
    { id: 'draw', label: 'Tournament Draw', icon: GitBranch },
    { id: 'match-history', label: 'Match History', icon: Trophy },
    { id: 'presenter', label: 'Presenter View', icon: MonitorPlay },
    { id: 'settings', label: 'System Settings', icon: Settings },
];

type RolePermissions = Record<UserRole, string[]>;


export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successModalTitle, setSuccessModalTitle] = useState('');
  const [successModalMessage, setSuccessModalMessage] = useState('');
  
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  const [permissions, setPermissions] = useState<RolePermissions>({
    super: [], admin: [], update: [], inquiry: [], individual: [], court: []
  });

  const fetchUsersAndPermissions = useCallback(async () => {
    const allModuleIds = appModules.map(m => m.id);
    const defaultPerms: RolePermissions = {
        super: allModuleIds,
        admin: allModuleIds.filter(id => id !== 'settings'), // Admin can't change permissions
        update: ['dashboard', 'umpire', 'draw', 'match-history', 'presenter'],
        inquiry: ['dashboard', 'draw', 'match-history', 'presenter'],
        individual: ['dashboard', 'draw', 'match-history', 'presenter'],
        court: [],
    };

    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });
    
    const permsUnsub = onSnapshot(collection(db, 'rolePermissions'), (snapshot) => {
        if (snapshot.empty) {
            setPermissions(defaultPerms);
            // Optionally, save these defaults to Firestore
            const batch = writeBatch(db);
            Object.entries(defaultPerms).forEach(([role, modules]) => {
                if (role === 'court') return; 
                const docRef = doc(db, 'rolePermissions', role);
                batch.set(docRef, { modules });
            });
            batch.commit();
        } else {
            const fetchedPerms = snapshot.docs.reduce((acc, doc) => {
                const modules = doc.data().modules || [];
                if (!modules.includes('presenter')) modules.push('presenter');
                acc[doc.id as UserRole] = modules;
                return acc;
            }, {} as RolePermissions);
            // Ensure super always has all permissions
            fetchedPerms.super = allModuleIds;
            setPermissions(fetchedPerms);
        }
    });

    return () => {
        usersUnsub();
        permsUnsub();
    };
  }, []);

  useEffect(() => {
    fetchUsersAndPermissions();
  }, [fetchUsersAndPermissions]);

  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: '', username: '', email: '', phoneNumber: '', role: 'individual' },
  });


  useEffect(() => {
    if (userToEdit) {
      userForm.reset(userToEdit);
      setIsEditUserOpen(true);
    }
  }, [userToEdit, userForm]);
  
  const handleDeleteUser = async () => {
    if(!userToDelete || userToDelete.id === user?.id) return;
    try {
        await deleteDoc(doc(db, 'users', userToDelete.id));
        toast({ title: 'Success', description: 'User has been deleted.' });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete user.', variant: 'destructive' });
    }
    setUserToDelete(null);
  }

  const handleAddUser = async (values: z.infer<typeof userFormSchema>) => {
    try {
      const usernameQuery = query(collection(db, 'users'), where('username', '==', values.username));
      const emailQuery = query(collection(db, 'users'), where('email', '==', values.email));
      
      const [usernameSnap, emailSnap] = await Promise.all([getDocs(usernameQuery), getDocs(emailQuery)]);

      if (!usernameSnap.empty) {
        toast({ title: 'Error', description: 'Username already exists.', variant: 'destructive' });
        return;
      }
      if (!emailSnap.empty) {
        toast({ title: 'Error', description: 'Email already exists.', variant: 'destructive' });
        return;
      }

      await addDoc(collection(db, 'users'), values);
      setIsAddUserOpen(false);
      userForm.reset();
      setSuccessModalTitle('User Created');
      setSuccessModalMessage(`User "${values.name}" has been added.`);
      setIsSuccessModalOpen(true);

    } catch (error) {
       toast({ title: 'Error', description: 'Failed to add user.', variant: 'destructive' });
    }
  };

  const handleEditUser = async (values: z.infer<typeof userFormSchema>) => {
    if (!userToEdit) return;
    try {
        const userRef = doc(db, 'users', userToEdit.id);
        await updateDoc(userRef, values);
        setIsEditUserOpen(false);
        setUserToEdit(null);
        setSuccessModalTitle('User Updated');
        setSuccessModalMessage('User details have been successfully updated.');
        setIsSuccessModalOpen(true);
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to update user.', variant: 'destructive' });
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const batch = writeBatch(db);
      
      const collectionsToDelete = ['users', 'organizations', 'teams', 'matches', 'tournaments', 'sponsors'];
      for (const collectionName of collectionsToDelete) {
          const snapshot = await getDocs(collection(db, collectionName));
          snapshot.forEach(doc => batch.delete(doc.ref));
      }

      // Add Organizations
      const orgRefs: Record<string, string> = {};
      for (const org of mockOrganizations) {
        const orgRef = doc(collection(db, 'organizations'));
        batch.set(orgRef, org);
        orgRefs[org.name] = orgRef.id;
      }
      
      // Add Users
      mockUsers.forEach(user => {
        const userRef = doc(collection(db, 'users'));
        batch.set(userRef, user);
      });

      // Add Teams
      mockTeams.forEach(team => {
        const teamRef = doc(collection(db, 'teams'));
        const { organizationName, ...teamData } = team;
        batch.set(teamRef, { ...teamData, organizationId: orgRefs[organizationName] });
      });

      await batch.commit();
      toast({ title: 'Database Seeded', description: 'Your database has been reset with mock data.' });
    } catch (error) {
      console.error('Seeding failed:', error);
      toast({ title: 'Seeding Failed', description: 'Could not seed the database.', variant: 'destructive' });
    } finally {
      setIsSeeding(false);
    }
  };
  
  const handlePermissionChange = (role: UserRole, moduleId: string, isChecked: boolean) => {
    setPermissions(prev => {
        const currentModules = prev[role] || [];
        const newModules = isChecked
            ? [...currentModules, moduleId]
            : currentModules.filter(m => m !== moduleId);
        return { ...prev, [role]: [...new Set(newModules)] };
    });
  };

  const handleSavePermissions = async () => {
    setIsSavingPermissions(true);
    try {
        const batch = writeBatch(db);
        Object.entries(permissions).forEach(([role, modules]) => {
            if (role === 'court' || role === 'super') return; // Do not save court or super permissions
            const docRef = doc(db, 'rolePermissions', role);
            batch.set(docRef, { modules });
        });
        await batch.commit();
        toast({ title: 'Permissions Saved', description: 'User role permissions have been updated successfully.' });
    } catch (error) {
        console.error('Failed to save permissions:', error);
        toast({ title: 'Error', description: 'Failed to save permissions.', variant: 'destructive' });
    } finally {
        setIsSavingPermissions(false);
    }
  };


  return (
    <div className="grid gap-8 p-4 md:p-8">
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-3xl font-bold mb-2">System Settings</h1>
                <p className="text-muted-foreground">Manage users, permissions, and the database.</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
                <ArrowLeft className="mr-2" />
                Back to Dashboard
            </Button>
        </div>
        
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Role-Based Access Control</CardTitle>
                    <CardDescription>Define which modules each user role can access. Super users have access to all modules by default.</CardDescription>
                </div>
                <Button onClick={handleSavePermissions} disabled={isSavingPermissions}>
                    {isSavingPermissions ? <Loader2 className="animate-spin" /> : <Save />}
                    Save Permissions
                </Button>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Module</TableHead>
                                {userRoles.map(role => (
                                    <TableHead key={role} className="text-center capitalize">{role}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {appModules.map(module => (
                                <TableRow key={module.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <module.icon className="h-4 w-4" />
                                            {module.label}
                                        </div>
                                    </TableCell>
                                    {userRoles.map(role => (
                                        <TableCell key={role} className="text-center">
                                            <Checkbox
                                                checked={permissions[role]?.includes(module.id)}
                                                onCheckedChange={(checked) => handlePermissionChange(role, module.id, !!checked)}
                                                disabled={role === 'super' || module.id === 'dashboard'}
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
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
                <DialogDescription>Enter the details for the new user account.</DialogDescription>
              </DialogHeader>
              <Form {...userForm}>
                <form onSubmit={userForm.handleSubmit(handleAddUser)} className="space-y-4">
                  <FormField control={userForm.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={userForm.control} name="username" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl><Input placeholder="johndoe" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={userForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={userForm.control} name="phoneNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl><Input type="tel" placeholder="1234567890" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={userForm.control} name="role" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="individual">Individual</SelectItem>
                          <SelectItem value="update">Update User</SelectItem>
                          <SelectItem value="inquiry">Inquiry User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super">Super User</SelectItem>
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
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
              {users.filter(u => u.role !== 'court').map((u) => (
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
                        <DropdownMenuItem onSelect={() => setUserToEdit(u)} disabled={u.id === user?.id}><Edit className="mr-2 h-4 w-4" />Edit user</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={() => setUserToDelete(u)} disabled={u.id === user?.id}>
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
        <CardHeader>
            <CardTitle>Database Management</CardTitle>
            <CardDescription>Use mock data to seed the database for testing and demonstration purposes.</CardDescription>
        </CardHeader>
        <CardContent>
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSeeding}>
                  {isSeeding ? <Loader2 className="animate-spin" /> : <Database className="mr-2" />}
                  Clear and Reseed Database
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete all current data (users, teams, matches, etc.) and replace it with the initial mock data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleSeed} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                    Yes, clear and reseed
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit User: {userToEdit?.name}</DialogTitle>
                <DialogDescription>Update the user's details below.</DialogDescription>
            </DialogHeader>
            <Form {...userForm}>
                <form onSubmit={userForm.handleSubmit(handleEditUser)} className="space-y-4">
                <FormField control={userForm.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={userForm.control} name="username" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl><Input placeholder="johndoe" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={userForm.control} name="email" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" placeholder="john.doe@example.com" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={userForm.control} name="phoneNumber" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl><Input type="tel" placeholder="1234567890" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={userForm.control} name="role" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="individual">Individual</SelectItem>
                                <SelectItem value="update">Update User</SelectItem>
                                <SelectItem value="inquiry">Inquiry User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="super">Super User</SelectItem>
                            </SelectContent>
                        </Select><FormMessage />
                    </FormItem>
                )} />
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => setIsEditUserOpen(false)}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete User Alert */}
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
      
      {/* Success Modal */}
      <AlertDialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <AlertDialogTitle>{successModalTitle}</AlertDialogTitle>
                </div>
                <AlertDialogDescription>
                  {successModalMessage}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogAction onClick={() => setIsSuccessModalOpen(false)}>OK</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
