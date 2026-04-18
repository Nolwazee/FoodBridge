import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { AuditLogEntry, UserRole } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FileText, Filter, Search, User, Lock, Package, Flag, BarChart3, LogOut } from 'lucide-react';

interface AuditFilter {
  action: string;
  entityType: string;
  actorRole: string;
}

export default function AuditLogViewer() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [filters, setFilters] = useState<Partial<AuditFilter>>({});

  useEffect(() => {
    const qAudit = query(
      collection(db, 'auditLogs'),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );

    const unsubscribe = onSnapshot(qAudit, (snapshot) => {
      const data = snapshot.docs.map(d => {
        const docData = d.data();
        return {
          id: d.id,
          ...docData,
          createdAt: docData.createdAt,
        } as AuditLogEntry;
      });
      setAuditLogs(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'auditLogs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let filtered = auditLogs;

    if (searchTerm) {
      filtered = filtered.filter(
        log =>
          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.entityId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.actorId?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filters.action && filters.action !== 'all') {
      filtered = filtered.filter(log => log.action === filters.action);
    }

    if (filters.entityType && filters.entityType !== 'all') {
      filtered = filtered.filter(log => log.entityType === filters.entityType);
    }

    if (filters.actorRole && filters.actorRole !== 'all') {
      filtered = filtered.filter(log => log.actorRole === filters.actorRole);
    }

    setFilteredLogs(filtered);
  }, [auditLogs, searchTerm, filters]);

  const getActionIcon = (action: string) => {
    if (action.includes('auth') || action.includes('login')) return <LogOut className="w-4 h-4" />;
    if (action.includes('user') || action.includes('suspension')) return <User className="w-4 h-4" />;
    if (action.includes('document') || action.includes('verify')) return <FileText className="w-4 h-4" />;
    if (action.includes('donation') || action.includes('listing')) return <Package className="w-4 h-4" />;
    if (action.includes('flag')) return <Flag className="w-4 h-4" />;
    if (action.includes('report')) return <BarChart3 className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('reject') || action.includes('deleted') || action.includes('suspended')) return 'bg-red-100 text-red-800';
    if (action.includes('approve') || action.includes('verified') || action.includes('created')) return 'bg-green-100 text-green-800';
    if (action.includes('updated') || action.includes('restored')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'listing':
        return <Package className="w-4 h-4" />;
      case 'flag':
        return <Flag className="w-4 h-4" />;
      case 'report':
        return <BarChart3 className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const uniqueActions = Array.from(new Set(auditLogs.map(log => log.action)));
  const uniqueEntityTypes = Array.from(new Set(auditLogs.map(log => log.entityType)));
  const uniqueRoles = Array.from(new Set(auditLogs.map(log => log.actorRole || 'system')));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Audit Log</h2>
        <Badge variant="outline">Total: {auditLogs.length}</Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-xs">
              <Input
                placeholder="Search by action, entity ID, or actor ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="text-sm font-medium text-gray-700">Action</label>
              <select
                className="mt-1 px-3 py-2 border rounded-md text-sm"
                value={filters.action || 'all'}
                onChange={(e) => setFilters({ ...filters, action: e.target.value || undefined })}
              >
                <option value="all">All Actions</option>
                {uniqueActions.map(action => (
                  <option key={action} value={action}>
                    {action.replace(/_/g, ' ').toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Entity Type</label>
              <select
                className="mt-1 px-3 py-2 border rounded-md text-sm"
                value={filters.entityType || 'all'}
                onChange={(e) => setFilters({ ...filters, entityType: e.target.value || undefined })}
              >
                <option value="all">All Types</option>
                {uniqueEntityTypes.map(type => (
                  <option key={type} value={type}>
                    {type.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Actor Role</label>
              <select
                className="mt-1 px-3 py-2 border rounded-md text-sm"
                value={filters.actorRole || 'all'}
                onChange={(e) => setFilters({ ...filters, actorRole: e.target.value || undefined })}
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>
                    {role.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            <Filter className="w-4 h-4 inline mr-1" />
            Showing {filteredLogs.length} of {auditLogs.length} entries
          </p>
        </CardContent>
      </Card>

      {/* Audit Logs Timeline */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="pt-8 pb-8 text-center text-gray-500">
              No audit logs found
            </CardContent>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card
              key={log.id}
              className="cursor-pointer hover:shadow-md transition"
              onClick={() => setSelectedLog(log)}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {getActionIcon(log.action)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={getActionColor(log.action)}>
                        {log.action.replace(/_/g, ' ').toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="bg-gray-50">
                        {getEntityIcon(log.entityType)}
                        <span className="ml-1">{log.entityType.toUpperCase()}</span>
                      </Badge>
                      {log.actorRole && (
                        <Badge variant="outline">
                          <User className="w-3 h-3 mr-1" />
                          {log.actorRole.toUpperCase()}
                        </Badge>
                      )}
                    </div>

                    <div className="mt-2 space-y-1 text-sm">
                      {log.entityId && (
                        <p className="text-gray-700">
                          <span className="font-semibold">Entity ID:</span> <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{log.entityId}</code>
                        </p>
                      )}
                      {log.actorId && (
                        <p className="text-gray-700">
                          <span className="font-semibold">Actor ID:</span> <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{log.actorId}</code>
                        </p>
                      )}
                      <p className="text-gray-600 text-xs">
                        {new Date(log.createdAt?.toDate?.() || log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        +{Object.keys(log.metadata).length} metadata
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Expanded Log Details */}
      {selectedLog && (
        <Card className="mt-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">Log Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-gray-700">Action</p>
              <p className="text-sm font-mono">{selectedLog.action}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">Entity Type</p>
                <p className="text-sm">{selectedLog.entityType}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Entity ID</p>
                <p className="text-sm font-mono text-xs break-all">{selectedLog.entityId || 'N/A'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold text-gray-700">Actor Role</p>
                <p className="text-sm">{selectedLog.actorRole || 'system'}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Actor ID</p>
                <p className="text-sm font-mono text-xs break-all">{selectedLog.actorId || 'N/A'}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700">Timestamp</p>
              <p className="text-sm">
                {new Date(selectedLog.createdAt?.toDate?.() || selectedLog.createdAt).toLocaleString()}
              </p>
            </div>

            {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Metadata</p>
                <div className="bg-white p-3 rounded border border-gray-200 text-xs">
                  <pre className="overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border rounded hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
