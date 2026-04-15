import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/firebase'
import type { SalesReport } from '@/types'

function reportsRef(eventId: string) {
  return collection(db, 'events', eventId, 'reports')
}

export const reportService = {
  async saveReport(eventId: string, report: Omit<SalesReport, 'id'>): Promise<string> {
    const docRef = await addDoc(reportsRef(eventId), {
      ...report,
      sentAt: Timestamp.fromDate(report.sentAt),
    })
    return docRef.id
  },

  listenReports(eventId: string, callback: (reports: SalesReport[]) => void): () => void {
    const q = query(reportsRef(eventId), orderBy('sentAt', 'desc'))
    return onSnapshot(q, (snapshot) => {
      const reports: SalesReport[] = snapshot.docs.map((d) => {
        const data = d.data()
        return {
          ...data,
          id: d.id,
          sentAt: data.sentAt?.toDate() || new Date(),
        } as SalesReport
      })
      callback(reports)
    })
  },
}
