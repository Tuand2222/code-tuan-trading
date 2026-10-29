"""Deterministic browser oracles from the user-provided audited Python reference."""
import dataclasses,decimal,importlib.util,json,random,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('prop_oracle_reference',root/'quant/tuan_trader_v3_4.py')
M=importlib.util.module_from_spec(spec);sys.modules[spec.name]=M;spec.loader.exec_module(M)
fixtures=[]
for typ in M.MAXLOSS_TYPES:
 for after in M.AFTER_PAYOUT:
  for daily in ([20,30,40,50],[-50,100],[100,100,-20]):
   p=M.PropPresetV3('test','synthetic','synthetic','test',None,None,'',decimal.Decimal(1000),[],
    M.MaxLossRule(10,typ,False,decimal.Decimal(10),after),
    M.DailyLossRule(True,5),profit_split=.8,payout_cycle_days=2,min_payout=decimal.Decimal(0))
   r=M.simulate_funded_phase(random.Random(7),[],[],p,daily_returns=daily)
   cfg=dict(size=1000,ml=.1,dl=.05,f=.01,sp=.8,payoutDays=2,minPayout=0,payoutFraction=1,payoutCap=None,
    afterPayout=after,lockOffset=10,ddType=typ,mode='funded',comp=False)
   expected={k:r[k] for k in ['status','survived','reason','balance','floor','gross_payout','net_payout','payouts','path']}
   fixtures.append(dict(config=cfg,daily=daily,expected=expected))
dest=root/'tests/trading/fixtures/quant-prop-v34-oracles.json'
dest.write_text(json.dumps(fixtures,indent=2,default=str)+'\n',encoding='utf-8')
print('Exported',len(fixtures),'deterministic Python comparison paths')
