#!/usr/bin/env node
/**
 * Generates supabase/migrations/20260609160000_bms_brain_system_standards.sql
 * Run: node scripts/generate-bms-system-standards-migration.mjs
 */

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = join(__dirname, '../supabase/migrations/20260609160000_bms_brain_system_standards.sql')

const ROLE_VAR = {
  operator: 'r_operator',
  cell: 'r_cell',
  plant: 'r_plant',
  site: 'r_site',
  support: 'r_support',
  maintenance: 'r_maint',
}

const FORUM_VAR = {
  swp: 'f_swp',
  p2p: 'f_p2p',
  'shift-dds': 'f_shift',
  'line-dds': 'f_line',
  'site-dds': 'f_site',
  wds: 'f_wds',
  pdca: 'f_pdca',
  'ips-review': 'f_ips_review',
  'weekly-maintenance-planning': 'f_weekly_maint',
  'bde-review': 'f_bde_review',
}

const SYSTEM_VAR = {
  cil: 's_cil',
  dh: 's_dh',
  bde: 's_bde',
  ips: 's_ips',
  mps: 's_mps',
  triggers: 's_triggers',
  cl: 's_cl',
}

function node(id, kind, label, opts = {}) {
  return { id, kind, label, ...opts }
}

function edge(id, source, target, label) {
  return { id, source, target, ...(label ? { label } : {}) }
}

function flow(nodes, edges) {
  return { nodes, edges }
}

// --- CIL ---
const cil = flow(
  [
    node('n-cil-1', 'start', 'CIL task becomes due', {
      description: 'Trigger: scheduled task, PftD task or manual request.',
      role: 'operator',
      forum: 'swp',
      systems: ['cil'],
      owner: 'Operator',
      inputs: 'Plan 24 schedule, PftD task or manual request',
      pos: [40, 40],
    }),
    node('n-cil-2', 'process', 'Complete cleaning, inspection and lubrication task', {
      role: 'operator',
      forum: 'swp',
      systems: ['cil'],
      pos: [40, 120],
    }),
    node('n-cil-3', 'process', 'Record completion, readings, comments and evidence', {
      role: 'operator',
      forum: 'swp',
      systems: ['cil'],
      pos: [40, 200],
    }),
    node('n-cil-4', 'decision', 'Was an abnormal condition identified?', {
      role: 'operator',
      forum: 'swp',
      systems: ['cil'],
      pos: [40, 280],
    }),
    node('n-cil-5y', 'end', 'Complete CIL task', {
      role: 'operator',
      forum: 'swp',
      systems: ['cil'],
      pos: [40, 380],
    }),
    node('n-cil-5n', 'process', 'Record abnormal condition', {
      role: 'operator',
      forum: 'swp',
      systems: ['cil'],
      pos: [240, 280],
    }),
    node('n-cil-6', 'process', 'Create linked defect', {
      role: 'operator',
      forum: 'swp',
      systems: ['cil', 'dh'],
      pos: [240, 360],
    }),
    node('n-cil-7', 'decision', 'Can the condition be safely restored immediately?', {
      role: 'operator',
      forum: 'swp',
      systems: ['cil', 'dh'],
      pos: [240, 440],
    }),
    node('n-cil-8ry', 'process', 'Restore condition and record action', {
      role: 'operator',
      forum: 'swp',
      systems: ['cil', 'dh'],
      pos: [240, 540],
    }),
    node('n-cil-9ry', 'review', 'Verify condition', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['cil', 'dh'],
      pos: [240, 640],
    }),
    node('n-cil-10ry', 'decision', 'Is the condition restored?', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['cil', 'dh'],
      pos: [240, 740],
    }),
    node('n-cil-11ry', 'end', 'Close linked defect', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['cil', 'dh'],
      pos: [240, 840],
    }),
    node('n-cil-8nr', 'review', 'Review defect priority and risk', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [460, 440],
    }),
    node('n-cil-9nr', 'process', 'Assign owner and due date', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [460, 520],
    }),
    node('n-cil-rda', 'review', 'Review defect and assign corrective action', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [460, 740],
    }),
    node('n-cil-10m', 'decision', 'Is maintenance support required?', {
      role: 'cell',
      forum: 'line-dds',
      systems: ['dh', 'mps'],
      pos: [460, 600],
    }),
    node('n-cil-11my', 'subprocess', 'Create maintenance work request', {
      role: 'maintenance',
      forum: 'weekly-maintenance-planning',
      systems: ['dh', 'mps'],
      subprocess: 'mps',
      pos: [680, 520],
    }),
    node('n-cil-12my', 'process', 'Complete maintenance work', {
      role: 'maintenance',
      forum: 'swp',
      systems: ['dh', 'mps'],
      pos: [680, 620],
    }),
    node('n-cil-11mn', 'process', 'Complete operational corrective action', {
      role: 'cell',
      forum: 'swp',
      systems: ['dh'],
      pos: [680, 700],
    }),
    node('n-cil-12mn', 'review', 'Verify defect resolution', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [680, 800],
    }),
    node('n-cil-13', 'decision', 'Is the defect resolved?', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [680, 900],
    }),
    node('n-cil-14y', 'end', 'Close defect', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['cil', 'dh'],
      pos: [680, 1000],
    }),
    node('n-cil-14n', 'decision', 'Is the defect recurring, critical or overdue?', {
      role: 'plant',
      forum: 'line-dds',
      systems: ['dh', 'ips'],
      pos: [900, 900],
    }),
    node('n-cil-15cy', 'subprocess', 'Create linked IPS', {
      role: 'plant',
      forum: 'ips-review',
      systems: ['cil', 'dh', 'ips'],
      subprocess: 'ips',
      pos: [900, 780],
    }),
    node('n-cil-15cn', 'process', 'Reassign corrective action', {
      role: 'cell',
      forum: 'line-dds',
      systems: ['dh'],
      pos: [900, 1000],
    }),
  ],
  [
    edge('e-cil-1', 'n-cil-1', 'n-cil-2'),
    edge('e-cil-2', 'n-cil-2', 'n-cil-3'),
    edge('e-cil-3', 'n-cil-3', 'n-cil-4'),
    edge('e-cil-4', 'n-cil-4', 'n-cil-5y', 'No'),
    edge('e-cil-5', 'n-cil-4', 'n-cil-5n', 'Yes'),
    edge('e-cil-6', 'n-cil-5n', 'n-cil-6'),
    edge('e-cil-7', 'n-cil-6', 'n-cil-7'),
    edge('e-cil-8', 'n-cil-7', 'n-cil-8ry', 'Yes'),
    edge('e-cil-9', 'n-cil-7', 'n-cil-8nr', 'No'),
    edge('e-cil-10', 'n-cil-8ry', 'n-cil-9ry'),
    edge('e-cil-11', 'n-cil-9ry', 'n-cil-10ry'),
    edge('e-cil-12', 'n-cil-10ry', 'n-cil-11ry', 'Yes'),
    edge('e-cil-13', 'n-cil-10ry', 'n-cil-rda', 'No'),
    edge('e-cil-14', 'n-cil-8nr', 'n-cil-9nr'),
    edge('e-cil-15', 'n-cil-9nr', 'n-cil-10m'),
    edge('e-cil-16', 'n-cil-rda', 'n-cil-10m'),
    edge('e-cil-17', 'n-cil-10m', 'n-cil-11my', 'Yes'),
    edge('e-cil-18', 'n-cil-10m', 'n-cil-11mn', 'No'),
    edge('e-cil-19', 'n-cil-11my', 'n-cil-12my'),
    edge('e-cil-20', 'n-cil-12my', 'n-cil-13'),
    edge('e-cil-21', 'n-cil-11mn', 'n-cil-12mn'),
    edge('e-cil-22', 'n-cil-12mn', 'n-cil-13'),
    edge('e-cil-23', 'n-cil-13', 'n-cil-14y', 'Yes'),
    edge('e-cil-24', 'n-cil-13', 'n-cil-14n', 'No'),
    edge('e-cil-25', 'n-cil-14n', 'n-cil-15cy', 'Yes'),
    edge('e-cil-26', 'n-cil-14n', 'n-cil-15cn', 'No'),
  ],
)

// --- DH ---
const dh = flow(
  [
    node('n-dh-1', 'start', 'Defect identified', {
      description: 'Trigger: CIL finding, inspection, failed check, breakdown, audit or manual identification.',
      role: 'operator',
      forum: 'swp',
      systems: ['dh'],
      pos: [40, 40],
    }),
    node('n-dh-2', 'process', 'Record defect details', {
      description: 'Record equipment, location, description, source, image, risk and comments.',
      role: 'operator',
      forum: 'swp',
      systems: ['dh'],
      pos: [40, 120],
    }),
    node('n-dh-3', 'process', 'Assign default equipment owner', {
      description: 'System assigns default equipment owner in Shift DDS.',
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [40, 200],
    }),
    node('n-dh-4', 'review', 'Review defect severity and priority', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [40, 280],
    }),
    node('n-dh-5', 'decision', 'Is there an immediate safety, quality or production risk?', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [40, 360],
    }),
    node('n-dh-6y', 'process', 'Make condition safe', {
      role: 'operator',
      forum: 'swp',
      systems: ['dh'],
      pos: [240, 360],
    }),
    node('n-dh-7y', 'process', 'Escalate critical defect', {
      role: 'plant',
      forum: 'site-dds',
      systems: ['dh'],
      pos: [240, 460],
    }),
    node('n-dh-8y', 'process', 'Assign immediate response', {
      role: 'plant',
      forum: 'site-dds',
      systems: ['dh'],
      pos: [240, 560],
    }),
    node('n-dh-6n', 'process', 'Assign corrective action, owner and due date', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [460, 360],
    }),
    node('n-dh-7n', 'decision', 'Is maintenance work required?', {
      role: 'cell',
      forum: 'line-dds',
      systems: ['dh', 'mps'],
      pos: [460, 460],
    }),
    node('n-dh-8my', 'subprocess', 'Create linked maintenance work request', {
      role: 'maintenance',
      forum: 'weekly-maintenance-planning',
      systems: ['dh', 'mps'],
      subprocess: 'mps',
      pos: [680, 400],
    }),
    node('n-dh-9my', 'process', 'Plan and execute maintenance work', {
      role: 'maintenance',
      forum: 'swp',
      systems: ['dh', 'mps'],
      pos: [680, 500],
    }),
    node('n-dh-8mn', 'process', 'Complete operational corrective action', {
      role: 'cell',
      forum: 'swp',
      systems: ['dh'],
      pos: [680, 580],
    }),
    node('n-dh-9mn', 'process', 'Record action completion and evidence', {
      role: 'operator',
      forum: 'swp',
      systems: ['dh'],
      owner: 'Action owner',
      pos: [680, 680],
    }),
    node('n-dh-10', 'review', 'Verify defect resolution', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [680, 780],
    }),
    node('n-dh-11', 'decision', 'Is the defect fully resolved?', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [680, 880],
    }),
    node('n-dh-12y', 'end', 'Close defect', {
      role: 'cell',
      forum: 'shift-dds',
      systems: ['dh'],
      pos: [680, 980],
    }),
    node('n-dh-12n', 'process', 'Return defect to owner', {
      role: 'cell',
      forum: 'line-dds',
      systems: ['dh'],
      pos: [900, 880],
    }),
    node('n-dh-13', 'decision', 'Is the defect recurring, high severity or overdue?', {
      role: 'plant',
      forum: 'line-dds',
      systems: ['dh', 'ips'],
      pos: [900, 980],
    }),
    node('n-dh-14y', 'subprocess', 'Create linked IPS', {
      role: 'plant',
      forum: 'ips-review',
      systems: ['dh', 'ips'],
      subprocess: 'ips',
      pos: [1120, 880],
    }),
    node('n-dh-15y', 'review', 'Monitor corrective actions', {
      role: 'plant',
      forum: 'wds',
      systems: ['dh', 'ips'],
      pos: [1120, 980],
    }),
    node('n-dh-14n', 'process', 'Reassign action and due date', {
      role: 'cell',
      forum: 'line-dds',
      systems: ['dh'],
      pos: [1120, 1080],
    }),
    node('n-dh-16', 'review', 'Review open and overdue defects', {
      role: 'plant',
      forum: 'wds',
      systems: ['dh'],
      pos: [40, 680],
    }),
    node('n-dh-17', 'review', 'Review recurring and systemic defects', {
      role: 'site',
      forum: 'pdca',
      systems: ['dh', 'ips'],
      pos: [40, 780],
    }),
  ],
  [
    edge('e-dh-1', 'n-dh-1', 'n-dh-2'),
    edge('e-dh-2', 'n-dh-2', 'n-dh-3'),
    edge('e-dh-3', 'n-dh-3', 'n-dh-4'),
    edge('e-dh-4', 'n-dh-4', 'n-dh-5'),
    edge('e-dh-5', 'n-dh-5', 'n-dh-6y', 'Yes'),
    edge('e-dh-6', 'n-dh-6y', 'n-dh-7y'),
    edge('e-dh-7', 'n-dh-7y', 'n-dh-8y'),
    edge('e-dh-7b', 'n-dh-8y', 'n-dh-10'),
    edge('e-dh-8', 'n-dh-5', 'n-dh-6n', 'No'),
    edge('e-dh-9', 'n-dh-6n', 'n-dh-7n'),
    edge('e-dh-10', 'n-dh-7n', 'n-dh-8my', 'Yes'),
    edge('e-dh-11', 'n-dh-7n', 'n-dh-8mn', 'No'),
    edge('e-dh-12', 'n-dh-8my', 'n-dh-9my'),
    edge('e-dh-13', 'n-dh-9my', 'n-dh-10'),
    edge('e-dh-14', 'n-dh-8mn', 'n-dh-9mn'),
    edge('e-dh-15', 'n-dh-9mn', 'n-dh-10'),
    edge('e-dh-16', 'n-dh-10', 'n-dh-11'),
    edge('e-dh-17', 'n-dh-11', 'n-dh-12y', 'Yes'),
    edge('e-dh-18', 'n-dh-11', 'n-dh-12n', 'No'),
    edge('e-dh-19', 'n-dh-12n', 'n-dh-13'),
    edge('e-dh-20', 'n-dh-13', 'n-dh-14y', 'Yes'),
    edge('e-dh-21', 'n-dh-13', 'n-dh-14n', 'No'),
    edge('e-dh-22', 'n-dh-14y', 'n-dh-15y'),
    edge('e-dh-23', 'n-dh-16', 'n-dh-17'),
  ],
)

// --- BDE ---
const bde = flow(
  [
    node('n-bde-1', 'start', 'Equipment breakdown occurs', { role: 'operator', forum: 'swp', systems: ['bde'], pos: [40, 40] }),
    node('n-bde-2', 'process', 'Stop equipment, make safe and notify support', { role: 'operator', forum: 'swp', systems: ['bde'], pos: [40, 120] }),
    node('n-bde-3', 'process', 'Create breakdown event', {
      description: 'Record equipment, start time, symptoms, production impact and evidence.',
      role: 'cell',
      forum: 'shift-dds',
      systems: ['bde'],
      pos: [40, 200],
    }),
    node('n-bde-4', 'process', 'Diagnose breakdown', { role: 'maintenance', forum: 'swp', systems: ['bde'], pos: [40, 280] }),
    node('n-bde-5', 'process', 'Restore equipment', { role: 'maintenance', forum: 'swp', systems: ['bde'], pos: [40, 360] }),
    node('n-bde-6', 'process', 'Record restoration time, downtime and initial cause', { role: 'maintenance', forum: 'shift-dds', systems: ['bde'], pos: [40, 440] }),
    node('n-bde-7', 'decision', 'Has the breakdown investigation threshold been met?', {
      description: 'Criteria: duration, recurrence, safety, quality, cost or production impact.',
      role: 'plant',
      forum: 'line-dds',
      systems: ['bde'],
      pos: [40, 520],
    }),
    node('n-bde-8n', 'process', 'Record breakdown category and failure mode', { role: 'maintenance', forum: 'line-dds', systems: ['bde'], pos: [260, 520] }),
    node('n-bde-9n', 'decision', 'Is follow-up work required?', { role: 'maintenance', forum: 'line-dds', systems: ['bde', 'dh'], pos: [260, 620] }),
    node('n-bde-10ny', 'subprocess', 'Create linked defect or maintenance request', {
      role: 'maintenance',
      forum: 'line-dds',
      systems: ['bde', 'dh', 'mps'],
      subprocess: 'mps',
      pos: [260, 720],
    }),
    node('n-bde-10nn', 'end', 'Close standard breakdown event', { role: 'plant', forum: 'line-dds', systems: ['bde'], pos: [260, 820] }),
    node('n-bde-8y', 'process', 'Assign BDE owner and investigation team', { role: 'plant', forum: 'bde-review', systems: ['bde'], pos: [480, 400] }),
    node('n-bde-9y', 'process', 'Confirm problem statement and event timeline', { role: 'plant', forum: 'bde-review', systems: ['bde'], pos: [480, 480] }),
    node('n-bde-10y', 'process', 'Collect evidence and confirm failure mode', { role: 'maintenance', forum: 'bde-review', systems: ['bde'], pos: [480, 560] }),
    node('n-bde-11y', 'process', 'Complete root cause analysis', { role: 'support', forum: 'bde-review', systems: ['bde'], pos: [480, 640] }),
    node('n-bde-12y', 'decision', 'Has the root cause been confirmed?', { role: 'plant', forum: 'bde-review', systems: ['bde'], pos: [480, 720] }),
    node('n-bde-13yn', 'process', 'Collect additional evidence', { role: 'maintenance', forum: 'bde-review', systems: ['bde'], pos: [700, 640] }),
    node('n-bde-13yy', 'process', 'Define corrective and preventive actions', { role: 'plant', forum: 'bde-review', systems: ['bde'], pos: [700, 760] }),
    node('n-bde-14y', 'process', 'Assign owners and due dates', { role: 'plant', forum: 'bde-review', systems: ['bde'], pos: [700, 840] }),
    node('n-bde-15y', 'subprocess', 'Create maintenance or improvement work', {
      role: 'maintenance',
      forum: 'weekly-maintenance-planning',
      systems: ['bde', 'mps', 'ips'],
      subprocess: 'mps',
      pos: [700, 920],
    }),
    node('n-bde-16y', 'process', 'Complete assigned actions', {
      role: 'operator',
      forum: 'swp',
      systems: ['bde', 'mps'],
      owner: 'Action owner',
      pos: [920, 920],
    }),
    node('n-bde-17y', 'review', 'Verify effectiveness and recurrence', { role: 'plant', forum: 'wds', systems: ['bde'], pos: [920, 1020] }),
    node('n-bde-18y', 'decision', 'Were actions effective?', { role: 'plant', forum: 'wds', systems: ['bde'], pos: [920, 1120] }),
    node('n-bde-19yn', 'process', 'Reopen investigation', { role: 'plant', forum: 'bde-review', systems: ['bde'], pos: [1140, 1020] }),
    node('n-bde-19yy', 'end', 'Approve and close BDE', { role: 'site', forum: 'pdca', systems: ['bde'], pos: [1140, 1220] }),
  ],
  [
    edge('e-bde-1', 'n-bde-1', 'n-bde-2'),
    edge('e-bde-2', 'n-bde-2', 'n-bde-3'),
    edge('e-bde-3', 'n-bde-3', 'n-bde-4'),
    edge('e-bde-4', 'n-bde-4', 'n-bde-5'),
    edge('e-bde-5', 'n-bde-5', 'n-bde-6'),
    edge('e-bde-6', 'n-bde-6', 'n-bde-7'),
    edge('e-bde-7', 'n-bde-7', 'n-bde-8n', 'No'),
    edge('e-bde-8', 'n-bde-8n', 'n-bde-9n'),
    edge('e-bde-9', 'n-bde-9n', 'n-bde-10ny', 'Yes'),
    edge('e-bde-10', 'n-bde-9n', 'n-bde-10nn', 'No'),
    edge('e-bde-11', 'n-bde-7', 'n-bde-8y', 'Yes'),
    edge('e-bde-12', 'n-bde-8y', 'n-bde-9y'),
    edge('e-bde-13', 'n-bde-9y', 'n-bde-10y'),
    edge('e-bde-14', 'n-bde-10y', 'n-bde-11y'),
    edge('e-bde-15', 'n-bde-11y', 'n-bde-12y'),
    edge('e-bde-16', 'n-bde-12y', 'n-bde-13yn', 'No'),
    edge('e-bde-17', 'n-bde-13yn', 'n-bde-11y'),
    edge('e-bde-18', 'n-bde-12y', 'n-bde-13yy', 'Yes'),
    edge('e-bde-19', 'n-bde-13yy', 'n-bde-14y'),
    edge('e-bde-20', 'n-bde-14y', 'n-bde-15y'),
    edge('e-bde-21', 'n-bde-15y', 'n-bde-16y'),
    edge('e-bde-22', 'n-bde-16y', 'n-bde-17y'),
    edge('e-bde-23', 'n-bde-17y', 'n-bde-18y'),
    edge('e-bde-24', 'n-bde-18y', 'n-bde-19yn', 'No'),
    edge('e-bde-25', 'n-bde-19yn', 'n-bde-11y'),
    edge('e-bde-26', 'n-bde-18y', 'n-bde-19yy', 'Yes'),
  ],
)

// --- IPS ---
const ips = flow(
  [
    node('n-ips-1', 'start', 'Problem-solving trigger identified', {
      description: 'Trigger: repeating defect, KPI gap, trigger, breakdown, quality issue, CL deviation or audit finding.',
      role: 'cell',
      forum: 'shift-dds',
      systems: ['ips'],
      pos: [40, 40],
    }),
    node('n-ips-2', 'review', 'Review issue, impact and available evidence', { role: 'cell', forum: 'shift-dds', systems: ['ips'], pos: [40, 120] }),
    node('n-ips-3', 'decision', 'Is structured problem solving required?', { role: 'plant', forum: 'line-dds', systems: ['ips'], pos: [40, 200] }),
    node('n-ips-4n', 'process', 'Create local corrective action', { role: 'cell', forum: 'shift-dds', systems: ['ips'], pos: [260, 200] }),
    node('n-ips-5n', 'review', 'Complete and verify local action', { role: 'cell', forum: 'line-dds', systems: ['ips'], pos: [260, 280] }),
    node('n-ips-6n', 'end', 'Close local issue', { role: 'cell', forum: 'line-dds', systems: ['ips'], pos: [260, 360] }),
    node('n-ips-4y', 'process', 'Create IPS and link the source record', { role: 'plant', forum: 'line-dds', systems: ['ips'], pos: [480, 120] }),
    node('n-ips-5y', 'process', 'Assign IPS owner and problem-solving team', { role: 'plant', forum: 'ips-review', systems: ['ips'], pos: [480, 200] }),
    node('n-ips-6y', 'process', 'Define the problem statement', { role: 'plant', forum: 'ips-review', systems: ['ips'], pos: [480, 280] }),
    node('n-ips-7y', 'process', 'Define target condition and success criteria', { role: 'plant', forum: 'ips-review', systems: ['ips'], pos: [480, 360] }),
    node('n-ips-8y', 'process', 'Implement immediate containment', { role: 'cell', forum: 'shift-dds', systems: ['ips'], pos: [480, 440] }),
    node('n-ips-9y', 'process', 'Collect data and confirm current condition', { role: 'support', forum: 'ips-review', systems: ['ips'], pos: [480, 520] }),
    node('n-ips-10y', 'process', 'Identify potential causes', { role: 'support', forum: 'ips-review', systems: ['ips'], owner: 'Problem-solving team', pos: [480, 600] }),
    node('n-ips-11y', 'review', 'Validate the root cause', { role: 'support', forum: 'ips-review', systems: ['ips'], pos: [480, 680] }),
    node('n-ips-12y', 'decision', 'Has the root cause been validated?', { role: 'plant', forum: 'ips-review', systems: ['ips'], pos: [480, 760] }),
    node('n-ips-13yn', 'process', 'Collect more evidence and revise analysis', { role: 'support', forum: 'ips-review', systems: ['ips'], pos: [700, 680] }),
    node('n-ips-13yy', 'process', 'Define countermeasures', { role: 'support', forum: 'ips-review', systems: ['ips'], owner: 'Problem-solving team', pos: [700, 840] }),
    node('n-ips-14y', 'process', 'Assign countermeasure owners and due dates', { role: 'plant', forum: 'ips-review', systems: ['ips'], pos: [700, 920] }),
    node('n-ips-15y', 'process', 'Execute countermeasures', {
      role: 'operator',
      forum: 'swp',
      systems: ['ips'],
      owner: 'Action owner',
      pos: [700, 1000],
    }),
    node('n-ips-16y', 'review', 'Verify results against success criteria', { role: 'plant', forum: 'wds', systems: ['ips'], pos: [920, 1000] }),
    node('n-ips-17y', 'decision', 'Were countermeasures effective?', { role: 'plant', forum: 'wds', systems: ['ips'], pos: [920, 1080] }),
    node('n-ips-18yn', 'process', 'Reopen root cause analysis', { role: 'support', forum: 'ips-review', systems: ['ips'], pos: [1140, 1000] }),
    node('n-ips-18yy', 'process', 'Standardise successful countermeasures', { role: 'support', forum: 'pdca', systems: ['ips', 'cl', 'cil', 'dh'], pos: [1140, 1160] }),
    node('n-ips-19y', 'process', 'Update standards, training and controls', { role: 'support', forum: 'pdca', systems: ['ips'], pos: [1140, 1240] }),
    node('n-ips-20y', 'end', 'Approve and close IPS', { role: 'site', forum: 'pdca', systems: ['ips'], pos: [1140, 1320] }),
  ],
  [
    edge('e-ips-1', 'n-ips-1', 'n-ips-2'),
    edge('e-ips-2', 'n-ips-2', 'n-ips-3'),
    edge('e-ips-3', 'n-ips-3', 'n-ips-4n', 'No'),
    edge('e-ips-4', 'n-ips-4n', 'n-ips-5n'),
    edge('e-ips-5', 'n-ips-5n', 'n-ips-6n'),
    edge('e-ips-6', 'n-ips-3', 'n-ips-4y', 'Yes'),
    edge('e-ips-7', 'n-ips-4y', 'n-ips-5y'),
    edge('e-ips-8', 'n-ips-5y', 'n-ips-6y'),
    edge('e-ips-9', 'n-ips-6y', 'n-ips-7y'),
    edge('e-ips-10', 'n-ips-7y', 'n-ips-8y'),
    edge('e-ips-11', 'n-ips-8y', 'n-ips-9y'),
    edge('e-ips-12', 'n-ips-9y', 'n-ips-10y'),
    edge('e-ips-13', 'n-ips-10y', 'n-ips-11y'),
    edge('e-ips-14', 'n-ips-11y', 'n-ips-12y'),
    edge('e-ips-15', 'n-ips-12y', 'n-ips-13yn', 'No'),
    edge('e-ips-16', 'n-ips-13yn', 'n-ips-10y'),
    edge('e-ips-17', 'n-ips-12y', 'n-ips-13yy', 'Yes'),
    edge('e-ips-18', 'n-ips-13yy', 'n-ips-14y'),
    edge('e-ips-19', 'n-ips-14y', 'n-ips-15y'),
    edge('e-ips-20', 'n-ips-15y', 'n-ips-16y'),
    edge('e-ips-21', 'n-ips-16y', 'n-ips-17y'),
    edge('e-ips-22', 'n-ips-17y', 'n-ips-18yn', 'No'),
    edge('e-ips-23', 'n-ips-18yn', 'n-ips-10y'),
    edge('e-ips-24', 'n-ips-17y', 'n-ips-18yy', 'Yes'),
    edge('e-ips-25', 'n-ips-18yy', 'n-ips-19y'),
    edge('e-ips-26', 'n-ips-19y', 'n-ips-20y'),
  ],
)

// --- MP&S ---
const mps = flow(
  [
    node('n-mps-1', 'start', 'Maintenance work demand created', {
      description: 'Trigger: DH defect, BDE action, CIL finding, IPS action, inspection or planned maintenance requirement.',
      role: 'maintenance',
      forum: 'shift-dds',
      systems: ['mps'],
      pos: [40, 40],
    }),
    node('n-mps-2', 'review', 'Review and validate work request', { role: 'maintenance', forum: 'line-dds', systems: ['mps'], pos: [40, 120] }),
    node('n-mps-3', 'decision', 'Is the request valid and sufficiently defined?', { role: 'maintenance', forum: 'line-dds', systems: ['mps'], pos: [40, 200] }),
    node('n-mps-4n', 'process', 'Return request for additional information', { role: 'cell', forum: 'shift-dds', systems: ['mps'], pos: [260, 200] }),
    node('n-mps-4y', 'process', 'Assess priority, risk and equipment criticality', { role: 'maintenance', forum: 'line-dds', systems: ['mps'], pos: [260, 120] }),
    node('n-mps-5', 'decision', 'Is immediate work required?', { role: 'maintenance', forum: 'line-dds', systems: ['mps'], pos: [260, 280] }),
    node('n-mps-6ey', 'process', 'Escalate and arrange immediate execution', { role: 'plant', forum: 'shift-dds', systems: ['mps'], pos: [480, 200] }),
    node('n-mps-7ey', 'process', 'Execute emergency maintenance work', { role: 'maintenance', forum: 'swp', systems: ['mps'], pos: [480, 280] }),
    node('n-mps-6en', 'process', 'Define work scope', { role: 'maintenance', forum: 'weekly-maintenance-planning', systems: ['mps'], pos: [480, 360] }),
    node('n-mps-7en', 'process', 'Plan labour, parts, tools, permits and duration', { role: 'maintenance', forum: 'weekly-maintenance-planning', systems: ['mps'], pos: [480, 440] }),
    node('n-mps-8en', 'review', 'Confirm production access and operating window', { role: 'plant', forum: 'weekly-maintenance-planning', systems: ['mps'], pos: [480, 520] }),
    node('n-mps-9en', 'decision', 'Is the work ready to schedule?', { role: 'maintenance', forum: 'weekly-maintenance-planning', systems: ['mps'], pos: [480, 600] }),
    node('n-mps-10nb', 'process', 'Place work in planning backlog', { role: 'maintenance', forum: 'weekly-maintenance-planning', systems: ['mps'], pos: [700, 520] }),
    node('n-mps-11nb', 'process', 'Resolve planning constraints', { role: 'maintenance', forum: 'weekly-maintenance-planning', systems: ['mps'], pos: [700, 600] }),
    node('n-mps-10y', 'process', 'Add work to the agreed weekly schedule', { role: 'maintenance', forum: 'weekly-maintenance-planning', systems: ['mps'], pos: [700, 680] }),
    node('n-mps-11y', 'review', 'Confirm schedule with operations', { role: 'plant', forum: 'line-dds', systems: ['mps'], pos: [700, 760] }),
    node('n-mps-12y', 'process', 'Release work for execution', { role: 'maintenance', forum: 'p2p', systems: ['mps'], pos: [700, 840] }),
    node('n-mps-13y', 'process', 'Execute maintenance work', { role: 'maintenance', forum: 'swp', systems: ['mps'], pos: [920, 840] }),
    node('n-mps-14y', 'process', 'Record labour, parts, findings and completion status', { role: 'maintenance', forum: 'swp', systems: ['mps'], pos: [920, 920] }),
    node('n-mps-15', 'decision', 'Was additional work identified?', { role: 'maintenance', forum: 'swp', systems: ['mps', 'dh'], pos: [920, 1000] }),
    node('n-mps-16y', 'process', 'Create linked defect or follow-up work request', { role: 'maintenance', forum: 'shift-dds', systems: ['mps', 'dh'], pos: [1140, 920] }),
    node('n-mps-16n', 'decision', 'Is the work technically complete?', { role: 'maintenance', forum: 'shift-dds', systems: ['mps'], pos: [1140, 1080] }),
    node('n-mps-17nr', 'process', 'Return work for completion', { role: 'maintenance', forum: 'line-dds', systems: ['mps'], pos: [1360, 1000] }),
    node('n-mps-17ny', 'end', 'Close maintenance work', { role: 'maintenance', forum: 'shift-dds', systems: ['mps'], pos: [1360, 1160] }),
    node('n-mps-18', 'review', 'Review weekly schedule compliance', { role: 'plant', forum: 'wds', systems: ['mps'], pos: [40, 720] }),
    node('n-mps-19', 'review', 'Review backlog, overdue work and planning losses', { role: 'site', forum: 'pdca', systems: ['mps'], pos: [40, 820] }),
  ],
  [
    edge('e-mps-1', 'n-mps-1', 'n-mps-2'),
    edge('e-mps-2', 'n-mps-2', 'n-mps-3'),
    edge('e-mps-3', 'n-mps-3', 'n-mps-4n', 'No'),
    edge('e-mps-4', 'n-mps-4n', 'n-mps-2'),
    edge('e-mps-5', 'n-mps-3', 'n-mps-4y', 'Yes'),
    edge('e-mps-6', 'n-mps-4y', 'n-mps-5'),
    edge('e-mps-7', 'n-mps-5', 'n-mps-6ey', 'Yes'),
    edge('e-mps-8', 'n-mps-6ey', 'n-mps-7ey'),
    edge('e-mps-9', 'n-mps-5', 'n-mps-6en', 'No'),
    edge('e-mps-10', 'n-mps-6en', 'n-mps-7en'),
    edge('e-mps-11', 'n-mps-7en', 'n-mps-8en'),
    edge('e-mps-12', 'n-mps-8en', 'n-mps-9en'),
    edge('e-mps-13', 'n-mps-9en', 'n-mps-10nb', 'No'),
    edge('e-mps-14', 'n-mps-10nb', 'n-mps-11nb'),
    edge('e-mps-15', 'n-mps-11nb', 'n-mps-9en'),
    edge('e-mps-16', 'n-mps-9en', 'n-mps-10y', 'Yes'),
    edge('e-mps-17', 'n-mps-10y', 'n-mps-11y'),
    edge('e-mps-18', 'n-mps-11y', 'n-mps-12y'),
    edge('e-mps-19', 'n-mps-12y', 'n-mps-13y'),
    edge('e-mps-20', 'n-mps-13y', 'n-mps-14y'),
    edge('e-mps-21', 'n-mps-14y', 'n-mps-15'),
    edge('e-mps-22', 'n-mps-15', 'n-mps-16y', 'Yes'),
    edge('e-mps-23', 'n-mps-15', 'n-mps-16n', 'No'),
    edge('e-mps-24', 'n-mps-16n', 'n-mps-17nr', 'No'),
    edge('e-mps-25', 'n-mps-16n', 'n-mps-17ny', 'Yes'),
    edge('e-mps-26', 'n-mps-18', 'n-mps-19'),
  ],
)

// --- Triggers ---
const triggers = flow(
  [
    node('n-trg-1', 'start', 'Define trigger questions and conditions', { role: 'support', forum: 'pdca', systems: ['triggers'], pos: [40, 40] }),
    node('n-trg-2', 'process', 'Configure trigger thresholds and severity levels', { role: 'support', forum: 'pdca', systems: ['triggers'], pos: [40, 120] }),
    node('n-trg-3', 'process', 'Assign triggers to applicable sites, roles and forums', { role: 'support', forum: 'wds', systems: ['triggers'], pos: [40, 200] }),
    node('n-trg-4', 'start', 'Trigger assessment becomes due', {
      description: 'Trigger: scheduled assessment, business event or threshold check.',
      role: 'operator',
      forum: 'p2p',
      systems: ['triggers'],
      pos: [280, 40],
    }),
    node('n-trg-5', 'process', 'Complete trigger questions', { role: 'operator', forum: 'p2p', systems: ['triggers'], pos: [280, 120] }),
    node('n-trg-6', 'process', 'Record responses and evidence', { role: 'operator', forum: 'p2p', systems: ['triggers'], pos: [280, 200] }),
    node('n-trg-7', 'process', 'Evaluate responses against configured thresholds', {
      description: 'System evaluates responses against configured thresholds.',
      role: 'cell',
      forum: 'shift-dds',
      systems: ['triggers'],
      pos: [280, 280],
    }),
    node('n-trg-8', 'decision', 'Has a trigger condition been met?', { role: 'cell', forum: 'shift-dds', systems: ['triggers'], pos: [280, 360] }),
    node('n-trg-9n', 'end', 'Record compliant result', { role: 'operator', forum: 'shift-dds', systems: ['triggers'], pos: [280, 460] }),
    node('n-trg-9y', 'process', 'Create trigger event and notify owner', { role: 'cell', forum: 'shift-dds', systems: ['triggers'], pos: [500, 360] }),
    node('n-trg-10', 'review', 'Review trigger severity and impact', { role: 'cell', forum: 'shift-dds', systems: ['triggers'], pos: [500, 440] }),
    node('n-trg-11', 'decision', 'Is immediate containment required?', { role: 'cell', forum: 'shift-dds', systems: ['triggers'], pos: [500, 520] }),
    node('n-trg-12y', 'process', 'Implement immediate containment', { role: 'cell', forum: 'shift-dds', systems: ['triggers'], pos: [500, 600] }),
    node('n-trg-13', 'decision', 'Is structured problem solving required?', { role: 'plant', forum: 'line-dds', systems: ['triggers', 'ips'], pos: [720, 520] }),
    node('n-trg-14n', 'process', 'Assign local corrective action and due date', { role: 'cell', forum: 'line-dds', systems: ['triggers'], pos: [720, 640] }),
    node('n-trg-15n', 'process', 'Complete corrective action', { role: 'operator', forum: 'swp', systems: ['triggers'], owner: 'Action owner', pos: [720, 720] }),
    node('n-trg-16n', 'review', 'Verify action effectiveness', { role: 'plant', forum: 'line-dds', systems: ['triggers'], pos: [720, 800] }),
    node('n-trg-17n', 'decision', 'Was the action effective?', { role: 'plant', forum: 'line-dds', systems: ['triggers'], pos: [720, 880] }),
    node('n-trg-18n', 'end', 'Close trigger event', { role: 'plant', forum: 'line-dds', systems: ['triggers'], pos: [720, 960] }),
    node('n-trg-14y', 'subprocess', 'Create linked IPS', { role: 'plant', forum: 'ips-review', systems: ['triggers', 'ips'], subprocess: 'ips', pos: [940, 440] }),
    node('n-trg-15y', 'process', 'Assign IPS owner', { role: 'plant', forum: 'ips-review', systems: ['triggers', 'ips'], pos: [940, 520] }),
    node('n-trg-16y', 'review', 'Monitor IPS progress', { role: 'plant', forum: 'wds', systems: ['triggers', 'ips'], pos: [940, 600] }),
    node('n-trg-17y', 'decision', 'Is the trigger response overdue or critical?', { role: 'site', forum: 'site-dds', systems: ['triggers', 'ips'], pos: [940, 680] }),
    node('n-trg-18ey', 'process', 'Escalate to site leadership', { role: 'site', forum: 'site-dds', systems: ['triggers', 'ips'], pos: [1160, 600] }),
    node('n-trg-19ey', 'review', 'Continue monitoring until resolved', { role: 'plant', forum: 'wds', systems: ['triggers', 'ips'], pos: [1160, 680] }),
    node('n-trg-18en', 'review', 'Verify IPS effectiveness', { role: 'plant', forum: 'wds', systems: ['triggers', 'ips'], pos: [1160, 760] }),
    node('n-trg-19en', 'end', 'Close trigger event', { role: 'site', forum: 'pdca', systems: ['triggers', 'ips'], pos: [1160, 840] }),
    node('n-trg-20', 'review', 'Review trigger completion and response compliance', { role: 'plant', forum: 'wds', systems: ['triggers'], pos: [40, 400] }),
    node('n-trg-21', 'review', 'Review repeated triggers and threshold effectiveness', { role: 'site', forum: 'pdca', systems: ['triggers', 'ips'], pos: [40, 500] }),
  ],
  [
    edge('e-trg-1', 'n-trg-1', 'n-trg-2'),
    edge('e-trg-2', 'n-trg-2', 'n-trg-3'),
    edge('e-trg-3', 'n-trg-3', 'n-trg-4'),
    edge('e-trg-3b', 'n-trg-4', 'n-trg-5'),
    edge('e-trg-4', 'n-trg-5', 'n-trg-6'),
    edge('e-trg-5', 'n-trg-6', 'n-trg-7'),
    edge('e-trg-6', 'n-trg-7', 'n-trg-8'),
    edge('e-trg-7', 'n-trg-8', 'n-trg-9n', 'No'),
    edge('e-trg-8', 'n-trg-8', 'n-trg-9y', 'Yes'),
    edge('e-trg-9', 'n-trg-9y', 'n-trg-10'),
    edge('e-trg-10', 'n-trg-10', 'n-trg-11'),
    edge('e-trg-11', 'n-trg-11', 'n-trg-12y', 'Yes'),
    edge('e-trg-12', 'n-trg-11', 'n-trg-13', 'No'),
    edge('e-trg-13', 'n-trg-12y', 'n-trg-13'),
    edge('e-trg-14', 'n-trg-13', 'n-trg-14n', 'No'),
    edge('e-trg-15', 'n-trg-14n', 'n-trg-15n'),
    edge('e-trg-16', 'n-trg-15n', 'n-trg-16n'),
    edge('e-trg-17', 'n-trg-16n', 'n-trg-17n'),
    edge('e-trg-18', 'n-trg-17n', 'n-trg-18n', 'Yes'),
    edge('e-trg-18b', 'n-trg-17n', 'n-trg-14y', 'No'),
    edge('e-trg-18c', 'n-trg-14y', 'n-trg-15y'),
    edge('e-trg-20', 'n-trg-13', 'n-trg-14y', 'Yes'),
    edge('e-trg-21', 'n-trg-15y', 'n-trg-16y'),
    edge('e-trg-23', 'n-trg-16y', 'n-trg-17y'),
    edge('e-trg-24', 'n-trg-17y', 'n-trg-18ey', 'Yes'),
    edge('e-trg-25', 'n-trg-18ey', 'n-trg-19ey'),
    edge('e-trg-26', 'n-trg-17y', 'n-trg-18en', 'No'),
    edge('e-trg-27', 'n-trg-18en', 'n-trg-19en'),
    edge('e-trg-28', 'n-trg-20', 'n-trg-21'),
  ],
)

const PROCESSES = [
  {
    id: 'a1000001-0001-4000-8000-000000000003',
    name: 'CIL — Clean, inspect and lubricate',
    description: 'CIL task execution, abnormal conditions, defect linkage and corrective paths.',
    owner: 'cell',
    system: 'cil',
    flow: cil,
  },
  {
    id: 'a1000001-0001-4000-8000-000000000002',
    name: 'DH — Defect handling',
    description: 'Defect identification, prioritisation, maintenance linkage, IPS escalation and periodic review.',
    owner: 'cell',
    system: 'dh',
    flow: dh,
  },
  {
    id: 'a1000003-0001-4000-8000-000000000001',
    name: 'BDE — Breakdown event',
    description: 'Breakdown response, standard closure, investigation, RCA and effectiveness verification.',
    owner: 'plant',
    system: 'bde',
    flow: bde,
  },
  {
    id: 'a1000002-0001-4000-8000-000000000002',
    name: 'IPS — Integrated problem solving',
    description: 'Structured problem solving from trigger through containment, RCA, countermeasures and standardisation.',
    owner: 'plant',
    system: 'ips',
    flow: ips,
  },
  {
    id: 'a1000003-0001-4000-8000-000000000002',
    name: 'MP&S — Maintenance planning and scheduling',
    description: 'Work demand validation, planning, scheduling, execution and closure.',
    owner: 'maintenance',
    system: 'mps',
    flow: mps,
  },
  {
    id: 'a1000003-0001-4000-8000-000000000003',
    name: 'Triggers — Threshold and event management',
    description: 'Trigger configuration, assessment, containment, corrective action and IPS linkage.',
    owner: 'support',
    system: 'triggers',
    flow: triggers,
  },
]

function sqlEscape(s) {
  return s.replace(/'/g, "''")
}

function buildNodeSql(n) {
  const parts = [
    `'id','${n.id}'`,
    `'kind','${n.kind}'`,
    `'label','${sqlEscape(n.label)}'`,
  ]
  if (n.description) parts.push(`'description','${sqlEscape(n.description)}'`)
  parts.push(`'roleId',${ROLE_VAR[n.role]}`)
  parts.push(`'forumId',${FORUM_VAR[n.forum]}`)
  const sysExprs = n.systems.map((s) => SYSTEM_VAR[s]).join(',')
  parts.push(`'systemIds',jsonb_build_array(${sysExprs})`)
  if (n.owner) parts.push(`'owner','${sqlEscape(n.owner)}'`)
  if (n.inputs) parts.push(`'inputs','${sqlEscape(n.inputs)}'`)
  if (n.outputs) parts.push(`'outputs','${sqlEscape(n.outputs)}'`)
  if (n.subprocess === 'ips') parts.push(`'subprocessProcessId',p_ips`)
  if (n.subprocess === 'mps') parts.push(`'subprocessProcessId',p_mps`)
  if (n.subprocess === 'dh') parts.push(`'subprocessProcessId',p_dh`)
  parts.push(`'position',jsonb_build_object('x',${n.pos[0]},'y',${n.pos[1]})`)
  return `jsonb_build_object(${parts.join(',')})`
}

function buildFlowSql(f) {
  const nodes = f.nodes.map(buildNodeSql).join(',\n          ')
  const edges = f.edges
    .map((e) => {
      const label = e.label ? `,'label','${sqlEscape(e.label)}'` : ''
      return `jsonb_build_object('id','${e.id}','source','${e.source}','target','${e.target}'${label})`
    })
    .join(',\n          ')
  return `jsonb_build_object('nodes', jsonb_build_array(\n          ${nodes}\n        ), 'edges', jsonb_build_array(\n          ${edges}\n        ))`
}

const processUpdates = PROCESSES.map((p) => {
  return `
  flow_${p.system.replace('-', '_')} := ${buildFlowSql(p.flow)};

  update bms_brain_processes
  set
    name = '${sqlEscape(p.name)}',
    description = '${sqlEscape(p.description)}',
    status = 'published',
    flow = flow_${p.system.replace('-', '_')},
    owner_role_id = ${ROLE_VAR[p.owner]},
    catalog_system_id = ${SYSTEM_VAR[p.system]},
    updated_at = now()
  where id = '${p.id}';

  if not found then
    insert into bms_brain_processes (id, name, description, status, flow, owner_role_id, catalog_system_id)
    values (
      '${p.id}',
      '${sqlEscape(p.name)}',
      '${sqlEscape(p.description)}',
      'published',
      flow_${p.system.replace('-', '_')},
      ${ROLE_VAR[p.owner]},
      ${SYSTEM_VAR[p.system]}
    );
  end if;

  select coalesce(max(version_no), 0) + 1 into next_ver from bms_brain_process_versions where process_id = '${p.id}';
  insert into bms_brain_process_versions (process_id, version_no, snapshot, note)
  select '${p.id}', next_ver, to_jsonb(p.*), '${sqlEscape(p.name)} standard'
  from bms_brain_processes p where p.id = '${p.id}';`
}).join('\n')

const sql = `-- BMS Brain system standards: CIL, DH, BDE, IPS, MP&S, Triggers

insert into public.bms_brain_forums (slug, name, description, color, icon, sort_order) values
  ('weekly-maintenance-planning', 'Weekly Maintenance Planning', 'Weekly maintenance planning and scheduling forum.', '#f59e0b', 'calendar-range', 9),
  ('bde-review', 'BDE Review', 'Breakdown event investigation and review forum.', '#dc2626', 'alert-triangle', 10)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into public.bms_brain_systems (slug, name, description, integrations, color, icon, sort_order) values
  ('bde', 'BDE', 'Breakdown event response, investigation and closure.', 'Shift DDS, Line DDS, DH, MP&S, IPS', '#dc2626', 'alert-triangle', 9),
  ('mps', 'MP&S', 'Maintenance planning, scheduling and work execution.', 'DH, BDE, CIL, IPS, Shift DDS', '#f59e0b', 'calendar-range', 10),
  ('triggers', 'Triggers', 'Threshold triggers, assessments and escalation.', 'P2P, Shift DDS, IPS, WDS', '#a855f7', 'zap', 11)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  integrations = excluded.integrations,
  updated_at = now();

update public.bms_brain_systems set
  description = 'Clean, inspect and lubricate tasks — execution, abnormal conditions and defect linkage.',
  integrations = 'Plan 24, DH, MP&S, IPS, Shift DDS'
where slug = 'cil';

update public.bms_brain_systems set
  description = 'Defect handling — identification, prioritisation, maintenance and IPS escalation.',
  integrations = 'CIL, BDE, MP&S, IPS, Shift DDS, Line DDS, WDS'
where slug = 'dh';

update public.bms_brain_systems set
  description = 'Integrated problem solving — local actions through structured IPS and standardisation.',
  integrations = 'CL, CIL, DH, Triggers, BDE, WDS, PDCA'
where slug = 'ips';

create or replace function public.bms_brain_update_system_standards()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p_dh uuid := 'a1000001-0001-4000-8000-000000000002';
  p_ips uuid := 'a1000002-0001-4000-8000-000000000002';
  p_mps uuid := 'a1000003-0001-4000-8000-000000000002';
  r_operator uuid;
  r_cell uuid;
  r_plant uuid;
  r_site uuid;
  r_support uuid;
  r_maint uuid;
  f_swp uuid;
  f_p2p uuid;
  f_shift uuid;
  f_line uuid;
  f_site uuid;
  f_wds uuid;
  f_pdca uuid;
  f_ips_review uuid;
  f_weekly_maint uuid;
  f_bde_review uuid;
  s_cil uuid;
  s_dh uuid;
  s_bde uuid;
  s_ips uuid;
  s_mps uuid;
  s_triggers uuid;
  s_cl uuid;
  flow_cil jsonb;
  flow_dh jsonb;
  flow_bde jsonb;
  flow_ips jsonb;
  flow_mps jsonb;
  flow_triggers jsonb;
  next_ver int;
begin
  select id into r_operator from bms_brain_roles where slug = 'operator';
  select id into r_cell from bms_brain_roles where slug = 'cell';
  select id into r_plant from bms_brain_roles where slug = 'plant';
  select id into r_site from bms_brain_roles where slug = 'site';
  select id into r_support from bms_brain_roles where slug = 'support';
  select id into r_maint from bms_brain_roles where slug = 'maintenance';

  select id into f_swp from bms_brain_forums where slug = 'swp';
  select id into f_p2p from bms_brain_forums where slug = 'p2p';
  select id into f_shift from bms_brain_forums where slug = 'shift-dds';
  select id into f_line from bms_brain_forums where slug = 'line-dds';
  select id into f_site from bms_brain_forums where slug = 'site-dds';
  select id into f_wds from bms_brain_forums where slug = 'wds';
  select id into f_pdca from bms_brain_forums where slug = 'pdca';
  select id into f_ips_review from bms_brain_forums where slug = 'ips-review';
  select id into f_weekly_maint from bms_brain_forums where slug = 'weekly-maintenance-planning';
  select id into f_bde_review from bms_brain_forums where slug = 'bde-review';

  select id into s_cil from bms_brain_systems where slug = 'cil';
  select id into s_dh from bms_brain_systems where slug = 'dh';
  select id into s_bde from bms_brain_systems where slug = 'bde';
  select id into s_ips from bms_brain_systems where slug = 'ips';
  select id into s_mps from bms_brain_systems where slug = 'mps';
  select id into s_triggers from bms_brain_systems where slug = 'triggers';
  select id into s_cl from bms_brain_systems where slug = 'cl';
${processUpdates}
end;
$$;

select public.bms_brain_update_system_standards();

revoke all on function public.bms_brain_update_system_standards() from public;

notify pgrst, 'reload schema';
`

writeFileSync(outPath, sql)
console.log(`Wrote ${outPath}`)
