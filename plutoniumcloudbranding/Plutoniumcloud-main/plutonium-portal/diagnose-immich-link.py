#!/usr/bin/env python3
"""Classify recent Immich OAuth errors without printing raw logs or secrets."""
import os
import re
import subprocess
import sys

PATTERNS = {
 'OAuth linking error': r'failed to link oauth|oauth link account failed',
 'OAuth token/profile exchange failed': r'oauth login failed|getProfileAndOAuthSid',
 'Client credentials rejected': r'invalid_client|client authentication failed|invalid client secret|unknown client',
 'Authorization grant rejected': r'invalid_grant',
 'Redirect URI rejected': r'redirect_uri_mismatch|invalid_redirect_uri|redirect uri.*(?:mismatch|invalid|not allowed)',
 'Signing algorithm mismatch': r'unexpected JWT alg|Algorithm mismatch|unexpected.*(?:alg|algorithm)|unsupported.*(?:alg|algorithm)',
 'Signing key missing or mismatched': r'no applicable key|no matching.*key|signature verification failed|ERR_JWKS_NO_MATCHING_KEY|ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
 'Issuer or audience validation failed': r'unexpected.*(?:issuer|audience)|(?:iss|aud) claim.*(?:failed|mismatch)|ERR_JWT_CLAIM_VALIDATION_FAILED',
 'OAuth state missing or mismatched': r'OAuth state is missing|state mismatch|unexpected.*state|invalid.*state',
 'OAuth PKCE verifier missing': r'OAuth code verifier is missing|code verifier.*(?:missing|invalid)|PKCE.*(?:failed|invalid)',
 'OAuth identity already belongs to another account': r'already been linked to another user|sub is already linked|email already linked to different account',
 'Profile schema validation failed': r'ZodError|ZodValidationError|OAuthProfileSchema|parseOAuthClaims',
 'Profile email issue mentioned': r'profile does not have an email|invalid email|Invalid email address',
 'Token expired or time check failed': r'ERR_JWT_EXPIRED|JWTExpired|token.*expired|timestamp check failed',
 'Discovery or fetch failed': r'Error in OAuth discovery|fetch failed',
 'TLS verification error': r'CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE|ERR_TLS_CERT_ALTNAME_INVALID|SELF_SIGNED_CERT_IN_CHAIN',
}
CODES = ['invalid_client','invalid_grant','invalid_request','unauthorized_client','access_denied','invalid_scope','OAUTH_INVALID_RESPONSE','OAUTH_RESPONSE_BODY_ERROR','OAUTH_JWT_CLAIM_COMPARISON_FAILED','OAUTH_KEY_SELECTION_FAILED','OAUTH_INVALID_SERVER_METADATA','OAUTH_UNSUPPORTED_OPERATION','OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED','ECONNREFUSED','ETIMEDOUT','ENOTFOUND','EAI_AGAIN']
if os.geteuid()!=0:sys.exit('Run with sudo python3.')
try:
 result=subprocess.run(['docker','logs','--since','30m','--tail','2500','homelab-immich-server'],capture_output=True,text=True,timeout=45)
 if result.returncode:raise RuntimeError()
 raw=re.sub(r'\x1b\[[0-9;]*m','',result.stdout+'\n'+result.stderr)
 print('Recent Immich log lines inspected: '+str(len(raw.splitlines())))
 matched=False
 for label, pattern in PATTERNS.items():
  count=len(re.findall(pattern,raw,re.IGNORECASE))
  if count:
   matched=True
   print('Recognized category: '+label+'; matches='+str(count))
 for code in CODES:
  if re.search(r'(?<![A-Za-z0-9_])'+re.escape(code)+r'(?![A-Za-z0-9_])',raw,re.IGNORECASE):
   matched=True
   print('Recognized error code: '+code)
 for algorithm in ['RS256','RS384','RS512','ES256','ES384','ES512','HS256','HS384','HS512','EdDSA']:
  if re.search(r'(?<![A-Za-z0-9_])'+algorithm+r'(?![A-Za-z0-9_])',raw):
   print('Algorithm name mentioned in recent logs: '+algorithm)
 if not matched: print('No recognized OAuth error category; do not print raw logs.')
 print('READ-ONLY LINK DIAGNOSTIC COMPLETE. No credentials, raw logs, account changes, or file changes.')
except Exception as e:
 print('STOPPED: '+type(e).__name__+'; raw diagnostic output withheld.')
 sys.exit(1)
