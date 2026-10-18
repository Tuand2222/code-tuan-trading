import { z } from 'zod';
import { checklistRules } from '../selectors/playbook';
const timezone = z.string().refine(s=>{try{new Intl.DateTimeFormat('en',{timeZone:s});return true;}catch{return false;}},'Múi giờ không hợp lệ');
const nonnegative = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/);
export const settingsSchema = z.object({
  timezone: timezone.optional(), defaultFX: nonnegative.refine(s=>Number(s)>0&&Number.isFinite(Number(s))).optional(),
  breakevenBandVND: nonnegative.optional(), plannedDrawdownVND: nonnegative.optional(),
  disciplineThreshold:z.number().min(0).max(100).optional(),minimumSample:z.number().int().min(20).optional(),staleDays:z.number().int().positive().optional(),
  journalNotes:z.record(z.string(),z.string()).optional(),
  playbooks:z.array(z.object({name:z.string().min(1),description:z.string(),checklist:z.string().refine(s=>{try{checklistRules(s);return true;}catch{return false;}}),validFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)})).optional(),
  sessions:z.array(z.object({name:z.string().min(1),market:z.enum(['stock','crypto','forex','commodity','all']),start:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),timezone})).optional(),
  sourcePreferences:z.record(z.string(),z.enum(['confirm-overlaps','prefer-fills','prefer-reports'])).optional(),
}).passthrough();
