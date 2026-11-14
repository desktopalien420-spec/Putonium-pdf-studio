'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {InvitationService}=require('./invitation-service.cjs');

const inviter={subject:'admin-subject',username:'adrian'};

test('invitation service expires tokens and does not persist raw token material',async()=>{
  const service=new InvitationService();
  const result=await service.create({email:'person@example.com',role:'standard',quotaProfile:'standard',inviter});
  const record=service.records[0];
  assert.equal(result.invitation.tokenHash,undefined);
  assert.match(result.previewUrl,/^\/invite\//);
  record.expiresAt='2000-01-01T00:00:00.000Z';
  await assert.rejects(()=>service.inspectToken(result.previewUrl.split('/').pop()),error=>error.code==='EXPIRED');
});

test('application assignments are constrained by the selected quota profile',async()=>{
  const service=new InvitationService();
  const result=await service.create({email:'standard@example.com',role:'standard',quotaProfile:'standard',applications:['files','photos','plex','chat'],inviter});
  assert.deepEqual(result.invitation.applications,['files']);
  assert.deepEqual(Object.keys(result.invitation.provisioning),['files']);
});
