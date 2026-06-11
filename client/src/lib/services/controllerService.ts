import { getFirebaseFirestore } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';

export type ControllerDevice = {
  id: string;
  name: string;
  museumId: string;
  status: 'active' | 'offline' | 'maintenance';
  lastActive: string;
  createdAt: string;
};

export type ScanLog = {
  id: string;
  ticketId: string;
  deviceId: string;
  deviceName: string;
  scannedAt: string;
  outcome: 'granted' | 'denied';
  message: string;
};

function toDateString(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in (value as Record<string, unknown>)) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return new Date().toISOString();
}

export async function registerController(name: string, museumId: string = 'default-museum', status: 'active' | 'offline' | 'maintenance' = 'active') {
  if (!name || !name.trim()) {
    throw new ApiError('Device name is required', 400);
  }

  const firestore = getFirebaseFirestore();
  const deviceRef = firestore.collection('controllers').doc();
  const now = new Date();

  const payload = {
    name: name.trim(),
    museumId: museumId.trim(),
    status,
    lastActive: now,
    createdAt: now
  };

  await deviceRef.set(payload);

  return {
    success: true,
    message: 'Controller registered successfully',
    controller: {
      id: deviceRef.id,
      ...payload,
      lastActive: now.toISOString(),
      createdAt: now.toISOString()
    }
  };
}

export async function getControllers() {
  const firestore = getFirebaseFirestore();
  const snapshot = await firestore.collection('controllers').orderBy('createdAt', 'desc').get();

  const controllers = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: String(data.name || ''),
      museumId: String(data.museumId || ''),
      status: String(data.status || 'offline') as ControllerDevice['status'],
      lastActive: toDateString(data.lastActive),
      createdAt: toDateString(data.createdAt)
    };
  });

  return {
    success: true,
    controllers
  };
}

export async function updateControllerStatus(id: string, status: 'active' | 'offline' | 'maintenance') {
  if (!['active', 'offline', 'maintenance'].includes(status)) {
    throw new ApiError('Invalid status value', 400);
  }

  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection('controllers').doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new ApiError('Controller device not found', 404);
  }

  const now = new Date();
  await docRef.update({
    status,
    lastActive: now
  });

  return {
    success: true,
    message: 'Device status updated',
    controller: {
      id,
      ...doc.data(),
      status,
      lastActive: now.toISOString()
    }
  };
}

export async function deleteController(id: string) {
  const firestore = getFirebaseFirestore();
  const docRef = firestore.collection('controllers').doc(id);
  const doc = await docRef.get();

  if (!doc.exists) {
    throw new ApiError('Controller device not found', 404);
  }

  await docRef.delete();

  return {
    success: true,
    message: 'Device deleted successfully'
  };
}

export async function logScan(
  ticketId: string,
  deviceId: string,
  outcome: 'granted' | 'denied',
  message: string
) {
  const firestore = getFirebaseFirestore();
  const scanRef = firestore.collection('scan_logs').doc();
  const now = new Date();

  // Retrieve device name for cached display
  let deviceName = 'Unknown Device';
  if (deviceId !== 'unknown' && deviceId) {
    try {
      const devDoc = await firestore.collection('controllers').doc(deviceId).get();
      if (devDoc.exists) {
        deviceName = String(devDoc.data()?.name || 'Unknown Device');
        // also touch the device's lastActive status
        await devDoc.ref.update({ lastActive: now });
      }
    } catch (err) {
      console.error('Failed to update device activity on scan:', err);
    }
  }

  const payload = {
    ticketId: ticketId.trim(),
    deviceId,
    deviceName,
    scannedAt: now,
    outcome,
    message: message.trim()
  };

  await scanRef.set(payload);

  return {
    success: true,
    log: {
      id: scanRef.id,
      ...payload,
      scannedAt: now.toISOString()
    }
  };
}

export async function getScanLogs(deviceId?: string) {
  const firestore = getFirebaseFirestore();
  let query = firestore.collection('scan_logs').orderBy('scannedAt', 'desc');

  if (deviceId) {
    query = query.where('deviceId', '==', deviceId);
  }

  const snapshot = await query.limit(100).get();

  const logs = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ticketId: String(data.ticketId || ''),
      deviceId: String(data.deviceId || ''),
      deviceName: String(data.deviceName || ''),
      scannedAt: toDateString(data.scannedAt),
      outcome: String(data.outcome || 'denied') as ScanLog['outcome'],
      message: String(data.message || '')
    };
  });

  return {
    success: true,
    logs
  };
}
