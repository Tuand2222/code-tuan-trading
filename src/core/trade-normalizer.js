// P1 normalizer extracted unchanged in P4; one authored engine for both forms.
export const TradeNormalizer={
  units:{EQUITY_STOCK:'SHARES',COMMODITY_FUTURES:'CONTRACTS',FOREX_CFD:'LOTS',CRYPTO_ASSET:'UNITS'},
  number(value){return value!==null&&value!==undefined&&value!==''&&typeof value!=='boolean'&&Number.isFinite(Number(value))?Number(value):null;},
  normalize(raw){
    const n=TradeNormalizer.number,asset=raw.asset_class,unit=TradeNormalizer.units[asset],origin=raw.origin;
    if(!unit)throw Error('Cần lớp tài sản đã xác nhận');
    if(!['MOCK_SEED_V3','USER_LIVE','IMPORTED_VERIFIED'].includes(origin))throw Error('Cần nguồn dữ liệu đã xác nhận');
    const direction=String(raw.direction||'').toUpperCase();if(!['LONG','SHORT'].includes(direction))throw Error('Chiều lệnh không hợp lệ');
    const id=String(raw.id||''),symbol=String(raw.symbol||'').trim().toUpperCase(),date=String(raw.date||'');
    if(!id||!symbol||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Cần ID, mã và ngày hợp lệ');
    const quantity=n(raw.quantity),defaultStep=unit==='SHARES'||unit==='CONTRACTS'?1:unit==='LOTS'?.01:.00000001,step=n(raw.quantity_step)??defaultStep;
    if(!(quantity>0&&step>0)||Math.abs(quantity/step-Math.round(quantity/step))>1e-7||unit==='CONTRACTS'&&!Number.isInteger(quantity))throw Error('Khối lượng/đơn vị không hợp lệ; không tự làm tròn');
    const quote=String(raw.quote_ccy||'').toUpperCase(),account=String(raw.account_ccy||'').toUpperCase();if(!/^[A-Z][A-Z0-9]{2,7}$/.test(quote)||!/^[A-Z][A-Z0-9]{2,7}$/.test(account))throw Error('Cần tiền tệ yết giá và tài khoản');
    const fx=quote===account?1:raw.fx_verified===true?n(raw.fx_rate):null,fxOK=fx>0;
    const tick=n(raw.tick_size),value=n(raw.tick_value),declared=n(raw.contract_multiplier),mult=declared??(asset==='COMMODITY_FUTURES'&&tick>0&&value>0?value/tick:null),multOK=mult>0&&raw.multiplier_verified===true;
    const entry=n(raw.entry_price),exit=n(raw.exit_price),stop=n(raw.stop_loss),pricesOK=entry>0&&raw.prices_verified===true,quantityOK=raw.quantity_verified===true;
    const convertible=fxOK&&multOK&&quantityOK,product=quantity*(mult??0)*(fx??0),notional=convertible&&pricesOK?entry*product:null;
    const fees=n(raw.fees),taxes=n(raw.taxes),swap=n(raw.swap_cost),costsOK=fees!==null&&fees>=0&&taxes!==null&&taxes>=0&&swap!==null&&raw.costs_verified===true;
    const gross=convertible&&pricesOK&&exit>0?(direction==='LONG'?1:-1)*(exit-entry)*product:null;
    const reportedNet=n(raw.net_pnl),netReported=reportedNet!==null&&raw.reported_net_verified===true;
    let net=netReported?reportedNet:gross!==null&&costsOK?gross-(fees+taxes+swap)*fx:null;
    const netVerified=net!==null&&Number.isFinite(net)&&raw.is_net_pnl_verified!==false&&(netReported||gross!==null&&costsOK);
    if(!netVerified)net=null;
    const reportedRisk=n(raw.initial_1r_money),riskReported=reportedRisk>0&&raw.reported_risk_verified===true&&raw.risk_basis==='PRICE_ONLY';
    const stopOK=pricesOK&&stop>0&&raw.stop_verified===true&&(direction==='LONG'?stop<entry:stop>entry);
    let risk=riskReported?reportedRisk:convertible&&stopOK?Math.abs(entry-stop)*product:null;
    const riskVerified=risk>0&&Number.isFinite(risk)&&raw.is_1r_verified!==false;if(!riskVerified)risk=null;
    const reasons=[];if(!riskVerified)reasons.push('UNVERIFIED_INITIAL_RISK');if(!netVerified)reasons.push('UNVERIFIED_NET_PNL');if(!fxOK)reasons.push('MISSING_VERIFIED_FX');if(!multOK)reasons.push('MISSING_VERIFIED_MULTIPLIER');
    return {schema_version:1,id,date,origin,symbol,asset_class:asset,direction,quantity,quantity_unit:unit,quantity_step:step,quote_ccy:quote,account_ccy:account,fx_rate:fxOK?fx:null,contract_multiplier:multOK?mult:null,entry_price:entry,exit_price:exit,stop_loss:stop,fees,taxes,swap_cost:swap,gross_pnl:Number.isFinite(gross)?gross:null,net_pnl:net,is_net_pnl_verified:netVerified,net_pnl_source:netReported?'REPORTED_NET':netVerified?'VERIFIED_PRICES_AND_COSTS':'UNVERIFIED',initial_1r_money:risk,is_1r_verified:riskVerified,risk_basis:'PRICE_ONLY',risk_source:riskReported?'REPORTED_INITIAL_RISK':riskVerified?'VERIFIED_INITIAL_STOP':'UNVERIFIED',r_net:netVerified&&riskVerified?net/risk:null,notional_account:Number.isFinite(notional)?notional:null,missing_reasons:reasons,raw:structuredClone(raw)};
  },
  aggregate(trades){const quantity_by_unit={SHARES:0,CONTRACTS:0,LOTS:0,UNITS:0},notional_by_ccy={};let missing_notional=0;for(const t of trades){if(!Object.hasOwn(quantity_by_unit,t.quantity_unit)||!(t.quantity>0))throw Error('Đơn vị/khối lượng không hợp lệ');quantity_by_unit[t.quantity_unit]+=t.quantity;if(Number.isFinite(t.notional_account))notional_by_ccy[t.account_ccy]=(notional_by_ccy[t.account_ccy]||0)+t.notional_account;else missing_notional++;}return {quantity_by_unit,notional_by_ccy,missing_notional};}
};
