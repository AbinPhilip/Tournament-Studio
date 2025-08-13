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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { AppData } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function InquiryView() {
  const { user } = useAuth();
  const [data, setData] = useState<AppData[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        const appDataSnap = await getDocs(collection(db, 'appData'));
        setData(appDataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppData)));
    };
    fetchData();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Inquiry Dashboard</h1>
      <p className="text-muted-foreground mb-8">Welcome, {user?.name}. You have read-only access to the data below.</p>
      <Card>
        <CardHeader>
          <CardTitle>Application Data</CardTitle>
          <CardDescription>Browse through the system data records.</CardDescription>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.value}</TableCell>
                  <TableCell>{new Date(item.lastUpdated).toLocaleString()}</TableCell>
                  <TableCell>{item.updatedBy}</TableCell>
                  <TableCell>
                    {item.isFlagged ? (
                      <Badge variant="destructive">Flagged for Review</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
