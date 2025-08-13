"use client";

import { useState, useEffect } from 'react';
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
import type { User, UserRole, Team, Organization } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { MoreHorizontal, Trash2, UserPlus, Users as TeamsIcon, Building, PlusCircle, Database, Upload, Trophy } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import Link from 'next/link';
import { sendWelcomeEmail } from '@/ai/flows/send-welcome-email-flow';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

function RoleBadge({ role }: { role: UserRole }) {
    const variant: BadgeProps["variant"] = {
        admin: "destructive",
        super: "destructive",
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
  role: z.enum(['individual', 'update', 'admin', 'inquiry', 'super']),
});

const organizationFormSchema = z.object({
    name: z.string().min(2, { message: "Organization name must be at least 2 characters." }),
    location: z.string().min(2, { message: "Location is required." }),
});

const teamFormSchema = z.object({
  type: z.enum(['singles', 'mens_doubles', 'womens_doubles', 'mixed_doubles']),
  player1Name: z.string().min(2, "Player 1 name is required."),
  player2Name: z.string().optional(),
  genderP1: z.enum(['male', 'female']).optional(),
  genderP2: z.enum(['male', 'female']).optional(),
  organizationId: z.string({ required_error: "Organization is required." }),
}).refine(data => {
    if (data.type === 'mens_doubles' || data.type === 'womens_doubles' || data.type === 'mixed_doubles') {
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
    message: "Player 1 gender is required for Mixed Doubles.",
    path: ["genderP1"],
}).refine(data => {
    if (data.type === 'mixed_doubles') {
        return !!data.genderP2;
    }
    return true;
}, {
    message: "Player 2 gender is required for Mixed Doubles.",
    path: ["genderP2"],
}).refine(data => {
    if (data.type === 'mixed_doubles') {
        return data.genderP1 !== data.genderP2;
    }
    return true;
}, {
    message: "Players must have different genders for Mixed Doubles.",
    path: ["genderP2"],
});


export default function AdminView() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isAddTeamOpen, setIsAddTeamOpen] = useState(false);
  const [isAddOrgOpen, setIsAddOrgOpen] = useState(false);

  const fetchData = async () => {
    const [usersSnap, teamsSnap, orgsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'teams')),
        getDocs(collection(db, 'organizations')),
    ]);
    setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    setTeams(teamsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Team)));
    setOrganizations(orgsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization)));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { name: '', username: '', email: '', phoneNumber: '', role: 'individual' },
  });

  const orgForm = useForm<z.infer<typeof organizationFormSchema>>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: { name: '', location: '' },
  });

  const teamForm = useForm<z.infer<typeof teamFormSchema>>({
    resolver: zodResolver(teamFormSchema),
    defaultValues: { type: 'singles', player1Name: '', player2Name: '' },
  });

  const teamType = teamForm.watch('type');

  const handleDeleteUser = async () => {
    if(!userToDelete || userToDelete.id === user?.id) return;
    try {
        await deleteDoc(doc(db, 'users', userToDelete.id));
        setUsers(users.filter(u => u.id !== userToDelete.id));
        toast({ title: 'Success', description: 'User has been deleted.' });
    } catch (error) {
        toast({ title: 'Error', description: 'Failed to delete user.', variant: 'destructive' });
    }
    setUserToDelete(null);
  }

  const handleAddUser = async (values: z.infer<typeof userFormSchema>) => {
    try {
      const userExistsQuery = query(collection(db, 'users'), where('username', '==', values.username));
      const userExistsSnap = await getDocs(userExistsQuery);
      if (!userExistsSnap.empty) {
        toast({ title: 'Error', description: 'Username already exists.', variant: 'destructive' });
        return;
      }

      const newUserDoc = await addDoc(collection(db, 'users'), values);
      const newUser: User = { id: newUserDoc.id, ...values, role: values.role as UserRole };
      setUsers([...users, newUser]);
      toast({ title: 'User Created', description: `User "${newUser.name}" has been added.` });
      
      // Send welcome email
      try {
        await sendWelcomeEmail({
          ...values,
          appUrl: window.location.origin
        });
        toast({ title: 'Email Sent', description: `A welcome email has been sent to ${values.name}.` });
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        toast({ title: 'Email Failed', description: 'User was created, but the welcome email could not be sent.', variant: 'destructive' });
      }

      setIsAddUserOpen(false);
      userForm.reset();
    } catch (error) {
       toast({ title: 'Error', description: 'Failed to add user.', variant: 'destructive' });
    }
  };

  const handleAddOrg = async (values: z.infer<typeof organizationFormSchema>) => {
    try {
        const newOrgDoc = await addDoc(collection(db, 'organizations'), values);
        const newOrg: Organization = { id: newOrgDoc.id, ...values };
        setOrganizations([...organizations, newOrg]);
        toast({ title: 'Organization Created', description: `Organization "${newOrg.name}" has been added.` });
        setIsAddOrgOpen(false);
        orgForm.reset();
    } catch(error) {
        toast({ title: 'Error', description: 'Failed to create organization.', variant: 'destructive' });
    }
  };
  
  const handleAddTeam = async (values: z.infer<typeof teamFormSchema>) => {
    try {
        const teamData: Omit<Team, 'id' | 'photoUrl'> = {
          type: values.type,
          player1Name: values.player1Name,
          player2Name: values.type !== 'singles' ? values.player2Name : undefined,
          genderP1: values.type === 'mixed_doubles' ? values.genderP1 : undefined,
          genderP2: values.type === 'mixed_doubles' ? values.genderP2 : undefined,
          organizationId: values.organizationId,
        };
        const newTeamDoc = await addDoc(collection(db, 'teams'), teamData);
        const newTeam = { id: newTeamDoc.id, ...teamData };
        setTeams([...teams, newTeam as Team]);
        toast({
          title: 'Team Registered',
          description: `Team "${teamData.player1Name}${teamData.player2Name ? ' & ' + teamData.player2Name : ''}" has been registered.`,
        });
        setIsAddTeamOpen(false);
        teamForm.reset();
    } catch(error) {
        toast({ title: 'Error', description: 'Failed to register team.', variant: 'destructive' });
    }
  };
  
  const getOrgName = (orgId: string) => organizations.find(o => o.id === orgId)?.name || 'N/A';

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Administrator Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.name}. Manage users, teams, and system settings.</p>
      </div>

      <Tabs defaultValue="teams">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="teams">Team & Org Management</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="settings">System Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="teams">
          <div className="grid gap-8 mt-4">
             <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Organization Management</CardTitle>
                    <CardDescription>Create and manage organizations.</CardDescription>
                </div>
                <Dialog open={isAddOrgOpen} onOpenChange={setIsAddOrgOpen}>
                    <DialogTrigger asChild>
                    <Button>
                        <Building className="mr-2 h-4 w-4" />
                        Create Organization
                    </Button>
                    </DialogTrigger>
                    <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Organization</DialogTitle>
                    </DialogHeader>
                    <Form {...orgForm}>
                        <form onSubmit={orgForm.handleSubmit(handleAddOrg)} className="space-y-4">
                        <FormField control={orgForm.control} name="name" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Organization Name</FormLabel>
                                <FormControl><Input placeholder="e.g. Premier Badminton Club" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={orgForm.control} name="location" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Location</FormLabel>
                                <FormControl><Input placeholder="e.g. New York, USA" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                            <Button type="submit">Create Organization</Button>
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
                            <TableHead>Organization</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead><span className="sr-only">Actions</span></TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {organizations.map((org) => (
                            <TableRow key={org.id}>
                            <TableCell className="font-medium">{org.name}</TableCell>
                            <TableCell>{org.location}</TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem disabled>Edit</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" disabled>Delete</DropdownMenuItem>
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
                    <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Register New Team</DialogTitle>
                        <DialogDescription>Enter the details for the new team.</DialogDescription>
                    </DialogHeader>
                    <Form {...teamForm}>
                        <form onSubmit={teamForm.handleSubmit(handleAddTeam)} className="space-y-4">
                        <FormField control={teamForm.control} name="type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Event Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select an event type" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        <SelectItem value="singles">Singles</SelectItem>
                                        <SelectItem value="mens_doubles">Men's Doubles</SelectItem>
                                        <SelectItem value="womens_doubles">Women's Doubles</SelectItem>
                                        <SelectItem value="mixed_doubles">Mixed Doubles</SelectItem>
                                    </SelectContent>
                                </Select><FormMessage />
                            </FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={teamForm.control} name="player1Name" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{teamType === 'singles' ? 'Player Name' : 'Player 1 Name'}</FormLabel>
                                    <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             {teamType === 'mixed_doubles' && (
                                <FormField control={teamForm.control} name="genderP1" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Player 1 Gender</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value="male">Male</SelectItem>
                                            <SelectItem value="female">Female</SelectItem>
                                        </SelectContent>
                                        </Select><FormMessage />
                                    </FormItem>
                                )} />
                            )}
                        </div>
                        
                        {(teamType === 'mens_doubles' || teamType === 'mixed_doubles' || teamType === 'womens_doubles') && (
                             <div className="grid grid-cols-2 gap-4">
                                <FormField control={teamForm.control} name="player2Name" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Player 2 Name</FormLabel>
                                        <FormControl><Input placeholder="Partner's Name" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                {teamType === 'mixed_doubles' && (
                                    <FormField control={teamForm.control} name="genderP2" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Player 2 Gender</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="male">Male</SelectItem>
                                                <SelectItem value="female">Female</SelectItem>
                                            </SelectContent>
                                            </Select><FormMessage />
                                        </FormItem>
                                    )} />
                                )}
                            </div>
                        )}
                        
                        <FormField control={teamForm.control} name="organizationId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Organization</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select an organization" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {organizations.map(org => <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>)}
                                    </SelectContent>
                                </Select><FormMessage />
                            </FormItem>
                        )} />

                        <FormItem>
                          <FormLabel>Team Photo</FormLabel>
                          <div className="flex items-center gap-4">
                            <div className="h-24 w-24 bg-muted rounded-md flex items-center justify-center">
                              <Image data-ai-hint="badminton duo" src="https://placehold.co/96x96.png" width={96} height={96} alt="Team photo placeholder" className="rounded-md" />
                            </div>
                            <Button type="button" variant="outline" disabled>
                              <Upload className="mr-2 h-4 w-4" />
                              Upload (coming soon)
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>

                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
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
                        <TableHead>Photo</TableHead>
                        <TableHead>Event</TableHead>
                        <TableHead>Players</TableHead>
                        <TableHead>Organization</TableHead>
                        <TableHead><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {teams.map((t) => (
                        <TableRow key={t.id}>
                        <TableCell>
                           <Image 
                                data-ai-hint="badminton players"
                                src={t.photoUrl || 'https://placehold.co/40x40.png'} 
                                alt="Team photo" 
                                width={40} 
                                height={40} 
                                className="rounded-full"
                            />
                        </TableCell>
                        <TableCell className="font-medium capitalize">{t.type.replace('_', ' ')}</TableCell>
                        <TableCell>{t.player1Name}{t.player2Name ? ` & ${t.player2Name}`: ''}</TableCell>
                        <TableCell>{getOrgName(t.organizationId)}</TableCell>
                        <TableCell className="text-right">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem disabled>Edit</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" disabled>Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="users">
            <Card className="mt-4">
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
        </TabsContent>
        <TabsContent value="settings">
            <div className="grid gap-4 mt-4">
                <Card>
                    <CardHeader>
                        <CardTitle>Tournament Management</CardTitle>
                        <CardDescription>Configure the settings for the upcoming tournament.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => router.push('/dashboard/tournament')}>
                            <Trophy className="mr-2 h-4 w-4" /> Go to Tournament Page
                        </Button>
                    </CardContent>
                </Card>
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
                 <Card>
                    <CardHeader>
                        <CardTitle>Database Management</CardTitle>
                        <CardDescription>Seed the database with initial mock data.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Link href="/dashboard/seed-database">
                           <Button><Database className="mr-2"/> Seed Database</Button>
                        </Link>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>
      
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

    </div>
  );
}

    