#!/usr/bin/env python3
"""Build-time only acquisition, never used in client JavaScript."""
from urllib.request import Request, urlopen
from urllib.error import URLError
from pathlib import Path
import sys, hashlib, time
DEST=Path(__file__).resolve().parents[1]/'inputs'/'support_card.txt'
URL='https://raw.githubusercontent.com/mee1080/umasim/main/data/support_card.txt'
def fetch(url=URL, dest=DEST):
    dest.parent.mkdir(parents=True,exist_ok=True)
    error=None
    for attempt in range(3):
        try:
            with urlopen(Request(url,headers={'User-Agent':'UmaSupportLab-Build/0.7'}),timeout=45) as f: content=f.read()
            text=content.decode('utf-8-sig')
            if len(content)<100_000 or '\t' not in text:raise ValueError('Unusually short or malformed support data: refusing publication')
            count=len({line.split('\t',1)[0] for line in text.splitlines() if line.strip()})
            if count<450:raise ValueError(f'Expected >=450 unique card IDs, received {count}')
            temp=dest.with_suffix('.tmp');temp.write_bytes(content);temp.replace(dest)
            print(f'Fetched {count} card IDs, {len(content)} bytes, sha256={hashlib.sha256(content).hexdigest()}')
            return
        except (OSError,ValueError,URLError) as exc:
            error=exc
            if attempt<2:time.sleep(2*(attempt+1))
    raise RuntimeError(f'Build-time download failed, data not replaced: {error}')
if __name__=='__main__':fetch()