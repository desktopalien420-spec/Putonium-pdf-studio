#!/usr/bin/env python3
"""Verify public Immich CSS before/after a user-approved native UI theme save."""
import hashlib
import http.client
from pathlib import Path
import socket
import ssl
import sys

CSS_SHA = '3c59b0aabdc20edc74ac32ad62e3dd837f1a8d9e8ab10dce74bdb06b6dadf5c3'
BASELINE_SHA = '2fd9b3f5aad4ede26c4807cd2a039b2d3e707d5c63476bd3fa6fd963c76a7700'


def normalized(value):
    return value.replace('\r\n', '\n').strip()


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ['before', 'after']:
        raise RuntimeError('Choose before or after.')
    expected = (Path(__file__).resolve().parent / 'immich-plutonium-v2.css').read_bytes()
    if hashlib.sha256(expected).hexdigest() != CSS_SHA:
        raise RuntimeError('Reviewed candidate CSS differs; preserve it.')
    with socket.create_connection(('192.168.8.153', 443), timeout=15) as raw:
        with ssl.create_default_context().wrap_socket(raw, server_hostname='photos.plutoniumcloud.com') as conn:
            conn.sendall(b'GET /custom.css HTTP/1.1\r\nHost: photos.plutoniumcloud.com\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n')
            response = http.client.HTTPResponse(conn)
            response.begin()
            body = response.read(1048576)
            if response.status != 200 or 'text/css' not in response.headers.get('Content-Type', ''):
                raise RuntimeError('Native custom CSS response requires review.')
    actual = normalized(body.decode('utf-8'))
    if sys.argv[1] == 'before':
        baseline = (Path(__file__).resolve().parent / 'immich-plutonium-v1.css').read_bytes()
        if hashlib.sha256(baseline).hexdigest() != BASELINE_SHA or actual != normalized(baseline.decode('utf-8')):
            raise RuntimeError('Current CSS differs from accepted v1; preserve any new customization.')
        print('IMMICH BRANDING BASELINE VERIFIED: accepted palette v1 is active. No settings changed.')
    else:
        if actual != normalized(expected.decode('utf-8')):
            raise RuntimeError('Native CSS differs from reviewed candidate; retain settings and report this bounded output.')
        print('IMMICH BRANDING DELIVERY VERIFIED: reviewed logo and palette CSS is served over trusted HTTPS. Browser/library acceptance remains your check.')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('STOPPED: ' + (str(error) if isinstance(error, RuntimeError) else type(error).__name__ + '; raw details withheld.'))
        sys.exit(1)
