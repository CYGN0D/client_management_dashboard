#!/usr/bin/env python3
"""
MIGRATE SUPABASE + PHONEPE RECONCILED DATA INTO CLIENTO
Imports 12 verified clients, their invoices, and payment records into database/cliento.db for user_id = 1.
"""

import sqlite3
import re
import csv
from datetime import datetime
import uuid

DB_PATH = 'database/cliento.db'
SQL_DUMP_PATH = '/tmp/supabase_dump.sql'
PHONEPE_CSV_PATH = '/home/ubuntu/.gemini/antigravity-cli/brain/89fe82a9-bf27-468c-bf06-02dc3b0b3036/.user_uploaded/media_1793773827101_20e2be13.csv'

def parse_phonepe_date(d_str):
    clean = d_str.replace('Sept', 'Sep').strip()
    return datetime.strptime(clean, '%b %d, %Y').strftime('%Y-%m-%d')

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    cursor = conn.cursor()

    # Verify user_id = 1
    cursor.execute("SELECT id, name, email FROM users WHERE id = 1")
    user = cursor.fetchone()
    if not user:
        raise ValueError("User ID 1 not found in users table!")
    print(f"Target User: ID {user[0]} ({user[1]} - {user[2]})")

    # 1. Parse Supabase dump
    with open(SQL_DUMP_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        sql = f.read()

    copy_blocks = {}
    for m in re.finditer(r'COPY public\.([a-zA-Z0-9_]+) \((.*?)\) FROM stdin;\n(.*?)\n\\\.', sql, re.DOTALL):
        table, cols, data = m.groups()
        copy_blocks[table] = (cols.split(', '), [l.split('\t') for l in data.strip().split('\n') if l.strip()])

    cols_c, rows_c = copy_blocks['clients']
    sb_clients = {r[0]: r[1] for r in rows_c}

    cols_e, rows_e = copy_blocks['entries']
    sb_entries = [dict(zip(cols_e, r)) for r in rows_e]

    # 2. Parse PhonePe credits
    with open(PHONEPE_CSV_PATH, 'r', encoding='utf-8', errors='ignore') as f:
        p_rows = list(csv.reader(f))[4:]

    phonepe_credits = []
    for r in p_rows:
        if len(r) >= 8 and r[5].strip().upper() == 'CREDIT':
            sender = r[2]
            if sender.startswith('Received from '):
                sender = sender[len('Received from '):].strip()
            iso_d = parse_phonepe_date(r[0])
            phonepe_credits.append({
                'date_str': r[0].strip(),
                'iso_date': iso_d,
                'amount': float(r[7].replace(',', '').strip() or 0),
                'sender': sender,
                'utr': r[4].strip(),
                'tx_id': r[3].strip()
            })

    print(f"Loaded {len(sb_entries)} Supabase entries and {len(phonepe_credits)} PhonePe credit transactions.")

    # 3. Client Specifications
    client_specs = [
        {
            'slug': 'jasman',
            'name': 'Jasman Store',
            'company': 'Jasman E-commerce',
            'service': 'Web Dev, Server/Hosting, Domain Management',
            'monthly_amount': 1200.0,
            'due_day': 5,
            'joining_date': '2026-01-05',
            'notes': 'UPI Senders: Jaskaran Singh, MD OBAID',
            'senders': ['Jaskaran Singh', 'JASKARAN  SINGH', 'MD OBAID']
        },
        {
            'slug': 'batman',
            'name': 'Batman Store',
            'company': 'Batman Store Pvt',
            'service': 'Hosting Retainer, Push Notifications',
            'monthly_amount': 2000.0,
            'due_day': 17,
            'joining_date': '2026-03-08',
            'notes': 'UPI Sender: Md Nasim Alam',
            'senders': ['Md Nasim Alam', 'Mr Md Nasim Alam']
        },
        {
            'slug': 'gamex',
            'name': 'Gamex Store',
            'company': 'Gamex Gaming Store',
            'service': 'Server Cost, Hosting, Domain Management',
            'monthly_amount': 2000.0,
            'due_day': 5,
            'joining_date': '2026-01-21',
            'notes': 'UPI Senders: Pritpal Singh, Gurdip Kaur, Hargunpal Singh, Kamaldeep Kaur',
            'senders': ['Gurdip Kaur', 'GURDEEP KAUR', 'Pritpal  Singh', 'HARGUNPAL SINGH', 'Kamaldeep  Kaur']
        },
        {
            'slug': 'vansh',
            'name': 'Vansh Gupta',
            'company': 'Ehika Agency',
            'service': 'Ehika Agency, Hosting, Product Updates',
            'monthly_amount': 2000.0,
            'due_day': 5,
            'joining_date': '2026-01-23',
            'notes': 'UPI Sender: VANSH ਪੁੱਤਰ',
            'senders': ['VANSH ਪੁੱਤਰ']
        },
        {
            'slug': 'jr_scientist',
            'name': 'Jr Scientist',
            'company': 'Sparkovation / Jr Scientist',
            'service': 'Attendance System, IoT, Sparkovation Projects',
            'monthly_amount': 1000.0,
            'due_day': 5,
            'joining_date': '2026-03-28',
            'notes': 'UPI Senders: Jr Scientist, Sushant kumar',
            'senders': ['Jr Scientist', 'Sushant kumar']
        },
        {
            'slug': 'beskar',
            'name': 'Beskar',
            'company': 'Beskar Tech',
            'service': 'Web Dev, Hosting',
            'monthly_amount': 1500.0,
            'due_day': 29,
            'joining_date': '2026-04-28',
            'notes': 'UPI Sender: Atif Ali',
            'senders': ['Atif Ali', 'ATIF ALI']
        },
        {
            'slug': 'ff_store',
            'name': 'FF store',
            'company': 'Free Fire Game Store',
            'service': 'Web Dev, SEO, Hosting',
            'monthly_amount': 1400.0,
            'due_day': 5,
            'joining_date': '2026-04-26',
            'notes': 'UPI Sender: Shakti Soni',
            'senders': ['Shakti Soni', 'SHAKTI SONI']
        },
        {
            'slug': 'harshajod',
            'name': 'HarshaJod',
            'company': 'Harsha Gaming',
            'service': 'Web Dev, Hosting',
            'monthly_amount': 1500.0,
            'due_day': 5,
            'joining_date': '2026-07-02',
            'notes': 'UPI Senders: GUDURU SRIHARSHA, Harsha Jod',
            'senders': ['GUDURU SRIHARSHA', 'Harsha Jod']
        },
        {
            'slug': 'honest_ff',
            'name': 'Honest ff store',
            'company': 'Honest FF Services',
            'service': 'Web Dev & Hosting',
            'monthly_amount': 1500.0,
            'due_day': 5,
            'joining_date': '2026-07-11',
            'notes': 'UPI Senders: Praveen Kumar Labaniya, Abhishek Sharma',
            'senders': ['Praveen Kumar Labaniya', 'PRAVEEN KUMAR LABANI', 'Abhishek Sharma']
        },
        {
            'slug': 'avaitor',
            'name': 'avaitor',
            'company': 'Avaitor Project',
            'service': 'Web Development',
            'monthly_amount': 2000.0,
            'due_day': 5,
            'joining_date': '2026-10-05',
            'notes': 'UPI Sender: VIKAS',
            'senders': ['VIKAS']
        },
        {
            'slug': 'gamex_copy',
            'name': 'Gamex-Copy',
            'company': 'Gamex Clone Site',
            'service': 'Server and Domain Setup',
            'monthly_amount': 1500.0,
            'due_day': 5,
            'joining_date': '2026-04-08',
            'notes': 'UPI Sender: karanganday',
            'senders': ['karanganday']
        },
        {
            'slug': 'axion',
            'name': 'Axion Store',
            'company': 'axionstore',
            'service': 'Web Dev & Hosting (axionstore)',
            'monthly_amount': 2000.0,
            'due_day': 5,
            'joining_date': '2026-10-30',
            'notes': 'UPI Senders: KISHORSINH MAHAVIRSINH VAJA, KAVAD VISHAL NARSHIBHAI, Mr NARSIBHAI PUNABHAI KAVAD',
            'senders': ['KISHORSINH MAHAVIRSINH VAJA', 'KAVAD VISHAL NARSHIBHAI', 'Mr NARSIBHAI PUNABHAI KAVAD']
        }
    ]

    conn.execute("BEGIN TRANSACTION")

    created_clients = {}
    for spec in client_specs:
        cursor.execute("SELECT id FROM clients WHERE user_id = 1 AND name = ?", (spec['name'],))
        row = cursor.fetchone()
        if row:
            client_id = row[0]
            cursor.execute("""
                UPDATE clients SET
                    company = ?, service = ?, monthly_amount = ?, due_day = ?,
                    joining_date = ?, notes = ?, status = 'active', retainer_status = 'active',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (spec['company'], spec['service'], spec['monthly_amount'], spec['due_day'], spec['joining_date'], spec['notes'], client_id))
            print(f"Updated client: {spec['name']} (ID: {client_id})")
        else:
            client_code = f"cli_{spec['slug']}"
            cursor.execute("""
                INSERT INTO clients (
                    client_code, user_id, name, company, service, monthly_amount,
                    due_day, retainer_status, status, joining_date, notes
                ) VALUES (?, 1, ?, ?, ?, ?, ?, 'active', 'active', ?, ?)
            """, (client_code, spec['name'], spec['company'], spec['service'], spec['monthly_amount'], spec['due_day'], spec['joining_date'], spec['notes']))
            client_id = cursor.lastrowid
            print(f"Created client: {spec['name']} (ID: {client_id}, Code: {client_code})")
        
        created_clients[spec['name']] = client_id

    # Track phonepe payments matched to avoid double counting
    matched_phonepe_indices = set()

    def find_phonepe_match(client_name, amount, date_str):
        spec = next((s for s in client_specs if s['name'] == client_name), None)
        if not spec:
            return None
        
        target_dt = datetime.strptime(date_str, '%Y-%m-%d')
        
        best_match = None
        best_diff = 999
        best_idx = None
        
        for idx, p in enumerate(phonepe_credits):
            if idx in matched_phonepe_indices:
                continue
            if p['sender'] in spec['senders'] and abs(p['amount'] - amount) < 1.0:
                p_dt = datetime.strptime(p['iso_date'], '%Y-%m-%d')
                days_diff = abs((p_dt - target_dt).days)
                if days_diff < 15 and days_diff < best_diff:
                    best_diff = days_diff
                    best_match = p
                    best_idx = idx
        
        if best_match and best_idx is not None:
            matched_phonepe_indices.add(best_idx)
            return best_match
        return None

    # 4. Insert Supabase Entries
    total_invoices_created = 0
    total_payments_created = 0

    invoice_counter = 1000

    for e in sb_entries:
        cid = e['client_id']
        cname = sb_clients.get(cid)
        if not cname or cname not in created_clients:
            continue
        
        db_client_id = created_clients[cname]
        amount = float(e['amount'])
        status = e['status'].lower().strip()
        date_str = e['date'].strip()
        title = e['title'].strip() or 'Service'
        notes = e['notes'] if e['notes'] != '\\N' else ''
        inv_no = e['invoice_no'] if e['invoice_no'] != '\\N' else None

        billing_month = date_str[:7] # YYYY-MM
        
        # Charge type: if title has hosting / server / monthly, classify as retainer or custom
        # To respect uk_client_retainer_month (only 1 retainer per client per month),
        # we check if a retainer already exists for this client and month:
        cursor.execute("""
            SELECT id FROM invoices 
            WHERE client_id = ? AND billing_month = ? AND charge_type = 'retainer'
        """, (db_client_id, billing_month))
        existing_retainer = cursor.fetchone()

        is_retainer_title = any(k in title.lower() for k in ['hosting', 'server per month', 'retainer'])
        if is_retainer_title and not existing_retainer:
            charge_type = 'retainer'
        else:
            charge_type = 'custom'

        invoice_counter += 1
        invoice_code = f"inv_sb_{invoice_counter}"
        if not inv_no:
            inv_no = f"INV-{billing_month.replace('-', '')}-{invoice_counter}"

        due_date = date_str

        # Check if invoice already exists
        cursor.execute("SELECT id FROM invoices WHERE invoice_number = ?", (inv_no,))
        existing_inv = cursor.fetchone()
        if existing_inv:
            inv_id = existing_inv[0]
        else:
            cursor.execute("""
                INSERT INTO invoices (
                    invoice_code, user_id, client_id, invoice_number, service_name,
                    charge_type, notes, billing_month, amount, due_date, status, created_at
                ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (invoice_code, db_client_id, inv_no, title, charge_type, notes, billing_month, amount, due_date, status, f"{date_str} 10:00:00"))
            inv_id = cursor.lastrowid
            total_invoices_created += 1

        # If status is paid, create a payment record
        if status == 'paid':
            cursor.execute("SELECT id FROM payments WHERE invoice_id = ?", (inv_id,))
            if not cursor.fetchone():
                p_match = find_phonepe_match(cname, amount, date_str)
                utr = p_match['utr'] if p_match else None
                ref_notes = f"Received from {p_match['sender']} (PhonePe)" if p_match else notes
                
                pay_code = f"pay_{invoice_counter}"
                cursor.execute("""
                    INSERT INTO payments (
                        payment_code, user_id, invoice_id, client_id, amount,
                        payment_date, payment_method, notes, reference_number, created_at
                    ) VALUES (?, 1, ?, ?, ?, ?, 'UPI / PhonePe', ?, ?, ?)
                """, (pay_code, inv_id, db_client_id, amount, date_str, ref_notes, utr, f"{date_str} 12:00:00"))
                total_payments_created += 1

    # 5. Insert remaining PhonePe transactions that were not in Supabase
    # (e.g. Axion Store, Kamaldeep Kaur for Gamex, VIKAS 2nd payment, etc.)
    for idx, p in enumerate(phonepe_credits):
        if idx in matched_phonepe_indices:
            continue
        
        # Check which client this belongs to
        matched_client_name = None
        for spec in client_specs:
            if p['sender'] in spec['senders']:
                matched_client_name = spec['name']
                break
        
        if not matched_client_name:
            continue
        
        db_client_id = created_clients[matched_client_name]
        amount = p['amount']
        date_str = p['iso_date']
        billing_month = date_str[:7]
        
        cursor.execute("""
            SELECT id FROM invoices 
            WHERE client_id = ? AND billing_month = ? AND charge_type = 'retainer'
        """, (db_client_id, billing_month))
        existing_retainer = cursor.fetchone()

        charge_type = 'custom' if existing_retainer else 'retainer'
        
        invoice_counter += 1
        invoice_code = f"inv_pp_{invoice_counter}"
        inv_no = f"INV-PP-{billing_month.replace('-', '')}-{invoice_counter}"
        service_title = f"{client_specs[0]['service'].split(',')[0]} (PhonePe Inflow)"
        if matched_client_name == 'Axion Store':
            service_title = 'Hosting & Web Dev (Axion Store)'
        
        cursor.execute("""
            INSERT INTO invoices (
                invoice_code, user_id, client_id, invoice_number, service_name,
                charge_type, notes, billing_month, amount, due_date, status, created_at
            ) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)
        """, (invoice_code, db_client_id, inv_no, service_title, charge_type, f"PhonePe UTR: {p['utr']}", billing_month, amount, date_str, f"{date_str} 10:00:00"))
        inv_id = cursor.lastrowid
        total_invoices_created += 1

        pay_code = f"pay_pp_{invoice_counter}"
        cursor.execute("""
            INSERT INTO payments (
                payment_code, user_id, invoice_id, client_id, amount,
                payment_date, payment_method, notes, reference_number, created_at
            ) VALUES (?, 1, ?, ?, ?, ?, 'UPI / PhonePe', ?, ?, ?)
        """, (pay_code, inv_id, db_client_id, amount, date_str, f"Received from {p['sender']}", p['utr'], f"{date_str} 12:00:00"))
        total_payments_created += 1
        matched_phonepe_indices.add(idx)

    conn.commit()
    conn.close()

    print("\n=== MIGRATION COMPLETE ===")
    print(f"Total Clients Processed: {len(created_clients)}")
    print(f"Total Invoices Created: {total_invoices_created}")
    print(f"Total Payments Created: {total_payments_created}")
    print(f"Total PhonePe Matches Linked: {len(matched_phonepe_indices)}")

if __name__ == '__main__':
    main()
