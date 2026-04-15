import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  orderBy,
  query,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { EventInfo, EventStatus } from '@/types'

function eventsRef() {
  return collection(db, 'events')
}

function toEventInfo(id: string, data: Record<string, unknown>): EventInfo {
  return {
    id,
    name: (data.name as string) || '',
    startDate: (data.startDate as Timestamp)?.toDate() || new Date(),
    endDate: (data.endDate as Timestamp)?.toDate() || new Date(),
    status: (data.status as EventStatus) || 'active',
    settings: {
      boothName: (data.settings as Record<string, unknown>)?.boothName as string || '',
      currency: (data.settings as Record<string, unknown>)?.currency as string || 'JPY',
      taxRate: (data.settings as Record<string, unknown>)?.taxRate as number || 0.10,
    },
  }
}

export const eventService = {
  async listEvents(): Promise<EventInfo[]> {
    const q = query(eventsRef(), orderBy('startDate', 'desc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map((d) => toEventInfo(d.id, d.data()))
  },

  async getEvent(eventId: string): Promise<EventInfo | null> {
    const d = await getDoc(doc(db, 'events', eventId))
    if (!d.exists()) return null
    return toEventInfo(d.id, d.data())
  },

  async createEvent(eventId: string, data: Omit<EventInfo, 'id'>): Promise<void> {
    await setDoc(doc(db, 'events', eventId), {
      name: data.name,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
      status: data.status,
      settings: data.settings,
    })
  },

  async updateEventStatus(eventId: string, status: EventStatus): Promise<void> {
    await updateDoc(doc(db, 'events', eventId), { status })
  },
}
