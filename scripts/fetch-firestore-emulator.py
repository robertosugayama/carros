"""Fetch the official Google Cloud SDK Firestore component and verify its published SHA-256."""
import hashlib, json, os, tarfile, urllib.request
base='https://dl.google.com/dl/cloudsdk/channels/rapid/'
with urllib.request.urlopen(base+'components-2.json',timeout=30) as response: manifest=json.load(response)
component=next(c for c in manifest['components'] if c['id']=='cloud-firestore-emulator')['data']
archive='/tmp/autotuner-firestore-component.tar.gz'
with urllib.request.urlopen(base+component['source'],timeout=60) as response,open(archive,'wb') as target:
    while data:=response.read(1024*1024): target.write(data)
with open(archive,'rb') as source: digest=hashlib.file_digest(source,'sha256').hexdigest()
if digest!=component['checksum']: raise RuntimeError('Official emulator checksum mismatch')
with tarfile.open(archive) as source:
    jar=next(m for m in source.getmembers() if m.name.endswith('/cloud-firestore-emulator.jar'))
    with open('/tmp/cloud-firestore-emulator.jar','wb') as target: target.write(source.extractfile(jar).read())
print('Official Firestore emulator verified: /tmp/cloud-firestore-emulator.jar')
