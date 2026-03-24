import { MemoryRecord } from '../types';
import { getEmbeddings } from './aiService';
import { archiveLocalMemories } from './indexedDBService';

export const UNSAVED_RAG_KEY = '__UNSAVED__';

type PreparedMemory = {
  timeline_id: string;
  scp_number: string;
  content: string;
  embedding: number[];
  role: string;
  turn_number: number;
  tags?: any;
};

type PendingBatch = {
  scp_number: string;
  role: string;
  prepared: PreparedMemory[];
};

const pendingByKey = new Map<string, PendingBatch>();

const cosineSimilarity = (a: number[], b: number[]) => {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export const stageRagMemories = async (key: string | undefined, batch: { scp_number: string; role: string; records: MemoryRecord[] }) => {
  const finalKey = key || UNSAVED_RAG_KEY;
  const records = (batch.records || []).filter(r => r && r.summary && r.summary.trim().length > 0);
  if (records.length === 0) return { error: null };

  const summaries = records.map(r => (r.summary || '').trim());
  const embeddings = await getEmbeddings(summaries);
  if (!embeddings || embeddings.length !== summaries.length) {
    return { error: new Error('Failed to generate embeddings for staged memories') };
  }

  const prepared: PreparedMemory[] = records.map((r, i) => ({
    timeline_id: finalKey,
    scp_number: batch.scp_number || 'UNKNOWN',
    content: (r.summary || '').trim(),
    embedding: embeddings[i],
    role: batch.role || 'UNKNOWN',
    turn_number: r.turn,
    tags: { keywords: r.keywords, source: 'ai_summary' }
  }));

  pendingByKey.set(finalKey, { scp_number: batch.scp_number, role: batch.role, prepared });
  return { error: null };
};

export const hasStagedRagMemories = (key: string | undefined) => {
  const finalKey = key || UNSAVED_RAG_KEY;
  return pendingByKey.has(finalKey);
};

export const searchStagedRagMemories = (
  queryEmbedding: number[],
  timelineId: string,
  recentIds: Set<string>,
  threshold = 0.75,
  limit = 3
) => {
  const batch = pendingByKey.get(timelineId);
  if (!batch) return [];

  const scored = batch.prepared
    .map(m => ({
      id: `staged:${timelineId}:${m.scp_number}:${m.turn_number}`,
      content: m.content,
      role: m.role,
      scp_number: m.scp_number,
      score: cosineSimilarity(queryEmbedding, m.embedding)
    }))
    .filter(x => x.score >= threshold && !recentIds.has(x.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));

  return scored;
};

export const flushStagedRagMemoriesToTimeline = async (sourceKey: string | undefined, targetTimelineId: string) => {
  const fromKey = sourceKey || UNSAVED_RAG_KEY;
  const batch = pendingByKey.get(fromKey);
  if (!batch) return { payload: [], error: null };
  pendingByKey.delete(fromKey);

  const payload = batch.prepared.map(m => ({ ...m, timeline_id: targetTimelineId }));

  const { error } = await archiveLocalMemories(payload);
  if (error) return { payload, error };
  return { payload, error: null };
};
