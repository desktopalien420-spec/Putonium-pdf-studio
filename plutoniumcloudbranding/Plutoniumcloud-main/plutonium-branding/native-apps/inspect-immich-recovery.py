#!/usr/bin/env python3
"""Read-only local Immich administrator inventory; never print password hashes."""
import json
import os
import subprocess
import sys


class Stop(RuntimeError):
    pass


def query(sql):
    # PostgreSQL enforces a read-only session in addition to our SELECT-only statements.
    result = subprocess.run([
        'docker', 'exec', '--user', 'postgres', '--env', 'PGOPTIONS=-c default_transaction_read_only=on',
        'homelab-immich-database', 'psql', '--no-psqlrc', '--username=postgres', '--dbname=immich',
        '--tuples-only', '--no-align', '--set=ON_ERROR_STOP=1', '--command', sql,
    ], capture_output=True, text=True, timeout=45)
    if result.returncode:
        raise Stop('Read-only administrator query failed; raw output withheld.')
    return json.loads(result.stdout.strip())


def main():
    if os.geteuid() != 0:
        raise Stop('Run using sudo python3.')
    columns = query("""SELECT COALESCE(json_agg(t),'[]'::json) FROM (
        SELECT table_name,column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name IN ('user','users')
        AND column_name IN ('email','name','isAdmin','is_admin','deletedAt','deleted_at','status','password','oauthId','oauth_id')
        ORDER BY table_name,column_name
    ) t""")
    tables = {}
    for item in columns:
        tables.setdefault(item['table_name'], set()).add(item['column_name'])
    valid = [(table, cols) for table, cols in tables.items()
             if {'email', 'name'} <= cols and bool({'isAdmin', 'is_admin'} & cols)]
    if len(valid) != 1:
        raise Stop('Expected one identifiable user table; preserve database and accounts.')
    table, cols = valid[0]
    # Every identifier below comes only from the fixed whitelist above, never user input.
    quote = lambda name: '"' + name + '"'
    admin = 'isAdmin' if 'isAdmin' in cols else 'is_admin'
    deleted = next((x for x in ['deletedAt', 'deleted_at'] if x in cols), None)
    oauth = next((x for x in ['oauthId', 'oauth_id'] if x in cols), None)
    fields = ["'email'," + quote('email'), "'name'," + quote('name'), "'is_admin'," + quote(admin)]
    if 'password' in cols:
        fields.append("'password_present',COALESCE(length(" + quote('password') + ")>0,false)")
    if deleted:
        fields.append("'deleted'," + quote(deleted) + ' IS NOT NULL')
    if oauth:
        fields.append("'oauth_linked',COALESCE(length(" + quote(oauth) + "::text)>0,false)")
    if 'status' in cols:
        fields.append("'status'," + quote('status') + '::text')
    records = query("SELECT COALESCE(json_agg(t.entry),'[]'::json) FROM (SELECT json_build_object(" +
                    ','.join(fields) + ') AS entry FROM public.' + quote(table) +
                    ' WHERE ' + quote(admin) + '=true ORDER BY ' + quote('email') + ' LIMIT 20) t')
    print('Local Immich administrator records: ' + str(len(records)), flush=True)
    for row in records:
        print(json.dumps(row), flush=True)
    print('READ-ONLY IMMICH RECOVERY INVENTORY COMPLETE. No password reset, role, account, OAuth, CSS or service changes.', flush=True)
    print('Use the administrator email with native password login; keep passwords private.', flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('STOPPED: ' + (str(error) if isinstance(error, Stop) else type(error).__name__ + '; raw diagnostics withheld.'), flush=True)
        sys.exit(1)
