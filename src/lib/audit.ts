import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '@/src/lib/firebase';
import type { AuditLogEntry, UserRole } from '@/src/types';

type AuditInput = Omit<AuditLogEntry, 'id' | 'actorId' | 'createdAt'> & {
  actorId?: string | null;
  actorRole?: UserRole | 'system';
};

export async function logAudit(input: AuditInput) {
  try {
    const actorId = input.actorId ?? auth.currentUser?.uid ?? null;
    const actorRole = input.actorRole ?? 'system';

    await addDoc(collection(db, 'auditLogs'), {
      ...input,
      actorId,
      actorRole,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Audit logging should never block user flows; record details for debugging.
    try {
      handleFirestoreError(error, OperationType.CREATE, 'auditLogs');
    } catch {
      // swallow
    }
  }
}

