"""Export only the supplied, unverified reference presets; no network rules inferred."""
import dataclasses,importlib.util,json,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('tnk_prop_reference',root/'quant/tuan_trader_v3_4.py')
mod=importlib.util.module_from_spec(spec);sys.modules[spec.name]=mod;spec.loader.exec_module(mod)
payload={k:dataclasses.asdict(v) for k,v in mod.DEFAULT_PROP_PRESETS.items()}
dest=root/'src/core/prop-presets-v34.json'
dest.write_text(json.dumps(payload,ensure_ascii=False,indent=2,default=str)+'\n',encoding='utf-8')
print('Exported',len(payload),'reference presets; verified flags:',[v['verified'] for v in payload.values()])
