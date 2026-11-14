'use strict';

const fs = require('node:fs/promises');
const crypto = require('node:crypto');

const ROLES = new Set(['standard', 'household', 'trusted', 'administrator']);
const STATES = new Set(['pending', 'identity_created', 'mfa_required', 'mfa_complete', 'provisioning', 'partially_provisioned', 'ready', 'failed', 'revoked', 'suspended']);
const DEFAULT_PROFILES = Object.freeze({
  standard: { name: 'standard', applications: { files: true, photos: false, plex: false, chat: false }, quotas: { nextcloud: '10GB', immich: null } },
  household: { name: 'household', applications: { files: true, photos: true, plex: true, chat: true }, quotas: { nextcloud: '100GB', immich: '100GB' } },
  trusted: { name: 'trusted', applications: { files: true, photos: true, plex: true, chat: true }, quotas: { nextcloud: '250GB', immich: '250GB' } },
  administrator: { name: 'administrator', applications: { files: true, photos: true, plex: true, chat: true }, quotas: { nextcloud: 'unlimited', immich: null } }
});

function now() { return new Date().toISOString(); }
function id(prefix) { return `${prefix}_${crypto.randomBytes(12).toString('hex')}`; }
function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
function normalizeEmail(value) { return typeof value === 'string' ? value.trim().toLowerCase() : ''; }
function safeRecord(record) {
  const { tokenHash: _tokenHash, ...publicRecord } = record;
  return publicRecord;
}

class InvitationService {
  constructor({ filePath = '', clock = now, deliveryMode = 'mock' } = {}) {
    this.filePath = filePath;
    this.clock = clock;
    this.deliveryMode = deliveryMode === 'disabled' ? 'disabled' : 'mock';
    this.records = [];
    this.audit = [];
    this.delivery = [];
  }

  async load() {
    if (!this.filePath) return;
    try {
      const data = JSON.parse(await fs.readFile(this.filePath, 'utf8'));
      if (!Array.isArray(data.records) || !Array.isArray(data.audit) || !Array.isArray(data.delivery)) throw new Error('invalid invitation store');
      this.records = data.records;
      this.audit = data.audit;
      this.delivery = data.delivery;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  async save() {
    if (!this.filePath) return;
    await fs.mkdir(require('node:path').dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify({ records: this.records, audit: this.audit, delivery: this.delivery }, null, 2), { mode: 0o600 });
    await fs.rename(temp, this.filePath);
  }

  profiles() { return DEFAULT_PROFILES; }
  auditEvent(action, actor, invitationId, details = {}) {
    this.audit.push({ id: id('audit'), action, actor: actor.subject, invitationId, at: this.clock(), details });
  }
  publicInvitation(record) {
    return { ...safeRecord(record), delivery: this.delivery.find(item => item.invitationId === record.id) || null };
  }
  list() { return this.records.map(record => this.publicInvitation(record)); }
  auditFor(invitationId) { return this.audit.filter(event => event.invitationId === invitationId); }

  async create({ email, role = 'standard', applications, quotaProfile = role, inviter }) {
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw Object.assign(new Error('A valid email address is required'), { code: 'VALIDATION' });
    if (!ROLES.has(role) || !DEFAULT_PROFILES[quotaProfile]) throw Object.assign(new Error('Unsupported role or quota profile'), { code: 'VALIDATION' });
    if (role === 'administrator' && !inviter.isAdmin) throw Object.assign(new Error('Only administrators can create administrator invitations'), { code: 'FORBIDDEN' });
    const active = this.records.find(record => record.email === normalized && ['pending', 'identity_created', 'mfa_required', 'mfa_complete', 'provisioning', 'partially_provisioned', 'ready'].includes(record.state));
    if (active) throw Object.assign(new Error('An active invitation already exists for this identity'), { code: 'DUPLICATE' });
    const profile = DEFAULT_PROFILES[quotaProfile];
    const assignedApplications = [...new Set(Array.isArray(applications) ? applications.filter(app => Object.hasOwn(profile.applications, app) && profile.applications[app]) : Object.keys(profile.applications).filter(app => profile.applications[app]))];
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const record = { id: id('inv'), email: normalized, inviter: inviter.subject, inviterUsername: inviter.username, role, applications: assignedApplications, quotaProfile, expiresAt: new Date(Date.parse(this.clock()) + 1000 * 60 * 60 * 72).toISOString(), createdAt: this.clock(), acceptedAt: null, revokedAt: null, state: 'pending', tokenHash: tokenHash(rawToken), attempts: 0, provisioning: Object.fromEntries(assignedApplications.map(app => [app, { state: 'pending', error: null, updatedAt: null }])) };
    this.records.push(record);
    this.auditEvent('invite.created', inviter, record.id, { role, applications: assignedApplications, quotaProfile });
    if (this.deliveryMode === 'mock') this.delivery.push({ invitationId: record.id, status: 'mocked', previewUrl: `/invite/${rawToken}`, sentAt: this.clock() });
    await this.save();
    return { invitation: this.publicInvitation(record), previewUrl: `/invite/${rawToken}` };
  }

  findByToken(token) { return this.records.find(record => crypto.timingSafeEqual(Buffer.from(record.tokenHash), Buffer.from(tokenHash(token)))); }
  getById(invitationId) { return this.records.find(record => record.id === invitationId); }
  assertUsable(record) {
    if (!record) throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' });
    if (record.revokedAt || record.state === 'revoked') throw Object.assign(new Error('This invitation has been revoked'), { code: 'REVOKED' });
    if (record.acceptedAt || record.state !== 'pending') throw Object.assign(new Error('This invitation has already been used'), { code: 'USED' });
    if (new Date(record.expiresAt) <= new Date(this.clock())) throw Object.assign(new Error('This invitation has expired'), { code: 'EXPIRED' });
  }
  async inspectToken(token) { const record = this.findByToken(token); this.assertUsable(record); return { email: record.email, role: record.role, applications: record.applications, quotaProfile: record.quotaProfile, expiresAt: record.expiresAt }; }
  async accept(token, actor) {
    const record = this.findByToken(token); this.assertUsable(record);
    record.acceptedAt = this.clock(); record.attempts += 1; record.state = 'identity_created';
    this.auditEvent('invite.accepted', actor, record.id, { email: record.email });
    await this.save(); return this.publicInvitation(record);
  }
  async revoke(invitationId, actor) {
    const record = this.getById(invitationId); if (!record) throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' });
    if (record.state === 'ready' || record.state === 'suspended') throw Object.assign(new Error('Ready accounts must be suspended through the identity provider'), { code: 'INVALID_STATE' });
    record.state = 'revoked'; record.revokedAt = this.clock(); this.auditEvent('invite.revoked', actor, record.id); await this.save(); return this.publicInvitation(record);
  }
  async resend(invitationId, actor) {
    const record = this.getById(invitationId); if (!record) throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' });
    if (record.state !== 'pending') throw Object.assign(new Error('Only pending invitations can be resent'), { code: 'INVALID_STATE' });
    record.expiresAt = new Date(Date.parse(this.clock()) + 1000 * 60 * 60 * 72).toISOString();
    this.auditEvent('invite.resent', actor, record.id); await this.save(); return this.publicInvitation(record);
  }
  async retry(invitationId, actor) {
    const record = this.getById(invitationId); if (!record) throw Object.assign(new Error('Invitation not found'), { code: 'NOT_FOUND' });
    if (!['partially_provisioned', 'failed'].includes(record.state)) throw Object.assign(new Error('This invitation has no failed provisioning work'), { code: 'INVALID_STATE' });
    record.state = 'provisioning'; Object.values(record.provisioning).forEach(status => { if (status.state === 'failed') status.state = 'pending'; });
    this.auditEvent('provision.retry', actor, record.id); await this.save(); return this.publicInvitation(record);
  }
}

module.exports = { InvitationService, ROLES, STATES, DEFAULT_PROFILES, normalizeEmail };
