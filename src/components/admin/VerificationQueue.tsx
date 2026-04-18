import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { NgoDocument, NgoDocumentStatus, NgoDocumentType, UserProfile } from '@/src/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertTriangle, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { logAudit } from '@/src/lib/audit';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const REQUIRED_DOCS: { type: NgoDocumentType; label: string }[] = [
  { type: 'npo_certificate', label: 'NPO Certificate' },
  { type: 'cipc', label: 'CIPC Registration' },
  { type: 'pbo', label: 'PBO Number' },
  { type: 'board_resolution', label: 'Board Resolution' },
  { type: 'bank_confirmation', label: 'Bank Account Confirmation' },
];

export default function VerificationQueue({ adminId }: { adminId: string }) {
  const [pendingNgos, setPendingNgos] = useState<UserProfile[]>([]);
  const [documents, setDocuments] = useState<NgoDocument[]>([]);
  const [expandedNgo, setExpandedNgo] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<NgoDocument | null>(null);
  const [rejectionDialog, setRejectionDialog] = useState<{ open: boolean; docId: string; type: string }>({ open: false, docId: '', type: '' });
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch pending NGOs
    const qUsers = query(
      collection(db, 'users'),
      where('role', '==', 'ngo'),
      where('verificationStatus', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const data = snapshot.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile));
      setPendingNgos(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    // Fetch all NGO documents
    const qDocs = query(
      collection(db, 'ngoDocuments'),
      orderBy('uploadedAt', 'desc')
    );

    const unsubscribeDocs = onSnapshot(qDocs, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as NgoDocument));
      setDocuments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'ngoDocuments');
    });

    return () => {
      unsubscribeUsers();
      unsubscribeDocs();
    };
  }, []);

  const getNgoDocuments = (ngoId: string) => {
    return documents.filter(d => d.ngoId === ngoId);
  };

  const getDocumentStatus = (type: NgoDocumentType, ngoId: string) => {
    const doc = documents.find(d => d.ngoId === ngoId && d.type === type);
    return doc?.status || 'missing';
  };

  const getStatusColor = (status: NgoDocumentStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'in_review':
        return 'bg-yellow-100 text-yellow-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: NgoDocumentStatus) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'in_review':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  const handleApproveDocument = async (docId: string) => {
    try {
      const targetDoc = documents.find((d) => d.id === docId);
      if (!targetDoc) {
        toast.error('Document not found');
        return;
      }

      await updateDoc(doc(db, 'ngoDocuments', docId), {
        status: 'approved',
        reviewedAt: serverTimestamp(),
        reviewedBy: adminId,
      });
      await logAudit({
        action: 'document_approved',
        entityType: 'document',
        entityId: docId,
        metadata: { adminId },
      });

      // If all required docs are approved, auto-verify NGO.
      const ngoDocuments = documents.filter((d) => d.ngoId === targetDoc.ngoId);
      const approvedTypes = new Set(
        ngoDocuments
          .filter((d) => d.status === 'approved' || d.id === docId)
          .map((d) => d.type)
      );
      const allApproved = REQUIRED_DOCS.every((reqDoc) => approvedTypes.has(reqDoc.type));

      if (allApproved) {
        await updateDoc(doc(db, 'users', targetDoc.ngoId), {
          verificationStatus: 'verified',
          isVerified: true,
        });
        await logAudit({
          action: 'ngo_verified',
          entityType: 'user',
          entityId: targetDoc.ngoId,
          metadata: { adminId, source: 'document_approval' },
        });
        toast.success('Document approved. NGO has been verified.');
      } else {
        toast.success('Document approved');
      }
      setSelectedDoc(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ngoDocuments/${docId}`);
    }
  };

  const handleRejectDocument = async () => {
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      await updateDoc(doc(db, 'ngoDocuments', rejectionDialog.docId), {
        status: 'rejected',
        rejectionReason,
        reviewedAt: new Date(),
        reviewedBy: adminId,
      });
      await logAudit({
        action: 'document_rejected',
        entityType: 'document',
        entityId: rejectionDialog.docId,
        metadata: { adminId, reason: rejectionReason },
      });
      toast.success('Document rejected');
      setRejectionDialog({ open: false, docId: '', type: '' });
      setRejectionReason('');
      setSelectedDoc(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `ngoDocuments/${rejectionDialog.docId}`);
    }
  };

  const handleVerifyNgo = async (ngoId: string) => {
    try {
      const ngoDocuments = documents.filter(d => d.ngoId === ngoId);
      const missingRequired = REQUIRED_DOCS.filter(
        (reqDoc) => !ngoDocuments.some((d) => d.type === reqDoc.type)
      );

      if (missingRequired.length > 0) {
        toast.error('All required documents must be uploaded first');
        return;
      }

      // Auto-approve required docs that are uploaded but not yet approved.
      const docsToApprove = ngoDocuments.filter(
        (d) => REQUIRED_DOCS.some((r) => r.type === d.type) && d.status !== 'approved'
      );
      if (docsToApprove.length > 0) {
        await Promise.all(
          docsToApprove.map((d) =>
            updateDoc(doc(db, 'ngoDocuments', d.id), {
              status: 'approved',
              rejectionReason: '',
              reviewedAt: serverTimestamp(),
              reviewedBy: adminId,
            })
          )
        );
      }

      await updateDoc(doc(db, 'users', ngoId), {
        verificationStatus: 'verified',
        isVerified: true,
      });
      await logAudit({
        action: 'ngo_verified',
        entityType: 'user',
        entityId: ngoId,
        metadata: { adminId },
      });
      toast.success('NGO verified successfully');
      setExpandedNgo(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${ngoId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading verification queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Verification Queue</h2>
        <Badge variant="outline">{pendingNgos.length} Pending</Badge>
      </div>

      {pendingNgos.length === 0 ? (
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-gray-500">
            No pending verifications
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingNgos.map((ngo) => (
            <Card key={ngo.uid} className="cursor-pointer hover:shadow-md transition">
              <CardHeader
                onClick={() => setExpandedNgo(expandedNgo === ngo.uid ? null : ngo.uid)}
                className="pb-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {expandedNgo === ngo.uid ? (
                      <ChevronUp className="w-5 h-5" />
                    ) : (
                      <ChevronDown className="w-5 h-5" />
                    )}
                    <div>
                      <CardTitle>{ngo.organizationName}</CardTitle>
                      <p className="text-sm text-gray-600">{ngo.email}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {expandedNgo === ngo.uid && (
                <CardContent className="space-y-4 border-t pt-4">
                  <div>
                    <h4 className="font-semibold mb-2">Required Documents</h4>
                    <div className="space-y-2">
                      {REQUIRED_DOCS.map((reqDoc) => {
                        const status = getDocumentStatus(reqDoc.type, ngo.uid);
                        const doc = documents.find(d => d.ngoId === ngo.uid && d.type === reqDoc.type);
                        return (
                          <div key={reqDoc.type} className="flex items-center gap-3">
                            {getStatusIcon(status as NgoDocumentStatus)}
                            <span className="flex-1">{reqDoc.label}</span>
                            <Badge className={getStatusColor(status as NgoDocumentStatus)}>
                              {status}
                            </Badge>
                            {doc && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedDoc(doc)}
                              >
                                View
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-4 border-t flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setRejectionDialog({ 
                        open: true, 
                        docId: ngo.uid, 
                        type: 'ngo_rejection' 
                      })}
                    >
                      Reject NGO
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700"
                      size="sm"
                      onClick={() => handleVerifyNgo(ngo.uid)}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Verify NGO
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Document Viewer Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedDoc?.fileName}</DialogTitle>
            <DialogDescription>
              Document Type: {selectedDoc?.type} | Status: {selectedDoc?.status}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedDoc?.fileUrl && (
              <div className="border rounded p-4">
                <iframe
                  src={selectedDoc.fileUrl}
                  className="w-full h-96"
                  title="Document Preview"
                />
              </div>
            )}

            {selectedDoc?.rejectionReason && (
              <div className="bg-red-50 p-3 rounded border border-red-200">
                <p className="text-sm font-semibold text-red-900">Rejection Reason:</p>
                <p className="text-sm text-red-800">{selectedDoc.rejectionReason}</p>
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t">
              {selectedDoc?.status === 'submitted' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setRejectionDialog({
                      open: true,
                      docId: selectedDoc.id,
                      type: selectedDoc.type,
                    })}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApproveDocument(selectedDoc.id)}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Reason Dialog */}
      <Dialog
        open={rejectionDialog.open}
        onOpenChange={(open) =>
          setRejectionDialog({ ...rejectionDialog, open })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejection Reason</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this {rejectionDialog.type === 'ngo_rejection' ? 'NGO verification' : 'document'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <textarea
                className="w-full p-2 border rounded mt-1"
                rows={4}
                placeholder="Enter rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setRejectionDialog({ open: false, docId: '', type: '' });
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectDocument}
              >
                Confirm Rejection
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
