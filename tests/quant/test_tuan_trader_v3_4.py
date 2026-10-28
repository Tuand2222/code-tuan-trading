"""v3.4: 125 vectors reconstructed from supplied specification + independent B/edge regressions.
Run: python -m pytest -v test_tuan_trader_v3_4.py
TUAN_ENGINE_PATH permits the same base vectors to run against the untouched supplied input.
No snapshots, skips, xfail or altered production-generated expected values.
"""
import copy
import datetime as dt
import importlib.util
import inspect
import json
import math
import os
import random
import sys
from decimal import Decimal, getcontext
from fractions import Fraction
from pathlib import Path
import pytest

ENGINE_PATH = Path(os.environ.get('TUAN_ENGINE_PATH',Path(__file__).resolve().parents[2]/'quant'/'tuan_trader_v3_4.py'))
spec=importlib.util.spec_from_file_location('tuan_engine_under_test',ENGINE_PATH)
M=importlib.util.module_from_spec(spec); sys.modules[spec.name]=M; spec.loader.exec_module(M)
D=Decimal
STD=[2,-1,-1,1.5,-1,3,-1,.5,-1,2]
BE=[2,-1,-1,1.5,-1,3,0,.5,0,2]
HALF=[2,-.5,-.5,1.5,-.5,3,-.5,.5,-.5,2]
FILLS=[('buy',1,100,'.10',95,'2026-01-01T00:00:00Z'),('buy',1,110,'.11',104,'2026-01-01T01:00:00Z'),
       ('sell','1.5',120,'.18',None,'2026-01-01T02:00:00Z')]
BASE_VECTORS=[]
def V(group,call,args,expected,source,kwargs=None):
    number=sum(v['group']==group for v in BASE_VECTORS)+1
    BASE_VECTORS.append(dict(id=f'G{group:02d}-{number:02d}',group=group,call=call,args=args,kwargs=kwargs or {},expected=expected,source=source))

def decimal_value(value): return {'decimal':str(value)}
def close(value,tolerance=1e-9): return {'approx':value,'abs':tolerance}
def member(value): return {'contains':value}
S='Đặc tả §15.3 (giá trị chuẩn được cung cấp)'
T='Tính độc lập từ công thức đặc tả; không lấy output engine làm kỳ vọng'

# 1: 11 normalizations, all literal from the six-step normalization rule.
for raw,expected in [('XAUUSDm','XAUUSD'),('EURUSDc','EURUSD'),('BTC','BTC'),('VNM','VNM'),
                     ('BTCUSDT.P','BTCUSDT'),('ETHUSDT-PERP','ETHUSDT'),('BTC/USDT','BTCUSDT'),
                     (' eur_usd.pro ','EURUSD'),('USDJPY_i','USDJPY'),('GOLD#','GOLD'),('EURUSD.','EURUSD')]:
    V(1,'normalize',[raw],expected,'Đặc tả §7.1; chuỗi kỳ vọng viết trực tiếp')
# 2: 18 classifications plus two suggestions.
for symbol,ctx,expected in [
    ('XAU',None,dict(symbol='XAUUSD',cls='metal',status='auto_notice')),
    ('XAGUSD',None,dict(cls='metal',status='auto')),
    ('WTI',None,dict(symbol='USOIL',cls='oil')),
    ('NAS100',None,dict(cls='index')),
    ('VN30F1M',None,dict(cls='futures_vn')),
    ('EURUSD',None,dict(cls='forex',sub='quote_usd')),
    ('USDJPY',None,dict(cls='forex',sub='usd_base')),
    ('EURGBP',None,dict(cls='forex',sub='cross')),
    ('BTCUSDT',None,dict(cls='crypto_linear',quote='USDT')),
    ('ETHUSDC',None,dict(cls='crypto_linear',quote='USDC')),
    ('BTCUSD',None,dict(status='needs_confirm')),
    ('EUR',None,dict(status='needs_confirm')),
    ('BTC',None,dict(symbol='BTCUSDT',status='auto_notice')),
    ('BTC','stock_vn',dict(status='needs_confirm')),
    ('FPT',None,dict(cls='stock_vn')),
    ('ABC','stock_vn',dict(cls='stock_vn')),
    ('AAPL','stock_intl',dict(cls='stock_intl')),
    ('XAU','stock_vn',dict(cls='metal',symbol='XAUUSD'))]:
    V(2,'classify',[symbol],expected,'Đặc tả §7.2, thứ tự phân loại',dict(ctx_market=ctx))
V(2,'suggest',['USOLIU'],['USOIL'],'Đặc tả §7.3')
V(2,'suggest',['SP100'],['SP500','SPX500','UK100'],'Đặc tả §7.3')
# 3: 25 sizing scenarios, all volumes/amounts independently specified.
def SZ(symbol,entry,sl,expected,**kwargs):
    args=dict(equity='10000',risk_pct='1',entry=str(entry),sl=str(sl),direction='buy',sym=symbol)
    args.update(kwargs)
    V(3,'size_position',[],expected,S,args)
SZ('EURUSD','1.085','1.083',dict(status='ok',volume=decimal_value('.50'),loss_lot=decimal_value(200)))
SZ('USDJPY',155,154,dict(volume=decimal_value('.15'),risk_actual=close(97.4025974025974)))
SZ('USDJPY',155,156,dict(volume=decimal_value('.15'),risk_actual=close(96.15384615384615)),direction='sell')
SZ('XAUUSD',2650,2640,dict(volume=decimal_value('.10')))
SZ('XAU',2650,2640,dict(volume=decimal_value('.10')))
SZ('XAGUSD',31,'30.5',dict(volume=decimal_value('.04')))
SZ('USOIL',70,'69.5',dict(volume=decimal_value('.20')))
SZ('NAS100',20000,19900,dict(volume=decimal_value('1.00')))
SZ('NAS100',20000,19900,dict(volume=decimal_value('.10')),csize_override=10)
SZ('BTCUSDT',60000,59000,dict(volume=decimal_value('.100')),account='USDT')
SZ('BTCUSDT',60000,59000,dict(volume=decimal_value('.100'),flags=member('stablecoin_usd_peg_assumed')))
SZ('EURGBP','.86','.858',dict(volume=decimal_value('.38'),vpoint=decimal_value(130000),loss_lot=decimal_value(260)),fx={('GBP','USD'):'1.30'})
SZ('EURGBP','.86','.858',dict(status='error'))
SZ('EURUSD','1.085','1.083',dict(volume=decimal_value('.48')),comm_lot=7)
SZ('EURUSD','1.085','1.083',dict(volume=decimal_value('.45')),slip='.0002')
SZ('EURUSD','1.085','1.084',dict(volume=decimal_value('.70')),equity=7000)
SZ('EURUSD','1.085','1.080',dict(status='below_min',volume=decimal_value(0),minLotRisk=decimal_value(5)),equity=500,risk_pct='.5')
SZ('EURUSD','1.085','1.09',dict(status='error'))
SZ('SP100',100,90,dict(status='needs_confirm'))
SZ('EUR',100,90,dict(status='needs_confirm'))
SZ('FPT',120000,114000,dict(volume=decimal_value(800),risk_actual=decimal_value(4800000)),equity=500000000,account='VND')
SZ('FPT',120000,114000,dict(volume=decimal_value(700),loss_lot=decimal_value(6465),risk_actual=decimal_value(4525500)),equity=500000000,account='VND',fee_buy_rate='.0015',fee_sell_rate='.0015',tax_sell_rate='.001')
SZ('FPT',120000,114000,dict(status='error'),equity=500000000,account='VND',fee_buy_rate='.15')
SZ('VN30F1M',1300,1295,dict(volume=decimal_value(10),loss_lot=decimal_value(500000)),equity=500000000,account='VND')
SZ('FPT',120000,124000,dict(status='error'),equity=500000000,account='VND',direction='sell')
# 4: exactly 20 parser/vote/outlier scenarios.
for raw,sep,value in [('1,250.50','.', '1250.50'),('1.250,50',',','1250.50'),('(1,250.50)','.','-1250.50'),
                      ('100 USDT','.','100'),(' 1 250 ₫','.','1250'),('','.',None),('   ','.',None),('-', '.',None),('$','.',None),(True,'.',None)]:
    V(4,'parse_number',[raw,sep],None if value is None else decimal_value(value),'Đặc tả §9.2 / Q3')
for column,hint,expected in [(['1.25','2.50'],'.',['.',False]),(['1,25','2,50'],'.',[',',False]),
                              (['1.234.567'],'.',[',',False]),(['1,234,567'],'.',['.',False]),
                              (['1,234','2,500','1,000'],'.',['.',True])]:
    V(4,'column_decimal_sep',[column,hint],expected,'Đặc tả §9.2, bỏ phiếu tay')
V(4,'is_likely_ticket_id_column',[['123456789','987654321']],True,'§9.2: nguyên >=9 chữ số, duy nhất')
V(4,'flag_price_outliers',[[2650,2655,2640,2660,2648,2652,587.02]],[False,False,False,False,False,False,True],S)
V(4,'parse_number',['', '.', D(0)],decimal_value(0),'Q3: default explicit ở nơi gọi')
V(4,'parse_optional_cost',[''],[decimal_value(0),'fee_missing_as_zero'],'Đặc tả §9.2')
V(4,'parse_number',['NaN'],None,'§0: số không hữu hạn không hợp lệ')
# 5: implied and all-legs risk.
V(5,'implied_vpoint',['96.15',155,156,'.15'],dict(ok=True,vpoint=decimal_value(641)),S)
V(5,'implied_vpoint',['.5',155,156,'.15'],dict(ok=False,reason='gross_qua_nho_so_voi_do_lam_tron'),'§5.3: .005/.5=.01>.005')
V(5,'cycle_oneR',[[dict(price=100,sl=95,qty=1),dict(price=110,sl=104,qty=1)],1],dict(oneR=decimal_value(11),oneRSource='exact'),S)
V(5,'cycle_oneR',[[dict(price=100,sl=95,qty=1),dict(price=110,qty=1)],1,50],dict(oneR=decimal_value(50),oneRSource='fallback'),S)
# 6: NAV and Q1.
V(6,'drawdown',[10000,[('trade',1000),('trade',-500),('trade',-1000)]],dict(dd=close(1500/11000*100,1e-10),equity=decimal_value(9500)),S)
V(6,'drawdown',[10000,[('trade',1000),('cash',-5000),('trade',-500)]],dict(dd=close(500/6000*100,1e-10),equity=decimal_value(5500)),S)
V(6,'drawdown',[1000,[('trade',-1000)]],dict(dd=decimal_value(100)),S)
V(6,'drawdown',[10000,[('trade',1000,'2026-01-01'),('trade',-1000,'2026-01-01')],True],dict(dd=decimal_value(0),flags=member('intraday_order_unknown')),S)
V(6,'evaluate_safety_gate',[None,[]],dict(state='STANDBY',can_input=True),'Đặc tả §4.3')
V(6,'drawdown_r',[[-1]],dict(dd_r=decimal_value(1)),S)
# 7: three canonical Kelly values, seven integer ES boundaries, five metric guards.
for sample,k in [(STD,.2053489069),(BE,.3956162848),(HALF,.6816059592)]:
    V(7,'empirical_kelly',[sample],dict(f=close(k,5e-11)),S)
for n,k in [(10,1),(20,1),(21,2),(40,2),(60,3),(100,5),(200,10)]:
    # Distinct first k negatives: expected -(sum 1..k)/k; float ceil would add an extra tail at N=20.
    sample=list(range(-n,0))
    expected=n-(k-1)/2
    V(7,'metrics',[sample],dict(es5=close(expected)),S+f'; independent k={k}, ES={expected}')
V(7,'metrics',[STD],dict(N=10,mean=close(.4),pf=close(1.8),omega0=close(1.8),es5=close(1),p=close(.5),q=close(.5),b=close(1.8),sqn_grade='Khó giao dịch'),S)
V(7,'metrics',[[1,2]],dict(kelly=None,kelly_status='undefined_no_losses',pf_api=dict(status='infinite_no_losses')),S)
V(7,'metrics',[[0,0]],dict(pf=None,sqn=None,kelly=0.0),'§6: zero expectation, zero deviation')
V(7,'metrics',[[1]],dict(N=1,sqn=None),'§6: sample SD unavailable N=1')
V(7,'metrics',[[]],dict(N=0,status='empty'),'§6: empty data')
# 8: scenario dispatcher returns the existing FIFO cycle fields.
V(8,'scenario',['fifo_open'],dict(status='open',gross=decimal_value(25),net_price_units=decimal_value('24.665'),open_qty=decimal_value('.5'),entry_avg=decimal_value(105),entry_avg_closed={'fraction':[310,3]}),S)
V(8,'scenario',['fifo_closed'],dict(status='closed',qty=decimal_value(2),entry_avg=decimal_value(105),entry_avg_closed=decimal_value(105),exit_avg=decimal_value('122.5'),gross=decimal_value(35),net_price_units=decimal_value('34.55')),S)
V(8,'scenario',['fifo_flip'],dict(statuses=['closed','open'],directions=['long','short'],open_qty=decimal_value(1)),T+'; Buy1@100 Sell2@110')
V(8,'scenario',['fifo_short'],dict(status='closed',gross=decimal_value(10)),T+'; Sell1@110 Buy1@100')
V(8,'scenario',['fifo_orphan'],dict(net=decimal_value('19.9'),orphan=decimal_value(1)),S+'; Buy1@100 fee .05, Sell2@120 fee .10')
# 9: 10 prop statistical/floor/consistency vectors.
for p,n in [(.30,7),(.45,4),(.60,3),(0,None),(1,1)]: V(9,'n_attempts_independent',[p],n,S)
V(9,'eod_floor_series',[50000,'.04',[51000,52500,54000]],[decimal_value(49000),decimal_value(50000),decimal_value(50000)],S)
V(9,'check_consistency_rule',[[2200,800],3000,'.55'],dict(effective_target=decimal_value(4000),passed=False),S)
V(9,'check_consistency_rule',[[350,325,325],1000,'.30','FAIL_HARD'],dict(breached=True,passed=False),'§12.2: 350/1000=.35>.30')
V(9,'fail_streak_risk',[[0,1],5],dict(correlated=close(.5),naive_independent=close(1/32)),T+'; .5*(1^5+0^5)=.5')
V(9,'scenario',['monte_carlo'],dict(p5=close(8/300,1e-12),p50=close(296/300,1e-12),p95=close(1,1e-12)),S+'; seed42 Bayesian B200 M300 target8 static10')
# 10: four identity/multiset scenarios.
V(10,'scenario',['fingerprint_equivalence'],True,'§10: canonical raw formatting & normalized Decimal')
V(10,'scenario',['fingerprint_ticket'],True,'§10: ticket wins over mutable price/time')
V(10,'scenario',['multiset'],dict(new_count=1,skip_count=2,occurrence=2),'Đặc tả §15.2')
V(10,'scenario',['merge_candidate'],1,'§10: same day, exactly one dateOnly, equal qty and entry')
# 11: replay at open, date-only ignored; no projected capital.
V(11,'scenario',['replay'],dict(count=1,breach=True,date_flag=True),'Đặc tả §4.5')
# 12: three composite scenarios, explicitly described as such.
V(12,'hold_time_and_session',['2026-01-01T06:30:00Z','2026-01-01T07:00:00Z'],dict(session='Asia',holdTimeSeconds=1800),'Đặc tả §6.3; 30*60 seconds')
V(12,'scenario',['enrich'],dict(changed=True,notes='mine',status='closed',exitPrice=decimal_value(110)),'§10: open→closed update, notes protected')
V(12,'scenario',['net_ab'],dict(A=decimal_value(98),B=decimal_value(98)),'§9.3: gross100 + MT comm(-2) =98')
# 13: public JSON boundary (finite + infinite PF wrapper).
V(13,'scenario',['json_api'],dict(value=None,status='infinite_no_losses',display='∞'),'Đặc tả §0, §6.4')

def scenario(name):
    if name=='fifo_open': return M.fifo_cycles(FILLS)[0][0]
    if name=='fifo_closed': return M.fifo_cycles(FILLS+[('sell','.5',130,'.06')])[0][0]
    if name=='fifo_flip':
        c,_=M.fifo_cycles([('buy',1,100,0),('sell',2,110,0)])
        return dict(statuses=[v['status'] for v in c],directions=[v['direction'] for v in c],open_qty=c[1]['open_qty'])
    if name=='fifo_short': return M.fifo_cycles([('sell',1,110,0),('buy',1,100,0)])[0][0]
    if name=='fifo_orphan':
        c,_=M.fifo_cycles([('buy',1,100,'.05'),('sell',2,120,'.10')],False)
        return dict(net=c[0]['net_price_units'],orphan=c[1]['qty'])
    if name=='monte_carlo':
        p=custom_preset(target=8,loss=10)
        return M.prop_pass_probability(STD,p,b_outer=200,m_inner=300,resample='bayesian',seed=42)
    if name=='fingerprint_equivalence':
        return M.import_fingerprint('csv','a','2026.01.01 01:02:03','XAUUSDm','buy','1.00','2650.0')==M.import_fingerprint('csv','a','2026-01-01T01:02:03','XAUUSD','buy',1,2650)
    if name=='fingerprint_ticket':
        return M.import_fingerprint('csv','a','bad','X','buy',1,100,'77')==M.import_fingerprint('csv','a','different','Y','sell',2,999,'77')
    if name=='multiset':
        db=[dict(importFingerprint='f',occurrenceIndex=i,notes='mine') for i in range(2)]
        result=M.upsert_multiset_batch(db,[dict(importFingerprint='f',notes='incoming') for _ in range(3)],'b')
        return dict(new_count=result['new_count'],skip_count=result['skip_count'],occurrence=db[-1]['occurrenceIndex'])
    if name=='merge_candidate':
        a=dict(symbol='EURUSD',direction='buy',volume=1,day='20260101',date_only=True,entry_price=100)
        return len(M.find_merge_candidates(a,[dict(a,date_only=False)],'.01'))
    if name=='replay':
        trades=[dict(status='closed',openTime='2026-01-01T00:00:00Z',closeTime='2026-01-01T01:00:00Z',netPnl=-60),
                dict(status='open',openTime='2026-01-01T02:00:00Z'),dict(status='open',dateOnly=True,openTime='2026-01-01')]
        result,count=M.replay_tier_tags(1000,trades)
        return dict(count=count,breach='tier3_breach_at_open' in result[1]['autoTags'],date_flag='no_time_for_tier_check' in result[2]['flags'])
    if name=='enrich':
        r,changed=M.enrich_trade_record(dict(status='open',notes='mine',exitPrice=None),dict(status='closed',notes='bad',exitPrice=D(110)))
        return dict(r,changed=changed)
    if name=='net_ab':
        return dict(A=M.compute_net_pnl('A',gross_pnl=100,commission=-2)['netPnl'],B=M.compute_net_pnl('B',entry_price=100,exit_price=110,volume=1,vpoint_exit=10,commission=-2)['netPnl'])
    if name=='json_api': return M.metrics_to_json_safe(M.metrics([1,2]))['pf']
    raise AssertionError(name)

def custom_preset(target=1,loss=10,**kwargs):
    return M.PropPresetV3('test','Synthetic','Independent test','v3.4',None,None,'',D(1000),
                          [M.PhaseRule('eval',target)],M.MaxLossRule(loss),**kwargs)

def assert_expected(actual,expected):
    if isinstance(expected,dict):
        if 'decimal' in expected:
            assert isinstance(actual,D)
            assert actual==D(expected['decimal'])
        elif 'fraction' in expected:
            # Independent exact rational oracle; Decimal 40-digit division must be within 1e-35.
            rational=Fraction(*expected['fraction'])
            assert abs(actual-D(rational.numerator)/D(rational.denominator))<D('1e-35')
        elif 'approx' in expected:
            assert float(actual)==pytest.approx(expected['approx'],rel=0,abs=expected['abs'])
        elif 'contains' in expected:
            assert expected['contains'] in actual
        else:
            for key,value in expected.items():
                assert key in actual
                assert_expected(actual[key],value)
    elif isinstance(expected,list):
        assert len(actual)==len(expected)
        for a,e in zip(actual,expected): assert_expected(a,e)
    else: assert actual==expected

@pytest.mark.parametrize('vector',BASE_VECTORS,ids=[v['id'] for v in BASE_VECTORS])
def test_base_125(vector):
    result=scenario(*vector['args']) if vector['call']=='scenario' else getattr(M,vector['call'])(*vector['args'],**vector['kwargs'])
    assert_expected(result,vector['expected'])
    if vector['call']=='size_position' and result['status']=='ok':
        budget=D(str(vector['kwargs']['equity']))*D(str(vector['kwargs']['risk_pct']))/100
        assert result['risk_actual']<=budget

def test_inventory_has_exact_group_counts():
    assert [sum(v['group']==g for v in BASE_VECTORS) for g in range(1,14)]==[11,20,25,20,4,6,15,5,10,4,1,3,1]
    assert len(BASE_VECTORS)==125

# B1 — FIFO/account currency, explicit costs and multiple source groups.
@pytest.mark.parametrize('vp,fees_in_account,expected',[(1,True,'34.55'),(100000,True,'3499999.55'),(10,False,'345.50')])
def test_B1_cycle_money_units(vp,fees_in_account,expected):
    c=M.fifo_cycles(FILLS+[('sell','.5',130,'.06')])[0][0]
    result=M.compute_net_pnl('C',cycle=c,vpoint_exit=vp,fees_in_account=fees_in_account)
    assert result['netPnl']==D(expected)
    rec=result['trades'][0]
    assert rec['netPnlSource']=='derived_C'
    assert (rec['net_price_units'] is None)==(vp!=1)
    assert rec['entryPrice']==D(105)

def test_B1_missing_vpoint_and_fills():
    assert M.compute_net_pnl('C')['status']=='error'
    assert M.compute_net_pnl('C',fills=FILLS)['status']=='error'

def test_B1_fee_fx_is_applied():
    r=M.compute_net_pnl('A',gross_pnl=100,fee='.001',source_type='binance_futures',fee_currency='BNB',fee_fx_rate=600)
    assert r['netPnl']==D('99.4')
    u=M.compute_net_pnl('A',gross_pnl=100,fee='.001',source_type='binance_futures',fee_currency='BNB')
    assert not u['feeKnown'] and 'fee_unconverted' in u['flags']

# B2 — SL side, backwards-compatible abs behavior, fallback and SQN exclusion.
@pytest.mark.parametrize('direction,entry,sl,expected',[('buy',100,95,5),('buy',100,105,None),('sell',100,105,5),('sell',100,95,None),('buy',100,100,None)])
def test_B2_side(direction,entry,sl,expected):
    assert M.risk1r(entry,sl,1,1,direction)==(D(expected) if expected is not None else None)

def test_B2_legacy_abs_and_cycle_fallback():
    assert M.risk1r(100,105,1,1)==D(5)
    r=M.compute_r_multiple(50,entry_legs=[dict(price=100,sl=105,qty=1,side='buy')],vpoint=1,
                           fallback_config=dict(mode='fixed_amount',fixedAmount=25))
    assert r['oneRSource']=='fallback_fixed' and r['rMultiple']==2

def test_B2_empirical_and_missing():
    r=M.compute_r_multiple(-10,loss_pnls=[-10,-20,-30,-40,-50])
    assert r['oneR']==30 and r['rMultiple']==-D(1)/3 and r['exclude_from_sqn']
    assert M.compute_r_multiple(10)['rMultiple'] is None
    assert M.compute_r_multiple(None,one_r=10)['reason']=='missing_netPnl'

# B3 — IANA timezone + explicit DST fold, original timestamp hash preserved.
@pytest.mark.parametrize('raw,fold,status,reason,iso',[
    ('2026-03-08 02:30:00',None,'needs_confirm','dst_nonexistent',None),
    ('2026-11-01 01:30:00',None,'needs_confirm','dst_ambiguous',None),
    ('2026-11-01 01:30:00',0,'ok',None,'2026-11-01T05:30:00Z'),
    ('2026-11-01 01:30:00',1,'ok',None,'2026-11-01T06:30:00Z'),
    ('2026-01-01',None,'date_only','date_only',None),
    ('2026-02-30 01:00:00',None,'error','invalid_time',None),
])
def test_B3_dst(raw,fold,status,reason,iso):
    r=M.source_to_utc(raw,'America/New_York',fold=fold)
    assert (r['status'],r['reason'],r['iso'])==(status,reason,iso)

def test_B3_reset_and_hash():
    raw='2026-11-01 01:30:00'
    fingerprint=M.import_fingerprint('csv','a',raw,'EURUSD','buy',1,100)
    a=M.source_to_utc(raw,'America/New_York',fold=0)
    b=M.source_to_utc(raw,'America/New_York',fold=1)
    assert a['iso']!=b['iso']
    assert M.import_fingerprint('csv','a',raw,'EURUSD','buy',1,100)==fingerprint
    t=dt.datetime.fromisoformat('2026-01-01T19:00:00+00:00')
    assert M.trading_day_key(t,'05:00','Asia/Ho_Chi_Minh')==dt.date(2026,1,1)

# B4 — real pipeline, preview, explicit ambiguity, duplicate header positions, raw XLSX.
HEAD=['Time','Symbol','Type','Volume','Price','S/L','Time','Price','Profit','Commission']
ROW=['2026-01-01 01:00:00','EURUSD','buy','1.50 / 1.50','1.1000','1.0900','2026-01-01 02:00:00','1.1010','150','-5']
def test_B4_pipeline_preview_commit_and_undo():
    db=[]; account=M.AccountProfile('a'); journal={}
    p=M.import_pipeline([HEAD,ROW],account,db,commit=False)
    assert p['status']=='ok' and not p['committed'] and db==[]
    assert p['preview']==dict(NEW=1,ENRICH=0,SKIP=0,cashflow=0,cashflow_NEW=0,ignored=0,rejected=0)
    t=p['trades'][0]
    assert t['volume']==D('1.5') and t['netPnl']==145 and t['rMultiple']==D(145)/1500
    assert t['openTime']=='2026-01-01T01:00:00Z' and t['closeTime']=='2026-01-01T02:00:00Z'
    c=M.import_pipeline([HEAD,ROW],account,db,commit=True,batch_journal=journal,import_batch_id='b')
    assert c['committed'] and len(db)==1
    again=M.import_pipeline([HEAD,ROW],account,db)
    assert again['preview']['SKIP']==1 and again['preview']['NEW']==0
    assert M.undo_import_batch(db,'b',batch_journal=journal)==[]

def test_B4_ambiguous_then_confirm():
    rows=[['Date','Symbol','Side','Quantity','Entry Price','Exit Price','Profit'],
          ['2026-01-01','BTCUSDT','buy','1','1,234','1,250','16']]
    db=[]
    a=M.import_pipeline(rows,dict(id='a',baseCurrency='USDT'),db,commit=True)
    assert a['status']=='needs_confirm' and not a['committed'] and db==[]
    b=M.import_pipeline(rows,dict(id='a',baseCurrency='USDT'),db,commit=True,decimal_choices={'entryPrice':'.','exitPrice':'.'})
    assert b['status']=='ok' and b['trades'][0]['entryPrice']==1234 and len(db)==1

def test_B4_cashflow_skip_and_invalid():
    rows=[['Date','Symbol','Type','Amount'],['2026-01-01','','deposit','100'],['2026-01-02','','withdrawal','25'],['2026-01-03','','pending',''],['2026-01-04','','buy','']]
    r=M.import_pipeline(rows,dict(id='a'))
    assert r['preview']['cashflow']==2 and r['preview']['ignored']==1 and r['preview']['rejected']==1
    assert [c['amount'] for c in r['cashflows']]==[D(100),D(-25)]

def test_B4_enrich_undo_and_later_edit_conflict():
    db=[dict(id='x',importFingerprint='f',status='open',notes='mine',netPnl=None)]
    original=copy.deepcopy(db)
    report=M.upsert_multiset_batch(db,[dict(importFingerprint='f',status='closed',notes='bad',netPnl=D(2))],'b')
    assert report['update_count']==1 and db[0]['notes']=='mine'
    assert M.undo_import_batch(db,'b',report['undo'])==original
    db[0]['notes']='edited later'
    with pytest.raises(ValueError,match='undo_conflict'): M.undo_import_batch(db,'b',report['undo'])

def test_B4_multiset_unique_ids_atomic_validation():
    db=[]
    M.upsert_multiset_batch(db,[dict(id='f',importFingerprint='f')]*3,'b')
    assert len({t['id'] for t in db})==3
    before=copy.deepcopy(db)
    with pytest.raises(ValueError): M.upsert_multiset_batch(db,[dict(notes='missing fingerprint')],'bad')
    assert db==before

def test_B4_fifo_groups_dont_cross_symbols():
    rows=[['Date','Symbol','Side','Quantity','Price','Fee'],
          ['2026-01-01 00:00:00','BTCUSDT','buy',1,100,0],
          ['2026-01-01 00:01:00','ETHUSDT','buy',1,50,0],
          ['2026-01-01 00:02:00','BTCUSDT','sell',1,110,0],
          ['2026-01-01 00:03:00','ETHUSDT','sell',1,45,0]]
    r=M.import_pipeline(rows,dict(id='a',baseCurrency='USDT'),level='C')
    assert r['status']=='ok'
    assert {t['symbol']:t['netPnl'] for t in r['trades']}=={'BTCUSDT':D(10),'ETHUSDT':D(-5)}

def test_B4_html_csv_header_detection():
    csv='metadata\nDate;Symbol;Side;Qty;Entry Price;Exit Price;Profit\n2026-01-01;EURUSD;buy;1;1.10;1.11;1000\n'
    a=M.import_pipeline(csv,dict(id='a'))
    assert a['status']=='ok' and a['preview']['NEW']==1
    html='<table><tr><th>Time</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>Profit</th></tr><tr><td>2026-01-01</td><td>EURUSD</td><td>buy</td><td>1</td><td>1.10</td><td>2</td></tr></table>'
    assert M.import_pipeline(html,dict(id='a'))['preview']['NEW']==1

def test_B4_xlsx_raw_value(tmp_path):
    import zipfile
    path=tmp_path/'raw.xlsx'
    xml='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="inlineStr"><is><t>Price</t></is></c></row><row><c r="A2" s="1"><v>1.085</v></c></row></sheetData></worksheet>'
    with zipfile.ZipFile(path,'w') as archive: archive.writestr('xl/worksheets/sheet1.xml',xml)
    assert M.read_import_rows(path)==[['Price'],[D('1.085')]]

# B5 — schemas and validation, not substitute zero for missing data.
@pytest.mark.parametrize('kwargs',[
    dict(tiers=dict(t1=5,t2=4,t3=3)),dict(vnStockFees=dict(feeBuyRate='.15')),
    dict(serverTimeZone='Invalid/Timezone'),dict(dailyResetTime='25:00'),dict(initialCapital=-1),
])
def test_B5_invalid_profile(kwargs):
    with pytest.raises(ValueError): M.AccountProfile('a',**kwargs)

def test_B5_trade_cashflow_instrument_models():
    t=M.Trade('t','a','EURUSD','buy','1.5','1.1')
    assert isinstance(t.volume,D) and t.netPnl is None
    c=M.CashFlow('c','a',None,-10,'withdrawal',dateOnly=True,rawTime='2026-01-01')
    assert c.amount==D(-10)
    i=M.InstrumentSpec('EURUSD','forex','USD','100000','.01','.01')
    assert i.contractSize==D(100000)
    with pytest.raises(ValueError): M.CashFlow('c','a',None,10,'withdrawal')
    with pytest.raises(ValueError): M.InstrumentSpec('X','forex','USD',1,0,1)
    with pytest.raises(ValueError): M.Fallback1RConfig(minEmpiricalLosses=4)

# B6 — Omega general threshold, median, monetary stats and recursive safe JSON.
def test_B6_metrics_extensions():
    m=M.metrics([-3,0,1,2],theta=1,money_pnls=[-100,0,20,80])
    # Above(1)=1 ; below(1)=4+1=5 ; median=.5; mean money=0; money PF=1.
    assert m['omega']==pytest.approx(.2) and m['median']==.5
    assert m['es_warning'] and m['sample_label']=='Chưa đủ mẫu'
    assert m['money']['expectancy']==0 and m['money']['pf']==1 and m['money']['win_rate']==.5

def test_B6_empirical_sqn_exclusion():
    trades=[dict(status='closed',rMultiple=1,oneRSource='exact',netPnl=20),
            dict(status='closed',rMultiple=-1,oneRSource='fallback_avg_loss',netPnl=-10)]
    r=M.metrics([1,-1],trades=trades)
    assert r['sqn_N']==1 and r['sqn'] is None and r['money']['N']==2

def test_B6_recursive_json_safe():
    raw={'nested':[{'kelly_ci90':{'lo':float('nan'),'hi':float('inf')}},D('12.30'),D('-Infinity')],
         'metrics':M.metrics([1,2],with_kelly_ci=True)}
    safe=M.metrics_to_json_safe(raw)
    encoded=json.dumps(safe,allow_nan=False,ensure_ascii=False)
    assert safe['nested'][0]['kelly_ci90']['lo']['status']=='nan'
    assert safe['nested'][1]=='12.30' and 'negative_infinity' in encoded

# B7 — compare every timestamp as aware UTC, against independent prefix reference.
def test_B7_mixed_offsets_and_prefix_reference():
    trades=[dict(status='closed',openTime='2026-01-01T00:00:00Z',closeTime='2026-01-01T10:00:00+07:00',netPnl=-60),
            dict(status='open',openTime='2026-01-01T04:00:00Z'),
            dict(status='open',openTime='2026-01-01T02:00:00Z')]
    out,count=M.replay_tier_tags(1000,trades)
    assert count==1 and 'tier3_breach_at_open' in out[1]['autoTags'] and not out[2]['autoTags']
    for index,tr in enumerate(trades):
        op=dt.datetime.fromisoformat(tr['openTime'].replace('Z','+00:00'))
        before=[('trade',t['netPnl']) for t in trades if t.get('closeTime') and dt.datetime.fromisoformat(t['closeTime'].replace('Z','+00:00'))<=op]
        expected=bool(before) and M.drawdown(1000,before)['dd']>=5
        assert ('tier3_breach_at_open' in out[index]['autoTags'])==expected

def test_B7_generator_and_date_only():
    events=[('trade',1000),('cash',-5000),('trade',-500)]
    assert M.drawdown(10000,iter(events))==M.drawdown(10000,events)
    assert M.evaluate_safety_gate(10000,iter(events))['state']=='TIER_3_BREACH'
    r,count=M.replay_tier_tags(None,[dict(status='closed',openTime='2026-01-01',dateOnly=True,netPnl=-1)])
    assert count==0 and 'no_time_for_tier_check' in r[0]['flags']

# B8 — real day clusters, funded withdrawals, all four floor behaviors, unconditional EV.
def test_B8_no_phase_target():
    p=copy.deepcopy(M.DEFAULT_PROP_PRESETS['topstep_50k_xfa_standard'])
    assert p.phases[0].profit_target_pct is None
    expected=dict(status='error',reason='phase_khong_co_muc_tieu')
    assert M.simulate_path(random.Random(1),[(1,True,None,None)],[1],p.phases[0],p)==expected
    assert M.prop_pass_probability([1],p)==expected

def test_B8_day_clusters_and_missing_day():
    p=custom_preset(target=1,loss=10)
    # Every complete day sums zero: [+2,-2]. IID may pass, whole-day bootstrap must not.
    sample=[dict(R=2,day='d1'),dict(R=-2,day='d1'),dict(R=2,day='d2'),dict(R=-2,day='d2')]
    result=M.prop_pass_probability(sample,p,resample='day',b_outer=4,m_inner=10,day_cap=4,seed=19)
    assert result['status']=='ok' and result['mean']==0
    assert M.prop_pass_probability([2,-2],p,resample='day')['reason']=='day_keys_required'
    assert result['wilson_ci95'] is None and len(result['wilson_ci95_by_world'])==4

@pytest.mark.parametrize('behavior,expected_floor',[
    ('KEEP_FLOOR',1100),('LOCK_AT_INITIAL',1000),('LOCK_AT_BUFFER',1050),('FULL_RESET',900)])
def test_B8_payout_floor_modes(behavior,expected_floor):
    p=custom_preset()
    p.max_loss=M.MaxLossRule(10,'EOD_TRAILING',False,D(50),behavior)
    p.payout_cycle_days=2; p.min_payout=D(50); p.profit_split=.8
    r=M.simulate_funded_phase(random.Random(1),[],[],p,daily_returns=[100,100])
    assert r['status']=='ok' and r['gross_payout']==200 and r['net_payout']==160
    assert r['floor']==expected_floor and r['balance']==1000

def test_B8_minimum_and_consistency_windows():
    p=custom_preset(); p.payout_cycle_days=2; p.min_payout=D(250)
    r=M.simulate_funded_phase(random.Random(1),[],[],p,daily_returns=[100,100])
    assert r['gross_payout']==0
    p.min_payout=D(0); p.consistency=M.ConsistencyRule(True,.4,'INCREASE_TARGET_SOFT',('funded',))
    r=M.simulate_funded_phase(random.Random(1),[],[],p,daily_returns=[100,100,100,100,100,100])
    assert [v['day'] for v in r['payouts']]==[3,6]
    assert r['gross_payout']==600

def test_B8_daily_limit_and_mae():
    p=custom_preset(); p.daily_loss=M.DailyLossRule(True,5)
    r=M.simulate_funded_phase(random.Random(1),[],[],p,daily_returns=[-50])
    assert r['reason']=='daily_loss'
    p.daily_loss=M.DailyLossRule(False)
    r=M.simulate_funded_phase(random.Random(1),[(1,True,-11,1)],[1],p,day_cap=1)
    assert r['reason']=='max_loss'

def test_B8_lifecycle_mean_fees_and_split():
    p=custom_preset(target=1); p.phases=[M.PhaseRule('a',1),M.PhaseRule('b',1)]
    p.payout_cycle_days=2; p.profit_split=.8
    p.fees=M.PropFeeRule(D(50),D(20),True)
    # R=+1 deterministic; each phase passes day1. 2 funded days x $10 => gross20; net16.
    # EV=16 +1*50 -50 -1*20=-4, outlay70, ROI=-40/7 percent.
    r=M.prop_full_lifecycle([1],p,b_outer=2,m_inner=3,resample='none',day_cap=2,funded_day_cap=2,seed=42)
    assert r['p_funded']==1 and r['phase_pass_counts']==[3,3]
    assert r['mean_gross_payout']==20 and r['mean_net_payout']==16
    assert r['ev_attempt']==-4 and r['roi_pct']==-D(40)/7
    assert r['payout_mean_scope']=='unconditional_per_attempt'

def test_B8_unconditional_zero_on_failed_eval():
    p=custom_preset(target=1)
    r=M.prop_full_lifecycle([-1],p,resample='none',m_inner=2,day_cap=2,funded_day_cap=2)
    assert r['p_funded']==0 and r['mean_gross_payout']==0

def test_D2_deprecated_fraction_keyword():
    with pytest.warns(DeprecationWarning):
        assert M.eod_floor_series(50000,closes=[51000],l_pct='.04')==[D(49000)]
    with pytest.warns(DeprecationWarning), pytest.raises(ValueError): M.eod_floor_series(50000,'.04',[51000],l_pct='.04')
    assert M.DL_START==M.DL_FIXED

@pytest.mark.parametrize('value',[None,True,'',float('nan'),float('inf'),D('NaN'),D('Infinity')])
def test_edge_invalid_sizer_value(value):
    result=M.size_position(value,1,'1.085','1.083','buy','EURUSD')
    assert result['status']=='error'

@pytest.mark.parametrize('kwargs',[dict(step_override=0),dict(csize_override=-1),dict(vmin_override=0),dict(slip=-1),dict(comm_lot=-1),dict(fee_buy_rate='.15')])
def test_edge_invalid_sizer_overrides(kwargs):
    assert M.size_position(10000,1,'1.085','1.083','buy','EURUSD',**kwargs)['status']=='error'

@pytest.mark.parametrize('value',['',True,'NaN','Infinity'])
def test_edge_cost_no_silent_zero(value):
    val,reason=M.parse_optional_cost(value)
    if value=='': assert val==0 and reason=='fee_missing_as_zero'
    else: assert val is None and reason.startswith('invalid_cost_')

def test_edge_missing_zone_no_machine_timezone_guess():
    assert M.source_to_utc('2026-01-01 01:00:00')['reason']=='missing_timezone'
    assert M.hold_time_and_session('2026-01-01T01:00:00','2026-01-01T02:00:00')['flags']==['missing_timezone']

def test_edge_json_roundtrip_and_no_input_mutation():
    source=[dict(importFingerprint='f',netPnl=D('1.20'),notes='mine')]
    original=copy.deepcopy(source)
    M.enrich_trade_record(source[0],dict(notes='bad'))
    assert source==original
    safe=M.metrics_to_json_safe(source)
    assert json.loads(json.dumps(safe,allow_nan=False))[0]['netPnl']=='1.20'

def test_edge_simulation_invalid_counts():
    for kwargs in (dict(m_inner=0),dict(b_outer=-1),dict(block_size=0),dict(phase_index=-1),dict(risk_pct=float('nan'))):
        assert M.prop_pass_probability([1,-1],custom_preset(),**kwargs)['status']=='error'

def test_edge_ast_unique_definitions():
    import ast
    tree=ast.parse(ENGINE_PATH.read_text(encoding='utf-8-sig'))
    names=[n.name for n in tree.body if isinstance(n,(ast.FunctionDef,ast.ClassDef))]
    assert len(names)==len(set(names))
    assert getcontext().prec==40

def test_B4_atomic_cashflow_commit_restore():
    rows=[['Date','Symbol','Type','Amount'],['2026-01-01','','deposit','100'],['2026-01-01','','deposit','100']]
    db=[]; cash=[]; journal={}
    a=M.import_pipeline(rows,dict(id='a'),db,commit=True)
    assert not a['committed'] and a['status']=='needs_confirm'
    b=M.import_pipeline(rows,dict(id='a'),db,commit=True,db_cashflows=cash,batch_journal=journal,import_batch_id='cash')
    assert b['committed'] and len(cash)==2 and len({f['id'] for f in cash})==2
    again=M.import_pipeline(rows,dict(id='a'),db,commit=True,db_cashflows=cash)
    assert again['preview']['cashflow_NEW']==0 and len(cash)==2
    restored=M.undo_import_batch(db,'cash',batch_journal=journal,db_cashflows=cash)
    assert restored==[] and cash==[]

def test_B6_money_without_R_and_huge_finite_decimal():
    result=M.metrics([],money_pnls=[100,-50,None])
    assert result['N']==0 and result['money']['N']==2 and result['money']['expectancy']==25
    safe=M.metrics_to_json_safe({'large':D('1e10000')})
    assert safe['large']=='1E+10000'
    json.dumps(safe,allow_nan=False)

@pytest.mark.parametrize('value',[True,float('nan'),float('inf'),'bad'])
def test_B8_invalid_sample_explicit(value):
    assert M.prop_pass_probability([value],custom_preset())['status']=='error'
    assert M.prop_pass_probability([dict(R=value,day='d')],custom_preset(),resample='day')['status']=='error'
    assert M.empirical_kelly([value])['status']=='error'

def test_edge_invalid_fx_and_implied_input():
    assert not M.implied_vpoint(100,1,2,1,rounding_unit='bad')['ok']
    assert not M.resolve_vpoint(0,1,1,1,-1)['ok']
    assert M.size_position(10000,1,'.86','.858','buy','EURGBP',fx={('GBP','USD'):float('nan')})['status']=='error'
    assert M.prop_ev_roi(2,10,.8,50)['status']=='error'

def test_edge_binomial_empty_and_invalid_probabilities():
    for successes,total in [(0,0),(2,1),(-1,2),(True,2)]:
        with pytest.raises(ValueError): M.wilson_ci95(successes,total)
    lo,hi=M.wilson_ci95(0,1)
    assert lo==0 and hi==pytest.approx(.7934506856227626,abs=1e-15)
    assert M.fail_streak_risk([])['status']=='empty'
    assert M.fail_streak_risk([2])['status']=='error'
    with pytest.raises(ValueError): M.n_attempts_independent(float('nan'))
    with pytest.raises(ValueError): M.check_consistency_rule([1],1,0)

def test_B7_replay_with_cashflow_prefix():
    trades=[dict(status='closed',openTime='2026-01-01T00:00:00Z',closeTime='2026-01-01T01:00:00Z',netPnl=100),
            dict(status='closed',openTime='2026-01-01T02:00:00Z',closeTime='2026-01-01T03:00:00Z',netPnl=-50),
            dict(status='open',openTime='2026-01-01T04:00:00Z')]
    cash=[dict(time='2026-01-01T02:30:00Z',amount=-500)]
    out,count=M.replay_tier_tags(1000,trades,cash)
    assert count==1 and out[-1]['autoTags']==['tier3_breach_at_open']

def test_B8_fee_drag_only_when_unpaid():
    p=custom_preset(target=1)
    kwargs=dict(b_outer=1,m_inner=2,resample='none',day_cap=1,fee_drag_R=1)
    net=M.prop_pass_probability([(1,True)],p,**kwargs)
    gross=M.prop_pass_probability([(1,False)],p,**kwargs)
    assert net['mean']==1 and gross['mean']==0

def test_B4_explicit_price_unit():
    rows=[['Date','Symbol','Side','Quantity','Entry Price','Exit Price','Profit'],['2026-01-01','FPT','buy',100,120,125,500000]]
    a=M.import_pipeline(rows,dict(id='a',baseCurrency='VND'))
    assert a['trades'][0]['entryPrice']==120 and 'vn_price_unit_may_need_confirmation_no_auto_scale' in a['warnings']
    b=M.import_pipeline(rows,dict(id='a',baseCurrency='VND'),price_unit='thousand')
    assert b['trades'][0]['entryPrice']==120000

def test_B8_parametric_empty_sample_explicit_parameters():
    p=custom_preset(target=1)
    assert M.prop_pass_probability([],p,sample_mode='empirical')['status']=='empty'
    assert M.prop_pass_probability([],p,sample_mode='parametric')['reason']=='parametric_distribution_required'
    r=M.prop_pass_probability([],p,sample_mode='parametric',parametric_mean=1,parametric_sd=0,
                             resample='none',m_inner=2,day_cap=1,seed=77)
    assert r['status']=='ok' and r['mean']==1 and r['seed']==77

@pytest.mark.parametrize('tiers',[dict(t1=None,t2=4,t3=5),dict(t1=2),dict(t1=5,t2=4,t3=3)])
def test_edge_invalid_gate_configuration(tiers):
    r=M.evaluate_safety_gate(1000,[('trade',-1)],tiers=tiers)
    assert r['state']=='error' and r['reason']=='invalid_tiers' and r['can_input']

def test_B6_ES_sign_formula_preserved():
    assert M.metrics([1,2])['es5']==-1

def test_B1_fifo_foreign_fee_and_raw_provenance():
    fills=[dict(side='buy',qty=1,price=100,fee='.01',feeCurrency='BNB'),
           dict(side='sell',qty=1,price=110,fee='.01',feeCurrency='BNB')]
    r=M.compute_net_pnl('C',fills=fills,vpoint_exit=1,fee_fx_rate=100)
    assert r['netPnl']==8 and r['trades'][0]['feeKnown']
    assert r['trades'][0]['legs'][0]['raw']['rawFill']['fee']=='.01'
    unknown=M.compute_net_pnl('C',fills=fills,vpoint_exit=1)
    assert unknown['netPnl']==10 and not unknown['trades'][0]['feeKnown']
    assert 'fee_unconverted' in unknown['trades'][0]['flags']
    assert fills[0]['fee']=='.01'
    prepared_cycle=M.fifo_cycles(FILLS)[0][0]
    assert M.compute_net_pnl('C',cycle=prepared_cycle,vpoint_exit=1,fee_currency='BNB')['status']=='needs_confirm'

def test_B4_fifo_descending_input_and_date_only_confirmation():
    headers=['Date','Symbol','Side','Quantity','Price','Fee']
    rows=[['2026-01-01 02:00:00','BTCUSDT','sell',1,110,0],
          ['2026-01-01 01:00:00','BTCUSDT','buy',1,100,0]]
    r=M.import_pipeline([headers]+rows,dict(id='a',baseCurrency='USDT'),level='C')
    assert r['trades'][0]['direction']=='buy' and r['trades'][0]['netPnl']==10
    for row in rows: row[0]='2026-01-01'
    a=M.import_pipeline([headers]+rows,dict(id='a',baseCurrency='USDT'),level='C')
    assert a['status']=='needs_confirm' and a['rejected'][0]['reason']=='fifo_order_confirmation_required'
