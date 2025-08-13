"use client";

import { useState, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { AppData } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { Pencil } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function UpdateUserView() {
  const { user } = useAuth();
  const [data, setData] = useState<AppData[]>([]);
  const [selectedItem, setSelectedItem] = useState<AppData | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
        const appDataSnap = await getDocs(collection(db, 'appData'));
        setData(appDataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppData)));
    };
    fetchData();
  }, []);

  const handleEditClick = (item: AppData) => {
    setSelectedItem(item);
    setEditValue(item.value);
    setIsDialogOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedItem || !user) return;
    
    let isFlagged = selectedItem.isFlagged;
    
    const originalNumericValue = parseFloat(selectedItem.value);
    const newNumericValue = parseFloat(editValue);

    if (!isNaN(originalNumericValue) && !isNaN(newNumericValue) && originalNumericValue !== 0) {
      const changePercentage = Math.abs((newNumericValue - originalNumericValue) / originalNumericValue);
      if (changePercentage > 0.20) {
        isFlagged = true;
        toast({
            title: "Data Flagged for Review",
            description: `Change of ${Math.round(changePercentage * 100)}% exceeded the 20% threshold.`,
            variant: "default",
        });
      }
    }
    
    const updatedItemData = {
        value: editValue,
        lastUpdated: new Date().toISOString(),
        updatedBy: user.name,
        isFlagged,
    };

    try {
        await updateDoc(doc(db, 'appData', selectedItem.id as string), updatedItemData);
        
        const updatedData = data.map((item) =>
          item.id === selectedItem.id ? { ...item, ...updatedItemData } : item
        );
        setData(updatedData);

        toast({
            title: "Update Successful",
            description: `"${selectedItem.name}" has been updated by ${user.name}.`,
        });
    } catch (error) {
        toast({
            title: "Update Failed",
            description: "An error occurred while saving changes.",
            variant: "destructive",
        });
    }
    
    setIsDialogOpen(false);
    setSelectedItem(null);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Data Update Dashboard</h1>
      <p className="text-muted-foreground mb-8">Welcome, {user?.name}. You can modify data records below.</p>
      <Card>
        <CardHeader>
          <CardTitle>Application Data</CardTitle>
          <CardDescription>Select a record to update its value.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Point</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Updated By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id} className={item.isFlagged ? 'bg-destructive/10' : ''}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.value}</TableCell>
                  <TableCell>{new Date(item.lastUpdated).toLocaleString()}</TableCell>
                  <TableCell>{item.updatedBy}</TableCell>
                  <TableCell>
                    {item.isFlagged ? (
                      <Badge variant="destructive">Flagged</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit: {selectedItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="value" className="text-right">
                Value
              </Label>
              <Input
                id="value"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSaveChanges}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
