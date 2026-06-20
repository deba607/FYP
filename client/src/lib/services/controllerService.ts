import { getFirebaseRealtimeDatabase } from '../config/firebaseAdmin';
import { ApiError } from '../utils/errors';
import { updateCrowdFromGateScan } from './crowdService';

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
  museumId: string;
  scannedAt: string;
  outcome: 'granted' | 'denied';
  gateAction: 'entry' | 'exit';
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

export async function registerController(name: string, museumId: string, status: 'active' | 'offline' | 'maintenance' = 'active') {
  if (!name || !name.trim()) {
    throw new ApiError('Device name is required', 400);
  }
  if (!museumId || !museumId.trim()) {
    throw new ApiError('Museum ID is required to register a controller device', 400);
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

export async function getControllerById(id: string) {
  if (!id || !id.trim() || id === 'unknown') {
    throw new ApiError('Controller device ID is required', 400);
  }

  const database = getFirebaseRealtimeDatabase();
  const snapshot = await database.ref(`controllers/${id}`).once('value');

  if (!snapshot.exists()) {
    throw new ApiError('Controller device not found', 404);
  }

  const val = snapshot.val();
  return {
    id: String(val.id || id),
    name: String(val.name || ''),
    museumId: String(val.museumId || ''),
    status: String(val.status || 'offline') as ControllerDevice['status'],
    lastActive: toDateString(val.lastActive),
    createdAt: toDateString(val.createdAt)
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
  message: string,
  gateAction: 'entry' | 'exit' = 'entry',
  device?: Pick<ControllerDevice, 'name' | 'museumId'>
) {
  const database = getFirebaseRealtimeDatabase();
  const scanRef = database.ref('scan_logs').push();
  const id = scanRef.key;
  const now = new Date();

  if (!id) {
    throw new ApiError('Failed to generate scan log key', 500);
  }

  // Retrieve device name for cached display
  let deviceName = device?.name || 'Unknown Device';
  let museumId = device?.museumId || '';
  if (!device && deviceId !== 'unknown' && deviceId) {
    try {
      const devRef = database.ref(`controllers/${deviceId}`);
      const devDoc = await devRef.once('value');
      if (devDoc.exists()) {
        const device = devDoc.val();
        deviceName = String(device?.name || 'Unknown Device');
        museumId = String(device?.museumId || '');
      }
    } catch (err) {
      console.error('Failed to read device details on scan:', err);
    }
  }

  const payload = {
    ticketId: ticketId.trim(),
    deviceId,
    deviceName,
    museumId,
    scannedAt: now.toISOString(),
    outcome,
    gateAction,
    message: message.trim()
  };

  const updates: Record<string, unknown> = {
    [`scan_logs/${id}`]: payload
  };
  if (deviceId !== 'unknown' && deviceId) {
    updates[`controllers/${deviceId}/lastActive`] = now.toISOString();
  }

  await database.ref().update(updates);

  const crowd = outcome === 'granted' && museumId
    ? await updateCrowdFromGateScan(museumId, gateAction, deviceId).catch((error) => {
        console.error('Failed to update crowd insight after granted scan:', error);
        return null;
      })
    : null;

  return {
    success: true,
    log: {
      id,
      ...payload,
      scannedAt: now.toISOString()
    },
    crowd
  };
}

export async function getScanLogs(deviceId?: string) {
  const database = getFirebaseRealtimeDatabase();
  const snapshot = deviceId
    ? await database.ref('scan_logs').orderByChild('deviceId').equalTo(deviceId).limitToLast(500).once('value')
    : await database.ref('scan_logs').orderByChild('scannedAt').limitToLast(500).once('value');

  const list: any[] = [];
  snapshot.forEach((child) => {
    const val = child.val();
    if (!deviceId || val.deviceId === deviceId) {
      list.push({
        id: child.key || '',
        ticketId: String(val.ticketId || ''),
        deviceId: String(val.deviceId || ''),
        deviceName: String(val.deviceName || ''),
        museumId: String(val.museumId || ''),
        scannedAt: toDateString(val.scannedAt),
        outcome: String(val.outcome || 'denied') as ScanLog['outcome'],
        gateAction: String(val.gateAction || 'entry') as ScanLog['gateAction'],
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
