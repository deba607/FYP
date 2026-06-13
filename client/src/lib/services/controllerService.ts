import { getFirebaseRealtimeDatabase } from '../config/firebaseAdmin';
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

  const database = getFirebaseRealtimeDatabase();
  const deviceRef = database.ref('controllers').push();
  const id = deviceRef.key;
  const now = new Date();

  if (!id) {
    throw new ApiError('Failed to generate device key', 500);
  }

  const payload = {
    id,
    name: name.trim(),
    museumId: museumId.trim(),
    status,
    lastActive: now.toISOString(),
    createdAt: now.toISOString()
  };

  await deviceRef.set(payload);

  return {
    success: true,
    message: 'Controller registered successfully',
    controller: payload
  };
}

export async function getControllers() {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database.ref('controllers').once('value');

  const list: ControllerDevice[] = [];
  snapshot.forEach((child) => {
    const val = child.val();
    list.push({
      id: child.key || '',
      name: String(val.name || ''),
      museumId: String(val.museumId || ''),
      status: String(val.status || 'offline') as ControllerDevice['status'],
      lastActive: toDateString(val.lastActive),
      createdAt: toDateString(val.createdAt)
    });
  });

  // Sort descending by createdAt
  list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return {
    success: true,
    controllers: list
  };
}

export async function updateControllerStatus(id: string, status: 'active' | 'offline' | 'maintenance') {
  if (!['active', 'offline', 'maintenance'].includes(status)) {
    throw new ApiError('Invalid status value', 400);
  }

  const database = getFirebaseRealtimeDatabase();
  const docRef = database.ref(`controllers/${id}`);
  const doc = await docRef.once('value');

  if (!doc.exists()) {
    throw new ApiError('Controller device not found', 404);
  }

  const now = new Date();
  await docRef.update({
    status,
    lastActive: now.toISOString()
  });

  return {
    success: true,
    message: 'Device status updated',
    controller: {
      id,
      ...doc.val(),
      status,
      lastActive: now.toISOString()
    }
  };
}

export async function deleteController(id: string) {
  const database = getFirebaseRealtimeDatabase();
  const docRef = database.ref(`controllers/${id}`);
  const doc = await docRef.once('value');

  if (!doc.exists()) {
    throw new ApiError('Controller device not found', 404);
  }

  await docRef.remove();

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
  const database = getFirebaseRealtimeDatabase();
  const scanRef = database.ref('scan_logs').push();
  const id = scanRef.key;
  const now = new Date();

  if (!id) {
    throw new ApiError('Failed to generate scan log key', 500);
  }

  // Retrieve device name for cached display
  let deviceName = 'Unknown Device';
  if (deviceId !== 'unknown' && deviceId) {
    try {
      const devRef = database.ref(`controllers/${deviceId}`);
      const devDoc = await devRef.once('value');
      if (devDoc.exists()) {
        deviceName = String(devDoc.val()?.name || 'Unknown Device');
        // also touch the device's lastActive status
        await devRef.update({ lastActive: now.toISOString() });
      }
    } catch (err) {
      console.error('Failed to update device activity on scan:', err);
    }
  }

  const payload = {
    ticketId: ticketId.trim(),
    deviceId,
    deviceName,
    scannedAt: now.toISOString(),
    outcome,
    message: message.trim()
  };

  await scanRef.set(payload);

  return {
    success: true,
    log: {
      id,
      ...payload,
      scannedAt: now.toISOString()
    }
  };
}

export async function getScanLogs(deviceId?: string) {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database.ref('scan_logs').once('value');

  const list: any[] = [];
  snapshot.forEach((child) => {
    const val = child.val();
    if (!deviceId || val.deviceId === deviceId) {
      list.push({
        id: child.key || '',
        ticketId: String(val.ticketId || ''),
        deviceId: String(val.deviceId || ''),
        deviceName: String(val.deviceName || ''),
        scannedAt: toDateString(val.scannedAt),
        outcome: String(val.outcome || 'denied') as ScanLog['outcome'],
        message: String(val.message || '')
      });
    }
  });

  // Sort descending by scannedAt
  list.sort((a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime());

  return {
    success: true,
    logs: list
  };
}
